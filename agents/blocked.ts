/**
 * Blocked Demo Agent
 *
 * Scripted agent that attempts to send 20 USDC to a non-allowlisted attacker.
 * Uses preflightCheck ONLY — does NOT call executeWithGuard (reverts emit no logs).
 * Expected outcome: RED, COUNTERPARTY_NOT_ALLOWED.
 */

import { loadAgentEnv, runPreflightOnlyFlow } from "./shared.js";

async function main() {
  console.log("=== IntentGuard Demo: Blocked Attack ===\n");

  const env = loadAgentEnv();
  console.log(`Agent:  ${env.agentId}`);
  console.log(`Operator: ${env.account.address}\n`);

  const result = await runPreflightOnlyFlow(env);

  console.log("\n=== Result ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Blocked agent failed:", err);
  process.exit(1);
});
