/**
 * Shared runtime environment loader for Dev 2-owned scripts and services.
 *
 * Goals:
 * - Keep agent/runtime env parsing in one place.
 * - Support both `RPC_URL` and the repo-wide `BASE_SEPOLIA_RPC_URL` alias.
 * - Provide stable defaults for local demo flows without duplicating logic.
 * - Allow the agent operator/delegate signer to come from either a raw
 *   private key (`OPERATOR_PRIVATE_KEY`, legacy/local mode) or a
 *   Coinbase Server Wallet (CDP, default when CDP creds are set).
 *
 * The owner side (`OWNER_PRIVATE_KEY` → `ownerAccount`) is unchanged:
 * the owner stands in for the end-user (MetaMask in the web app) and
 * must remain locally controllable.
 */

import { encodePacked, keccak256, type Account, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { loadCdpAgentAccount } from "./cdp-account.js";

export const DEFAULT_RUNTIME_RPC_URL = "https://sepolia.base.org";
export const DEFAULT_TRACE_SERVICE_URL = "http://localhost:7403";
export const DEFAULT_AGENT_SALT = "intentguard-demo-agent-v1";
export const DEFAULT_AGENT_METADATA_URI = "ipfs://stub/agent-metadata";
export const DEFAULT_MERCHANT_ADDRESS =
  "0x0000000000000000000000000000000000000a01";
export const DEFAULT_DEMO_PORT = 7402;
export const DEFAULT_MOCK_X402_PORT = 7404;
export const DEFAULT_DEMO_OWNER_KEY =
  "0x59c6995e998f97a5a0044966f0945382d7d6d3f6aa3dbe8b6f2a68d4d5f7d9e7";

export type AgentSignerProvider = "cdp" | "local";

export interface RuntimeEnv {
  /**
   * Raw operator key, only present when running in `local` signer mode.
   * Undefined when the agent signer is sourced from CDP.
   */
  readonly operatorKey?: Hex;
  readonly ownerKey: Hex;
  /**
   * Operator/delegate account, only present when `signerProvider === "local"`.
   * For `cdp`, callers must use `loadAgentAccount(env)` to obtain it
   * (the CDP fetch is async).
   */
  readonly account?: PrivateKeyAccount;
  readonly ownerAccount: PrivateKeyAccount;
  readonly agentSalt: string;
  /**
   * Derived agentId, only present when `signerProvider === "local"` (because
   * it depends on the operator address). For `cdp`, `loadAgentAccount(env)`
   * computes it after fetching the CDP address.
   */
  readonly agentId?: Hex;
  readonly rpcUrl: string;
  readonly traceServiceUrl: string;
  readonly agentMetadataUri: string;
  readonly merchantAddress: `0x${string}`;
  readonly demoPort: number;
  readonly mockX402Port: number;
  readonly signerProvider: AgentSignerProvider;
  readonly cdpAccountName?: string;
}

type RuntimeEnvSource = NodeJS.ProcessEnv | Record<string, string | undefined>;

export function resolveRuntimeRpcUrl(
  env: RuntimeEnvSource = process.env
): string {
  return (
    env.RPC_URL ??
    env.BASE_SEPOLIA_RPC_URL ??
    DEFAULT_RUNTIME_RPC_URL
  );
}

export function resolveTraceServiceUrl(
  env: RuntimeEnvSource = process.env
): string {
  return env.TRACE_SERVICE_URL ?? DEFAULT_TRACE_SERVICE_URL;
}

export function resolveAgentSalt(
  env: RuntimeEnvSource = process.env
): string {
  return env.AGENT_SALT ?? DEFAULT_AGENT_SALT;
}

export function resolveAgentMetadataUri(
  env: RuntimeEnvSource = process.env
): string {
  return env.AGENT_METADATA_URI ?? DEFAULT_AGENT_METADATA_URI;
}

export function resolveMerchantAddress(
  env: RuntimeEnvSource = process.env
): `0x${string}` {
  return (
    (env.MERCHANT_ADDRESS as `0x${string}` | undefined) ??
    DEFAULT_MERCHANT_ADDRESS
  );
}

export function resolveDemoPort(
  env: RuntimeEnvSource = process.env
): number {
  return resolvePort(env.DEMO_PORT, DEFAULT_DEMO_PORT);
}

export function resolveMockX402Port(
  env: RuntimeEnvSource = process.env
): number {
  return resolvePort(env.MOCK_X402_PORT, DEFAULT_MOCK_X402_PORT);
}

export function resolveSignerProvider(
  env: RuntimeEnvSource = process.env
): AgentSignerProvider {
  const explicit = env.AGENT_SIGNER?.toLowerCase();
  if (explicit === "cdp" || explicit === "local") {
    return explicit;
  }
  const hasCdpCreds = Boolean(
    env.CDP_API_KEY_ID && env.CDP_API_KEY_SECRET && env.CDP_WALLET_SECRET
  );
  return hasCdpCreds ? "cdp" : "local";
}

export function deriveAgentId(
  operatorAddress: `0x${string}`,
  salt: string
): Hex {
  return keccak256(encodePacked(["address", "string"], [operatorAddress, salt]));
}

export function loadRuntimeEnv(
  env: RuntimeEnvSource = process.env
): RuntimeEnv {
  const signerProvider = resolveSignerProvider(env);
  const operatorKey = env.OPERATOR_PRIVATE_KEY as Hex | undefined;
  if (signerProvider === "local" && !operatorKey) {
    throw new Error(
      "OPERATOR_PRIVATE_KEY env var required when AGENT_SIGNER=local " +
        "(or unset AGENT_SIGNER and provide CDP_API_KEY_ID/CDP_API_KEY_SECRET/CDP_WALLET_SECRET)."
    );
  }
  const ownerKey =
    (env.OWNER_PRIVATE_KEY as Hex | undefined) ??
    (env.CHAIN_ID === "31337" ? DEFAULT_DEMO_OWNER_KEY : undefined);
  if (!ownerKey) {
    throw new Error(
      "OWNER_PRIVATE_KEY env var required (or omit only on CHAIN_ID=31337)"
    );
  }

  const account =
    signerProvider === "local" && operatorKey
      ? privateKeyToAccount(operatorKey)
      : undefined;
  const ownerAccount = privateKeyToAccount(ownerKey);
  const agentSalt = resolveAgentSalt(env);
  const agentId = account
    ? deriveAgentId(account.address, agentSalt)
    : undefined;

  return {
    operatorKey,
    ownerKey,
    account,
    ownerAccount,
    agentSalt,
    agentId,
    rpcUrl: resolveRuntimeRpcUrl(env),
    traceServiceUrl: resolveTraceServiceUrl(env),
    agentMetadataUri: resolveAgentMetadataUri(env),
    merchantAddress: resolveMerchantAddress(env),
    demoPort: resolveDemoPort(env),
    mockX402Port: resolveMockX402Port(env),
    signerProvider,
    cdpAccountName: env.CDP_AGENT_ACCOUNT_NAME,
  };
}

export interface AgentAccountResolution {
  readonly account: Account;
  readonly address: `0x${string}`;
  readonly agentId: Hex;
  readonly source: AgentSignerProvider;
}

/**
 * Resolve the operator/delegate account for the agent runtime.
 *
 * - `local`: returns the synchronously-derived account from `loadRuntimeEnv`.
 * - `cdp`: fetches (or creates) the named CDP Server Wallet EVM EOA and
 *   wraps it as a viem Account. Cached inside `cdp-account.ts` so repeat
 *   calls in the same process are free.
 *
 * `agentId` is derived from the resolved address and the runtime's
 * `agentSalt`, so it stays stable for a given (operator address, salt) pair
 * regardless of the signer source.
 */
export async function loadAgentAccount(
  runtime: RuntimeEnv
): Promise<AgentAccountResolution> {
  if (runtime.signerProvider === "local") {
    if (!runtime.account || !runtime.agentId) {
      throw new Error(
        "Internal error: signerProvider=local but runtime.account/agentId is missing."
      );
    }
    return {
      account: runtime.account,
      address: runtime.account.address,
      agentId: runtime.agentId,
      source: "local",
    };
  }

  const cdp = await loadCdpAgentAccount({ accountName: runtime.cdpAccountName });
  return {
    account: cdp.account,
    address: cdp.address,
    agentId: deriveAgentId(cdp.address, runtime.agentSalt),
    source: "cdp",
  };
}

function resolvePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
