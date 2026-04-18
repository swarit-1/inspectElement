import { Router } from "express";
import { keccak256, stringToBytes, type Hex } from "viem";
import { z } from "zod";
import { canonicalize, type CanonicalValue } from "../canonical/json.js";
import { loadEnv } from "../config/env.js";
import { createPinner } from "../ipfs/index.js";
import { Signer } from "../signer/index.js";
import { getTraceByDigest, insertTrace } from "../store/traces.js";
import { logger } from "../utils/logger.js";
import { asyncHandler, badRequest } from "./errors.js";

/**
 * IF-04 — Trace pinning + TraceAck signing.
 *
 *   POST /v1/traces
 *   Body: { agentId, owner, contextDigest, trace }
 *   200:  { traceURI, contextDigest, uriHash, expiresAt, signature }
 *
 * Steps:
 *   1. Recompute `keccak256(canonicalize(trace))` and reject on mismatch.
 *   2. Pin the canonical bytes to IPFS (or local CAS fallback).
 *   3. Compute `uriHash = keccak256(bytes(traceURI))`.
 *   4. Pick `expiresAt = nowSec + TRACE_ACK_TTL_SECONDS`.
 *   5. Sign EIP-191(keccak256(abi.encode(contextDigest, uriHash, expiresAt))).
 */

const TraceBody = z.object({
  agentId: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .nullable()
    .optional(),
  owner: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .nullable()
    .optional(),
  contextDigest: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  trace: z.unknown(),
});

export function createTracesRouter(): Router {
  const router = Router();
  const env = loadEnv();
  const pinner = createPinner(env);
  const signer = Signer.fromEnv();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const parsed = TraceBody.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("invalid trace body", parsed.error.flatten());
      }
      const { contextDigest, trace } = parsed.data;

      let canonicalJson: string;
      try {
        canonicalJson = canonicalize(trace as CanonicalValue);
      } catch (e) {
        throw badRequest(`trace is not canonicalizable: ${(e as Error).message}`);
      }

      const recomputedDigest = keccak256(stringToBytes(canonicalJson));
      if (recomputedDigest.toLowerCase() !== contextDigest.toLowerCase()) {
        throw badRequest("contextDigest does not match keccak256(canonicalize(trace))", {
          provided: contextDigest,
          computed: recomputedDigest,
        });
      }

      const cached = getTraceByDigest(contextDigest as Hex);
      if (cached && cached.expiresAt > BigInt(Math.floor(Date.now() / 1000))) {
        res.json({
          traceURI: cached.traceUri,
          contextDigest: cached.contextDigest,
          uriHash: cached.uriHash,
          expiresAt: Number(cached.expiresAt),
          signature: cached.signature,
        });
        return;
      }

      const pin = await pinner.pin(canonicalJson, `trace-${contextDigest.slice(2, 10)}.json`);
      const uriHash = keccak256(stringToBytes(pin.uri));
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + env.TRACE_ACK_TTL_SECONDS);

      const ack = await signer.signTraceAck({
        contextDigest: contextDigest as Hex,
        uriHash,
        expiresAt,
      });

      insertTrace({
        contextDigest: contextDigest as Hex,
        traceUri: pin.uri,
        uriHash,
        agentId: (parsed.data.agentId ?? null) as Hex | null,
        owner: (parsed.data.owner ?? null) as `0x${string}` | null,
        traceJson: canonicalJson,
        expiresAt,
        signer: ack.signer,
        signature: ack.signature,
      });

      logger.info(
        {
          contextDigest,
          traceURI: pin.uri,
          pinner: pin.pinner,
          bytes: pin.bytes,
          expiresAt: Number(expiresAt),
          signer: ack.signer,
        },
        "Pinned + signed trace",
      );

      res.json({
        traceURI: pin.uri,
        contextDigest,
        uriHash,
        expiresAt: Number(expiresAt),
        signature: ack.signature,
      });
    }),
  );

  return router;
}
