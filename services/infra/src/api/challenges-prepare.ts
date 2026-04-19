import { Router } from "express";
import { encodeFunctionData, type Hex } from "viem";
import { z } from "zod";
import type { PrepareAmountResponse } from "../../../../schemas/challenge.js";
import { challengeArbiterFunctions } from "../abi/index.js";
import { loadDeployments, loadEnv } from "../config/env.js";
import { findChallengeByReceipt } from "../store/challenges.js";
import { getManifestByHash } from "../store/manifests.js";
import { getReceipt } from "../store/receipts.js";
import { asyncHandler, badRequest, internal } from "./errors.js";

/**
 * IF-07 — Challenge preparation.
 *
 *   POST /v1/challenges/prepare-amount
 *   Body: { receiptId, challenger }
 *   200:  { eligible, reason, bondAmount, to, data, value, chainId }
 *
 * Eligibility (Dev 3 spec §3.5):
 *   - receipt exists
 *   - challenge window still open
 *   - receipt.amount > intent.maxSpendPerTx
 *   - no existing FILED/UPHELD challenge for this receipt
 *
 * On eligible we encode `fileAmountViolation(bytes32 receiptId)` calldata so
 * Dev 4 can hand it directly to wagmi `sendTransaction`. Dev 4 still needs to
 * approve the bond on USDC before calling this — pre-approval at intent commit
 * is the recommended path (Dev 4 spec §3.5).
 */

const Body = z.object({
  receiptId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  challenger: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

export function createChallengePrepareRouter(): Router {
  const router = Router();
  const env = loadEnv();
  const deployment = loadDeployments(env);

  router.post(
    "/prepare-amount",
    asyncHandler(async (req, res) => {
      const parsed = Body.safeParse(req.body);
      if (!parsed.success) throw badRequest("invalid prepare body", parsed.error.flatten());

      if (!deployment) {
        throw internal(
          "deployments/base-sepolia.json not loaded; cannot prepare challenge calldata",
        );
      }

      const challengeWindowSec = deployment.constants.challengeWindowSec;
      const bondAmount = deployment.constants.challengeBond;
      const arbiter = deployment.contracts.ChallengeArbiter;

      const receipt = await getReceipt(parsed.data.receiptId as Hex);
      if (!receipt) {
        res.json(prepareIneligible("receipt_not_found", bondAmount, env.CHAIN_ID));
        return;
      }

      const windowEndsAt = receipt.ts + challengeWindowSec;
      if (windowEndsAt <= Math.floor(Date.now() / 1000)) {
        res.json(prepareIneligible("challenge_window_closed", bondAmount, env.CHAIN_ID));
        return;
      }

      const manifest = await getManifestByHash(receipt.intentHash);
      if (!manifest) {
        res.json(prepareIneligible("manifest_not_indexed", bondAmount, env.CHAIN_ID));
        return;
      }
      if (receipt.amount <= manifest.maxSpendPerTx) {
        res.json(prepareIneligible("not_overspend", bondAmount, env.CHAIN_ID));
        return;
      }

      const existing = await findChallengeByReceipt(receipt.receiptId);
      if (existing && existing.status !== "REJECTED") {
        res.json(
          prepareIneligible(
            `challenge_already_${existing.status.toLowerCase()}`,
            bondAmount,
            env.CHAIN_ID,
          ),
        );
        return;
      }

      const data = encodeFunctionData({
        abi: challengeArbiterFunctions,
        functionName: "fileAmountViolation",
        args: [receipt.receiptId],
      });

      const response: PrepareAmountResponse = {
        eligible: true,
        reason: null,
        bondAmount,
        to: arbiter,
        data,
        value: "0",
        chainId: env.CHAIN_ID,
      };
      res.json(response);
    }),
  );

  return router;
}

function prepareIneligible(
  reason: string,
  bondAmount: string,
  chainId: number,
): PrepareAmountResponse {
  return { eligible: false, reason, bondAmount, to: null, data: null, value: "0", chainId };
}
