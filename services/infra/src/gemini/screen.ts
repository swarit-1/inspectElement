import { Router } from "express";
import { loadEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { asyncHandler, badRequest } from "../api/errors.js";
import { screenTrace, getModelName } from "./client.js";
import { ScreenRequestSchema, type ScreenResponse } from "./schemas.js";

/**
 * POST /v1/screen — Gemini advisory screener.
 *
 * Classifies a trace for prompt injection, social engineering,
 * urgency manipulation, authority spoofing, amount inflation,
 * counterparty substitution, or tool-output mismatch.
 *
 * Always returns `advisoryOnly: true`. The deterministic
 * on-chain guardrails remain authoritative.
 *
 * Hard mode (GEMINI_SCREEN_HARD_MODE=true):
 *   If score exceeds GEMINI_SCREEN_HARD_THRESHOLD, the response
 *   includes `hardModeTriggered: true` — the runtime MAY abort.
 */
export function createScreenRouter(): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const parsed = ScreenRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("invalid screen request", parsed.error.flatten());
      }

      const { trace, contextDigest, owner, agentId, proposedAction, intentConfig } = parsed.data;

      const result = await screenTrace({
        trace,
        proposedAction,
        owner,
        agentId,
        intentConfig,
      });

      const env = loadEnv();
      const hardModeTriggered =
        env.GEMINI_SCREEN_HARD_MODE && result.injectionScore >= env.GEMINI_SCREEN_HARD_THRESHOLD;

      if (hardModeTriggered) {
        logger.warn(
          {
            injectionScore: result.injectionScore,
            threshold: env.GEMINI_SCREEN_HARD_THRESHOLD,
            owner,
            agentId,
            contextDigest,
          },
          "HARD MODE: Gemini screen score exceeds threshold — runtime may abort",
        );
      }

      const response: ScreenResponse & { hardModeTriggered?: boolean } = {
        ...result,
        model: getModelName(),
        advisoryOnly: true,
        ...(hardModeTriggered ? { hardModeTriggered: true } : {}),
      };

      res.json(response);
    }),
  );

  return router;
}
