import { Router } from "express";
import type { Hex } from "viem";
import { z } from "zod";
import type { ScreeningProvider } from "../screening/types.js";
import { createScreener } from "../screening/screener.js";
import { getTraceByDigest } from "../store/traces.js";
import { asyncHandler, badRequest, notFound } from "./errors.js";

/**
 * POST /v1/screen
 *
 * Screens a stored decision trace for prompt-injection or manipulation signals.
 * Results are ADVISORY ONLY — they never affect deterministic challenge outcomes.
 *
 * Body: { contextDigest: "0x..." }
 * 200: ScreeningResult
 * 400: invalid input
 * 404: trace not found
 */

const ScreenBody = z.object({
  contextDigest: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export function createScreenRouter(provider: ScreeningProvider): Router {
  const router = Router();
  const screener = createScreener(provider);

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const parsed = ScreenBody.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("invalid screen body", parsed.error.flatten());
      }

      const trace = await getTraceByDigest(parsed.data.contextDigest as Hex);
      if (!trace) {
        throw notFound("trace not found");
      }

      const result = await screener.screen(trace.traceJson);
      res.json(result);
    }),
  );

  return router;
}
