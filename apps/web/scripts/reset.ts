/**
 * Reset script for IntentGuard demo.
 *
 * Clears local caches, prints fresh agentId and delegate address,
 * and reseeds the intent with current demo addresses.
 *
 * Usage: npx tsx scripts/reset.ts
 */

import { randomBytes } from "crypto";

function main() {
  const agentId = `0x${randomBytes(32).toString("hex")}`;
  const delegateKey = `0x${randomBytes(20).toString("hex")}`;

  console.log("=== IntentGuard Demo Reset ===\n");
  console.log("Fresh Agent ID:");
  console.log(`  ${agentId}\n`);
  console.log("Fresh Delegate Address:");
  console.log(`  ${delegateKey}\n`);
  console.log("Demo Constants:");
  console.log("  Per-tx cap:   10 USDC");
  console.log("  Daily cap:    50 USDC");
  console.log("  Stake:        50 USDC");
  console.log("  Bond:         1 USDC\n");
  console.log("Counterparties:");
  console.log("  0x1111111111111111111111111111111111111111");
  console.log("  0x2222222222222222222222222222222222222222");
  console.log("  0x3333333333333333333333333333333333333333\n");
  console.log("Paste these values into the dashboard to begin.\n");
  console.log("=== Ready ===");
}

main();
