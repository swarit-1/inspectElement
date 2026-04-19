import { Router } from "express";
import type { Hex } from "viem";
import { z } from "zod";
import { asyncHandler, badRequest, notFound } from "../api/errors.js";
import { getReceipt } from "../store/receipts.js";
import { getChallenge } from "../store/challenges.js";
import { getCachedSummary, cacheSummary } from "../store/summaries.js";
import { generateSummary, getModelName } from "./client.js";
import type { SummaryResponse } from "./schemas.js";

/**
 * GET /v1/receipts/:receiptId/summary — advisory Gemini summary for a receipt.
 * GET /v1/challenges/:challengeId/summary — advisory Gemini summary for a challenge.
 *
 * Summaries are cached in the gemini_summaries table. Repeated loads
 * return the cached version for consistency and speed.
 *
 * Summaries never mutate the receipt or challenge.
 */

const ReceiptSummaryParams = z.object({
  receiptId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

const ChallengeSummaryParams = z.object({
  challengeId: z.string().regex(/^\d+$/),
});

export function createReceiptSummaryRouter(): Router {
  const router = Router({ mergeParams: true });

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const parsed = ReceiptSummaryParams.safeParse(req.params);
      if (!parsed.success) throw badRequest("invalid receiptId");

      const receiptId = parsed.data.receiptId as Hex;

      // Check cache first
      const cached = await getCachedSummary("receipt", receiptId);
      if (cached) {
        res.json(cached);
        return;
      }

      // Fetch receipt evidence
      const receipt = await getReceipt(receiptId);
      if (!receipt) throw notFound("receipt not found");

      const evidence: Record<string, unknown> = {
        receiptId: receipt.receiptId,
        owner: receipt.owner,
        agentId: receipt.agentId,
        intentHash: receipt.intentHash,
        target: receipt.target,
        token: receipt.token,
        amount: receipt.amount.toString(10),
        contextDigest: receipt.contextDigest,
        traceUri: receipt.traceUri,
        timestamp: receipt.ts,
        txHash: receipt.txHash,
      };

      const result = await generateSummary("receipt", evidence);
      const response: SummaryResponse = {
        ...result,
        advisoryOnly: true,
        model: getModelName(),
      };

      // Cache for future loads
      await cacheSummary("receipt", receiptId, response);

      res.json(response);
    }),
  );

  return router;
}

export function createChallengeSummaryRouter(): Router {
  const router = Router({ mergeParams: true });

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const parsed = ChallengeSummaryParams.safeParse(req.params);
      if (!parsed.success) throw badRequest("invalid challengeId");

      const challengeId = parsed.data.challengeId;

      // Check cache first
      const cached = await getCachedSummary("challenge", challengeId);
      if (cached) {
        res.json(cached);
        return;
      }

      // Fetch challenge evidence
      const challenge = await getChallenge(challengeId);
      if (!challenge) throw notFound("challenge not found");

      const evidence: Record<string, unknown> = {
        challengeId: challenge.challengeId,
        receiptId: challenge.receiptId,
        status: challenge.status,
        challenger: challenge.challenger,
        filedAt: challenge.filedAt,
        resolvedAt: challenge.resolvedAt,
        payout: challenge.payout != null ? challenge.payout.toString(10) : null,
      };

      const result = await generateSummary("challenge", evidence);
      const response: SummaryResponse = {
        ...result,
        advisoryOnly: true,
        model: getModelName(),
      };

      // Cache for future loads
      await cacheSummary("challenge", challengeId, response);

      res.json(response);
    }),
  );

  return router;
}
