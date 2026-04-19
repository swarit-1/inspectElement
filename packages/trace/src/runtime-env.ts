/**
 * Shared runtime environment loader for Dev 2-owned scripts and services.
 *
 * Goals:
 * - Keep agent/runtime env parsing in one place.
 * - Support both `RPC_URL` and the repo-wide `BASE_SEPOLIA_RPC_URL` alias.
 * - Provide stable defaults for local demo flows without duplicating logic.
 */

import { encodePacked, keccak256, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

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

export interface RuntimeEnv {
  readonly operatorKey: Hex;
  readonly ownerKey: Hex;
  readonly account: PrivateKeyAccount;
  readonly ownerAccount: PrivateKeyAccount;
  readonly agentSalt: string;
  readonly agentId: Hex;
  readonly rpcUrl: string;
  readonly traceServiceUrl: string;
  readonly agentMetadataUri: string;
  readonly merchantAddress: `0x${string}`;
  readonly demoPort: number;
  readonly mockX402Port: number;
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

export function deriveAgentId(
  operatorAddress: `0x${string}`,
  salt: string
): Hex {
  return keccak256(encodePacked(["address", "string"], [operatorAddress, salt]));
}

export function loadRuntimeEnv(
  env: RuntimeEnvSource = process.env
): RuntimeEnv {
  const operatorKey = env.OPERATOR_PRIVATE_KEY as Hex | undefined;
  if (!operatorKey) {
    throw new Error("OPERATOR_PRIVATE_KEY env var required");
  }
  const ownerKey =
    (env.OWNER_PRIVATE_KEY as Hex | undefined) ??
    (env.CHAIN_ID === "31337" ? DEFAULT_DEMO_OWNER_KEY : undefined);
  if (!ownerKey) {
    throw new Error(
      "OWNER_PRIVATE_KEY env var required (or omit only on CHAIN_ID=31337)"
    );
  }

  const account = privateKeyToAccount(operatorKey);
  const ownerAccount = privateKeyToAccount(ownerKey);
  const agentSalt = resolveAgentSalt(env);

  return {
    operatorKey,
    ownerKey,
    account,
    ownerAccount,
    agentSalt,
    agentId: deriveAgentId(account.address, agentSalt),
    rpcUrl: resolveRuntimeRpcUrl(env),
    traceServiceUrl: resolveTraceServiceUrl(env),
    agentMetadataUri: resolveAgentMetadataUri(env),
    merchantAddress: resolveMerchantAddress(env),
    demoPort: resolveDemoPort(env),
    mockX402Port: resolveMockX402Port(env),
  };
}

function resolvePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
