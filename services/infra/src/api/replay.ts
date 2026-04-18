import { Router } from "express";
import { z } from "zod";
import { getTraceByDigest } from "../store/traces.js";
import { asyncHandler, badRequest, notFound } from "./errors.js";

/**
 * Replay-engine scaffold.
 *
 *   GET /v1/replay/:contextDigest → full stored trace bundle
 *
 * No live semantic judging; this is the retrieval surface the future reviewer
 * console will hang off. Returning the canonical JSON byte-for-byte means a
 * caller can re-derive `keccak256(canonicalize(trace)) == contextDigest`.
 */

const Params = z.object({
  contextDigest: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export function createReplayRouter(): Router {
  const router = Router();

  router.get(
    "/:contextDigest",
    asyncHandler(async (req, res) => {
      const parsed = Params.safeParse(req.params);
      if (!parsed.success) throw badRequest("invalid contextDigest");
      const row = getTraceByDigest(parsed.data.contextDigest as `0x${string}`);
      if (!row) throw notFound("trace not found");
      res.json({
        contextDigest: row.contextDigest,
        traceURI: row.traceUri,
        uriHash: row.uriHash,
        agentId: row.agentId,
        owner: row.owner,
        expiresAt: Number(row.expiresAt),
        signer: row.signer,
        signature: row.signature,
        trace: JSON.parse(row.traceJson),
      });
    }),
  );

  return router;
}
