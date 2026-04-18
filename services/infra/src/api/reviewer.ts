import { Router } from "express";
import {
  createWalletClient,
  encodeFunctionData,
  http,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import { z } from "zod";
import { challengeArbiterFunctions } from "../abi/index.js";
import { loadDeployments, loadEnv } from "../config/env.js";
import { Signer } from "../signer/index.js";
import { logger } from "../utils/logger.js";
import { asyncHandler, badRequest, internal } from "./errors.js";

/**
 * IF-11 — Reviewer signer stub.
 *
 *   POST /v1/reviewer/resolve
 *   Body: { challengeId, uphold, slashAmount }
 *   200:  { signature, signer, digest, calldata, broadcasted, txHash? }
 *
 * Not used in the live demo. We always return the signed payload + ready-made
 * calldata; broadcasting is opt-in via `REVIEWER_BROADCAST=true`. When opted
 * in, we also send `resolveByReviewer(...)` from the reviewer key as the
 * backend wallet.
 */

const Body = z.object({
  challengeId: z.union([z.string(), z.number()]),
  uphold: z.boolean(),
  slashAmount: z.union([z.string(), z.number(), z.bigint()]),
});

export function createReviewerRouter(): Router {
  const router = Router();
  const env = loadEnv();
  const deployment = loadDeployments(env);
  const signer = Signer.fromEnv();

  router.post(
    "/resolve",
    asyncHandler(async (req, res) => {
      const parsed = Body.safeParse(req.body);
      if (!parsed.success) throw badRequest("invalid reviewer body", parsed.error.flatten());

      const challengeId = BigInt(parsed.data.challengeId as string | number);
      const slashAmount = BigInt(parsed.data.slashAmount as string | number | bigint);

      if (!signer.reviewer) {
        throw internal("reviewer key not configured (set REVIEWER_PRIVATE_KEY)");
      }

      const sig = await signer.signReviewerDecision({
        challengeId,
        uphold: parsed.data.uphold,
        slashAmount,
      });

      const calldata = encodeFunctionData({
        abi: challengeArbiterFunctions,
        functionName: "resolveByReviewer",
        args: [challengeId, parsed.data.uphold, slashAmount, sig.signature],
      });

      let txHash: Hex | null = null;
      if (env.REVIEWER_BROADCAST && deployment) {
        try {
          const wallet = createWalletClient({
            chain: baseSepolia,
            transport: http(env.RPC_URL),
            account: signer.reviewer,
          });
          txHash = await wallet.sendTransaction({
            to: deployment.contracts.ChallengeArbiter,
            data: calldata,
          });
          logger.info({ challengeId: challengeId.toString(), txHash }, "Broadcast reviewer tx");
        } catch (e) {
          logger.error(
            { err: (e as Error).message, challengeId: challengeId.toString() },
            "Reviewer broadcast failed",
          );
        }
      }

      res.json({
        signature: sig.signature,
        signer: sig.signer,
        digest: sig.digest,
        calldata,
        to: deployment?.contracts.ChallengeArbiter ?? null,
        chainId: env.CHAIN_ID,
        broadcasted: !!txHash,
        txHash,
      });
    }),
  );

  return router;
}
