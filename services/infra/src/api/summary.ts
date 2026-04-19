import { Router } from "express";
import type { Hex } from "viem";
import { z } from "zod";
import type { ScreeningProvider, SummaryContext } from "../screening/types.js";
import { createSummarizer } from "../screening/summarizer.js";
import { getReceipt } from "../store/receipts.js";
import { getTraceByDigest } from "../store/traces.js";
import { getChallenge, findChallengeByReceipt } from "../store/challenges.js";
import { asyncHandler, badRequest, notFound } from "./errors.js";

/**
 * Summary routes — generates advisory Gemini-powered incident summaries.
 *
 *   GET /v1/receipts/:receiptId/summary
 *   GET /v1/challenges/:challengeId/summary
 *
 * All results are ADVISORY ONLY and clearly labeled as such.
 */

const ReceiptParams = z.object({
  receiptId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

const ChallengeParams = z.object({
  challengeId: z.string().regex(/^\d+$/),
});

export function createSummaryRouter(provider: ScreeningProvider): Router {
  const router = Router();
  const summarizer = createSummarizer(provider);

  router.get(
    "/receipts/:receiptId/summary",
    asyncHandler(async (req, res) => {
      const parsed = ReceiptParams.safeParse(req.params);
      if (!parsed.success) throw badRequest("invalid receiptId");

      const receipt = await getReceipt(parsed.data.receiptId as Hex);
      if (!receipt) throw notFound("receipt not found");

      const trace = receipt.contextDigest
        ? await getTraceByDigest(receipt.contextDigest)
        : null;

      const challenge = await findChallengeByReceipt(receipt.receiptId);

      const context: SummaryContext = {
        trace: trace ? safeParseJson(trace.traceJson) : null,
        receipt: {
          receiptId: receipt.receiptId,
          owner: receipt.owner,
          agentId: receipt.agentId,
          target: receipt.target,
          token: receipt.token,
          amount: receipt.amount.toString(10),
          timestamp: receipt.ts,
        },
        challenge: challenge
          ? {
              challengeId: challenge.challengeId,
              status: challenge.status,
              payout: challenge.payout != null ? challenge.payout.toString(10) : null,
              filedAt: challenge.filedAt,
              resolvedAt: challenge.resolvedAt ?? null,
            }
          : undefined,
      };

      const result = await summarizer.summarize(context);
      res.json(result);
    }),
  );

  router.get(
    "/challenges/:challengeId/summary",
    asyncHandler(async (req, res) => {
      const parsed = ChallengeParams.safeParse(req.params);
      if (!parsed.success) throw badRequest("invalid challengeId");

      const challenge = await getChallenge(parsed.data.challengeId);
      if (!challenge) throw notFound("challenge not found");

      const receipt = await getReceipt(challenge.receiptId as Hex);
      if (!receipt) throw notFound("receipt not found for challenge");

      const trace = receipt.contextDigest
        ? await getTraceByDigest(receipt.contextDigest)
        : null;

      const context: SummaryContext = {
        trace: trace ? safeParseJson(trace.traceJson) : null,
        receipt: {
          receiptId: receipt.receiptId,
          owner: receipt.owner,
          agentId: receipt.agentId,
          target: receipt.target,
          token: receipt.token,
          amount: receipt.amount.toString(10),
          timestamp: receipt.ts,
        },
        challenge: {
          challengeId: challenge.challengeId,
          status: challenge.status,
          payout: challenge.payout != null ? challenge.payout.toString(10) : null,
          filedAt: challenge.filedAt,
          resolvedAt: challenge.resolvedAt ?? null,
        },
      };

      const result = await summarizer.summarize(context);
      res.json(result);
    }),
  );

  return router;
}

function safeParseJson(json: string): Record<string, unknown> | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
