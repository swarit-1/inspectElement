/**
 * Standalone entry point for the local trace stub server.
 * Run: npx tsx packages/trace/src/trace-stub-server.ts
 */

import type { Hex } from "viem";
import { startTraceStub } from "./trace-stub.js";

const signerKey =
  (process.env.TRACE_STUB_SIGNER_KEY as Hex) ??
  // Hardhat account #0 — only for local development
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const port = Number(process.env.TRACE_STUB_PORT ?? 7403);

startTraceStub(signerKey, port).catch((err) => {
  console.error("Failed to start trace stub:", err);
  process.exit(1);
});
