/**
 * Mock x402 Merchant
 *
 * Minimal HTTP server returning 402 Payment Required with payment details.
 * Used as a fallback when the public x402 service is flaky.
 * Same payment-required shape either way.
 */

import express from "express";
import {
  loadDeploymentConfig,
  resolveMerchantAddress,
  resolveMockX402Port,
} from "../../../packages/trace/src/index.js";

const PORT = resolveMockX402Port();

function main() {
  const app = express();
  app.use(express.json());

  const config = loadDeploymentConfig();

  // The merchant's receiving address — should be in the user's allowlist
  const merchantAddress = resolveMerchantAddress();

  /**
   * Any request to /api/* returns 402 with payment details
   * until payment is confirmed.
   */
  app.all("/api/*", (_req, res) => {
    res.status(402).json({
      status: 402,
      message: "Payment Required",
      payment: {
        receiver: merchantAddress,
        token: config.contracts.USDC,
        amount: "2000000", // 2 USDC
        chainId: config.chainId,
        description: "DataAPI subscription — 2 USDC/request",
      },
    });
  });

  /**
   * Health check
   */
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      merchant: merchantAddress,
      token: config.contracts.USDC,
    });
  });

  app.listen(PORT, () => {
    console.log(`[mock-x402] Listening on :${PORT}`);
    console.log(`[mock-x402] Merchant: ${merchantAddress}`);
    console.log(`[mock-x402] Token: ${config.contracts.USDC}`);
  });
}

main();
