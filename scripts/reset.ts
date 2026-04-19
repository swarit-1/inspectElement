/**
 * Demo reset helper — prints fresh agent identity hints and demo constants.
 *
 * Usage (repo root): npx tsx scripts/reset.ts
 *
 * For full on-chain bootstrap (stake, register), use: npm run bootstrap
 */

import { randomBytes } from "node:crypto";

function main() {
  const agentId = `0x${randomBytes(32).toString("hex")}`;
  const delegateHint = `0x${randomBytes(20).toString("hex")}`;

  console.log("=== IntentGuard demo reset ===\n");
  console.log("Paste into the dashboard (Agent delegation step):\n");
  console.log(`  NEXT_PUBLIC_DEFAULT_AGENT_ID=${agentId}`);
  console.log(`  NEXT_PUBLIC_DEFAULT_DELEGATE=${delegateHint}\n`);
  console.log("Or set these in .env.local for the web app and reload.\n");
  console.log("Frozen demo caps:");
  console.log("  Per-tx:  10 USDC");
  console.log("  Per-day: 50 USDC");
  console.log("  Bond:    1 USDC");
  console.log("  Stake:   50 USDC (display / operator)\n");
  console.log("Default allowlist placeholders (edit in Intent builder):");
  console.log("  0x1111111111111111111111111111111111111111");
  console.log("  0x2222222222222222222222222222222222222222");
  console.log("  0x3333333333333333333333333333333333333333\n");
  console.log("The web app reads deployments/base-sepolia.json directly; override with NEXT_PUBLIC_*_ADDRESS only when iterating locally.");
  console.log("=== Done ===\n");
}

main();
