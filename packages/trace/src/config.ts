/**
 * Deployment configuration reader.
 *
 * Reads contract addresses and constants from Dev 1's deployment artifact.
 * Never hardcode addresses — always read from deployments/base-sepolia.json.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

export interface DeploymentConfig {
  readonly chainId: number;
  readonly contracts: {
    readonly IntentRegistry: `0x${string}`;
    readonly AgentRegistry: `0x${string}`;
    readonly GuardedExecutor: `0x${string}`;
    readonly ChallengeArbiter: `0x${string}`;
    readonly StakeVault: `0x${string}`;
    readonly USDC: `0x${string}`;
  };
  readonly traceAckSigner: `0x${string}`;
  readonly reviewerSigner: `0x${string}`;
  readonly constants: {
    readonly chainId: number;
    readonly maxSpendPerTx: string;
    readonly maxSpendPerDay: string;
    readonly agentStake: string;
    readonly challengeBond: string;
    readonly challengeWindowSec: number;
  };
}

let cachedConfig: DeploymentConfig | null = null;

/**
 * Load the deployment config. Caches after first read.
 * Falls back to stub config if file doesn't exist yet (Dev 1 hasn't deployed).
 */
export function loadDeploymentConfig(
  configPath?: string
): DeploymentConfig {
  if (cachedConfig) return cachedConfig;

  const path =
    configPath ??
    process.env.DEPLOYMENTS_PATH ??
    resolve(process.cwd(), "deployments", "base-sepolia.json");

  try {
    const raw = readFileSync(path, "utf-8");
    cachedConfig = JSON.parse(raw) as DeploymentConfig;
    return cachedConfig;
  } catch {
    // Dev 1 hasn't deployed yet — use stub addresses for local development
    console.warn(
      `[config] deployments/base-sepolia.json not found at ${path}. Using stub config.`
    );
    cachedConfig = getStubConfig();
    return cachedConfig;
  }
}

/**
 * Stub config for local development before Dev 1 deploys.
 */
function getStubConfig(): DeploymentConfig {
  return {
    chainId: 84532,
    contracts: {
      IntentRegistry: "0x0000000000000000000000000000000000000000",
      AgentRegistry: "0x0000000000000000000000000000000000000000",
      GuardedExecutor: "0x0000000000000000000000000000000000000000",
      ChallengeArbiter: "0x0000000000000000000000000000000000000000",
      StakeVault: "0x0000000000000000000000000000000000000000",
      USDC: "0x0000000000000000000000000000000000000000",
    },
    traceAckSigner: "0x0000000000000000000000000000000000000000",
    reviewerSigner: "0x0000000000000000000000000000000000000000",
    constants: {
      chainId: 84532,
      maxSpendPerTx: "10000000",
      maxSpendPerDay: "50000000",
      agentStake: "50000000",
      challengeBond: "1000000",
      challengeWindowSec: 259200,
    },
  };
}

/**
 * Clear the cached config (for testing).
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
