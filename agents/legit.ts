/**
 * Legit Demo Agent
 *
 * Scripted agent that pays 2 USDC to an allowlisted merchant.
 * Expected outcome: GREEN, receipt emitted, txHash returned.
 */

import "../scripts/load-env.js";
import { loadAgentEnv, runExecuteFlow } from "./shared.js";

async function main() {
  console.log("=== IntentGuard Demo: Legitimate Payment ===\n");

  const env = await loadAgentEnv();
  console.log(`Agent:  ${env.agentId}`);
  console.log(`Operator: ${env.account.address} (${env.signerProvider})\n`);

  const result = await runExecuteFlow("legit", env);

  console.log("\n=== Result ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Legit agent failed:", err);
  process.exit(1);
});
