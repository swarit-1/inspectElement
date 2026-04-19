import { Router } from "express";
import { getAddress, keccak256, stringToBytes, type Hex } from "viem";
import { z } from "zod";
import { canonicalize, type CanonicalValue } from "../canonical/json.js";
import { loadEnv } from "../config/env.js";
import { createPinner } from "../ipfs/index.js";
import { resolveTraceAckContext, Signer } from "../signer/index.js";
import { getTraceByDigest, insertTrace } from "../store/traces.js";
import { logger } from "../utils/logger.js";
import { asyncHandler, badRequest } from "./errors.js";

/**
 * IF-04 — Trace pinning + TraceAck signing.
 *
 *   POST /v1/traces
 *   Body: { agentId, owner, contextDigest, trace }
 *
 *     - `agentId`  bytes32 — REQUIRED: bound into the EIP-712 TraceAck.
 *     - `owner`    address — REQUIRED: bound into the EIP-712 TraceAck.
 *     - `trace`    object | string — accepted as either:
 *                    object: we canonicalize it ourselves and recompute the digest
 *                    string: treated as already-canonical JSON; bytes used verbatim
 *                  Dev 2's `packages/trace/src/trace-client.ts` sends a string;
 *                  hand-written API consumers tend to send an object.
 *
 *   200:  { traceURI, contextDigest, uriHash, expiresAt, signature, signer,
 *           guardedExecutor, chainId, agentId, owner }
 *
 * Steps:
 *   1. Recompute `keccak256(canonicalBytes(trace))` and reject on mismatch
 *      vs the provided contextDigest (the trace must hash to what the runtime
 *      claims).
 *   2. Pin the canonical bytes to IPFS (or local CAS fallback).
 *   3. Compute `uriHash = keccak256(bytes(traceURI))`.
 *   4. Pick `expiresAt = nowSec + TRACE_ACK_TTL_SECONDS`.
 *   5. EIP-712 sign with the IntentGuard domain + 7-field TraceAck type.
 */

const TraceBody = z.object({
  agentId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  owner: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  contextDigest: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  trace: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]),
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
      const { contextDigest, trace, agentId, owner } = parsed.data;

      const canonicalJson = toCanonicalBytes(trace);

      const recomputedDigest = keccak256(stringToBytes(canonicalJson));
      if (recomputedDigest.toLowerCase() !== contextDigest.toLowerCase()) {
        throw badRequest("contextDigest does not match keccak256(canonical(trace))", {
          provided: contextDigest,
          computed: recomputedDigest,
          traceWasString: typeof trace === "string",
        });
      }

      const ctx = resolveTraceAckContext();

      const cached = await getTraceByDigest(contextDigest as Hex);
      if (cached && cached.expiresAt > BigInt(Math.floor(Date.now() / 1000))) {
        res.json({
          traceURI: cached.traceUri,
          contextDigest: cached.contextDigest,
          uriHash: cached.uriHash,
          expiresAt: Number(cached.expiresAt),
          signature: cached.signature,
          signer: cached.signer,
          guardedExecutor: ctx.guardedExecutor,
          chainId: ctx.chainId,
          agentId,
          owner,
        });
        return;
      }

      const pin = await pinner.pin(canonicalJson, `trace-${contextDigest.slice(2, 10)}.json`);
      const uriHash = keccak256(stringToBytes(pin.uri));
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + env.TRACE_ACK_TTL_SECONDS);

      const ownerNormalized = getAddress(owner);

      const ack = await signer.signTraceAck(
        {
          contextDigest: contextDigest as Hex,
          uriHash,
          expiresAt,
          agentId: agentId as Hex,
          owner: ownerNormalized,
        },
        ctx,
      );

      await insertTrace({
        contextDigest: contextDigest as Hex,
        traceUri: pin.uri,
        uriHash,
        agentId: agentId as Hex,
        owner: ownerNormalized,
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
          guardedExecutor: ctx.guardedExecutor,
          chainId: ctx.chainId,
        },
        "Pinned + signed trace",
      );

      res.json({
        traceURI: pin.uri,
        contextDigest,
        uriHash,
        expiresAt: Number(expiresAt),
        signature: ack.signature,
        signer: ack.signer,
        guardedExecutor: ctx.guardedExecutor,
        chainId: ctx.chainId,
        agentId,
        owner: ownerNormalized,
      });
    }),
  );

  return router;
}

/**
 * Convert the `trace` field into the exact canonical UTF-8 string whose
 * keccak256 the caller is claiming. Two accepted shapes:
 *
 *   - string: caller has already canonicalized; we trust the bytes verbatim
 *     and let the keccak comparison upstream reject if they're wrong.
 *   - object/array: we run our own canonicalizer on it.
 */
function toCanonicalBytes(trace: unknown): string {
  if (typeof trace === "string") return trace;
  try {
    return canonicalize(trace as CanonicalValue);
  } catch (e) {
    throw badRequest(`trace is not canonicalizable: ${(e as Error).message}`);
  }
}
