/**
 * Overspend Demo Agent
 *
 * Scripted agent that sends 15 USDC to an allowlisted merchant.
 * Guard does NOT enforce maxSpendPerTx — this is slash-only.
 * Expected outcome: GREEN, receipt emitted, txHash returned.
 * User can then file AmountViolation challenge.
 */

import { loadAgentEnv, runExecuteFlow } from "./shared.js";

async function main() {
  console.log("=== IntentGuard Demo: Overspend (Slash-Only) ===\n");

  const env = loadAgentEnv();
  console.log(`Agent:  ${env.agentId}`);
  console.log(`Operator: ${env.account.address}\n`);

  const result = await runExecuteFlow("overspend", env);

  console.log("\n=== Result ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Overspend agent failed:", err);
  process.exit(1);
});
