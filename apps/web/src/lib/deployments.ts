import type { Address } from "viem";
import manifest from "../../../../deployments/base-sepolia.json";

export interface DeploymentManifest {
  chainId: number;
  contracts: {
    IntentRegistry: Address;
    AgentRegistry: Address;
    GuardedExecutor: Address;
    ChallengeArbiter: Address;
    StakeVault: Address;
    USDC: Address;
  };
  traceAckSigner: Address;
  reviewerSigner: Address;
  constants: {
    chainId: number;
    maxSpendPerTx: string;
    maxSpendPerDay: string;
    agentStake: string;
    challengeBond: string;
    challengeWindowSec: number;
  };
}

const loaded = manifest as DeploymentManifest;

function envAddr(key: string): Address | undefined {
  const v = process.env[key];
  if (v && /^0x[0-9a-fA-F]{40}$/.test(v)) return v as Address;
  return undefined;
}

/**
 * Contract addresses for Base Sepolia. Dev 1 publishes the canonical root
 * manifest at `deployments/base-sepolia.json`; any `NEXT_PUBLIC_*` override
 * wins for client-side iteration without editing the checked-in manifest.
 */
export function getDeploymentAddresses(): {
  usdc: Address;
  intentRegistry: Address;
  guardedExecutor: Address;
  agentRegistry: Address;
  challengeArbiter: Address;
  stakeVault: Address;
} {
  return {
    usdc: envAddr("NEXT_PUBLIC_USDC_ADDRESS") ?? loaded.contracts.USDC,
    intentRegistry:
      envAddr("NEXT_PUBLIC_INTENT_REGISTRY_ADDRESS") ??
      loaded.contracts.IntentRegistry,
    guardedExecutor:
      envAddr("NEXT_PUBLIC_GUARDED_EXECUTOR_ADDRESS") ??
      loaded.contracts.GuardedExecutor,
    agentRegistry:
      envAddr("NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS") ??
      loaded.contracts.AgentRegistry,
    challengeArbiter:
      envAddr("NEXT_PUBLIC_CHALLENGE_ARBITER_ADDRESS") ??
      loaded.contracts.ChallengeArbiter,
    stakeVault:
      envAddr("NEXT_PUBLIC_STAKE_VAULT_ADDRESS") ?? loaded.contracts.StakeVault,
  };
}

export function getDeploymentConstants(): DeploymentManifest["constants"] {
  return loaded.constants;
}
