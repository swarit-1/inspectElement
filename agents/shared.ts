/**
 * Shared utilities for demo agents.
 *
 * Each agent is a scripted LLM loop (hard-coded for demo) that ends
 * in an executeWithGuard or preflightCheck call.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  createPublicClient,
  getAddress,
  http,
  type Account,
  type Address,
  type Hex,
} from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { baseSepolia, hardhat } from "viem/chains";
import type { DecisionTrace } from "../packages/trace/src/types.js";
import {
  buildExecutionRequest,
  prepareLiveTrace,
  uploadTrace,
  toTraceAck,
  loadDeploymentConfig,
  createGuardClient,
  GuardDecision,
  loadRuntimeEnv,
  loadAgentAccount,
  REASON_CODE_HEX,
  IntentRegistryABI,
} from "../packages/trace/src/index.js";
import type {
  AgentSignerProvider,
  BuildExecutionRequestInput,
} from "../packages/trace/src/index.js";

function pickChain() {
  const id = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : undefined;
  return id === 31337 ? hardhat : baseSepolia;
}

export interface AgentEnv {
  /**
   * Raw operator key, only present in `local` signer mode. Undefined when
   * the agent signer comes from a Coinbase Server Wallet.
   */
  readonly operatorKey?: Hex;
  /** Operator/delegate account (viem). Backed by either CDP or a raw key. */
  readonly account: Account;
  readonly ownerAccount: PrivateKeyAccount;
  readonly ownerAddress: Address;
  readonly agentId: Hex;
  readonly rpcUrl: string;
  readonly traceServiceUrl: string;
  readonly signerProvider: AgentSignerProvider;
}

/**
 * Load common environment for all demo agents.
 *
 * Async because the operator account may be sourced from a Coinbase
 * Server Wallet (one network round-trip on the first call per process,
 * cached thereafter). `ownerAddressOverride` lets the live runtime target
 * whatever wallet is currently connected in the web app.
 */
export async function loadAgentEnv(
  ownerAddressOverride?: Address
): Promise<AgentEnv> {
  const runtime = loadRuntimeEnv();
  const { account, agentId } = await loadAgentAccount(runtime);
  const ownerAddress = ownerAddressOverride
    ? getAddress(ownerAddressOverride)
    : runtime.ownerAccount.address;
  return {
    operatorKey: runtime.operatorKey,
    account,
    ownerAccount: runtime.ownerAccount,
    ownerAddress,
    agentId,
    rpcUrl: runtime.rpcUrl,
    traceServiceUrl: runtime.traceServiceUrl,
    signerProvider: runtime.signerProvider,
  };
}

/**
 * Load a fixture file and parse the trace from it.
 */
export function loadFixture(scenario: "legit" | "blocked" | "overspend"): {
  trace: DecisionTrace;
  expectedTarget: Hex;
  expectedAmount: string;
} {
  const fixturePath = resolve(process.cwd(), "fixtures", `${scenario}.json`);
  const raw = readFileSync(fixturePath, "utf-8");
  const fixture = JSON.parse(raw);
  return {
    trace: fixture.trace as DecisionTrace,
    expectedTarget: fixture.expectedTarget as Hex,
    expectedAmount: fixture.expectedAmount as string,
  };
}

export interface ScenarioResult {
  readonly scenario: string;
  readonly outcome: "success" | "blocked" | "failed";
  readonly txHash?: string;
  readonly receiptId?: string;
  /** Human-readable reason label from guard (e.g. COUNTERPARTY_NOT_ALLOWED). */
  readonly reasonCode?: string;
  /** bytes32 hex from preflight when available (for debugging / strict checks). */
  readonly reasonCodeHex?: string;
  readonly error?: string;
}

interface PreparedScenario {
  readonly liveTrace: DecisionTrace;
  readonly requestInput: Omit<BuildExecutionRequestInput, "traceURI" | "traceAck">;
}

async function prepareScenarioExecution(
  scenario: "legit" | "blocked" | "overspend",
  env: AgentEnv
): Promise<PreparedScenario> {
  const config = loadDeploymentConfig();
  const { trace, expectedTarget, expectedAmount } = loadFixture(scenario);
  const normalizedTarget = getAddress(expectedTarget.toLowerCase());
  const normalizedToken = getAddress((config.contracts.USDC as string).toLowerCase());
  const normalizedOwner = getAddress(env.ownerAddress.toLowerCase());
  const intentHash = await readActiveIntentHash(env, config.contracts.IntentRegistry);

  const liveTrace = prepareLiveTrace(trace, {
    owner: normalizedOwner,
    agentId: env.agentId,
    intentHash,
    target: normalizedTarget,
    token: normalizedToken,
    amount: expectedAmount,
  });

  return {
    liveTrace,
    requestInput: {
      owner: normalizedOwner,
      agentId: env.agentId,
      target: normalizedTarget,
      token: normalizedToken,
      amount: expectedAmount,
      data: "0x" as Hex,
    },
  };
}

/**
 * Run the full trace-upload → execute flow for a legit/overspend agent.
 */
export async function runExecuteFlow(
  scenario: "legit" | "overspend",
  env: AgentEnv
): Promise<ScenarioResult> {
  const prepared = await prepareScenarioExecution(scenario, env);

  console.log(`[${scenario}] Uploading trace...`);
  const traceResponse = await uploadTrace(prepared.liveTrace, env.traceServiceUrl);
  console.log(`[${scenario}] TraceURI: ${traceResponse.traceURI}`);
  console.log(`[${scenario}] Digest:   ${traceResponse.contextDigest}`);

  const guardClient = createGuardClient(env.account, { rpcUrl: env.rpcUrl, chain: pickChain() });
  const executionRequest = buildExecutionRequest({
    ...prepared.requestInput,
    traceURI: traceResponse.traceURI,
    traceAck: toTraceAck(traceResponse),
  });

  console.log(`[${scenario}] Running preflight...`);
  const preflightResult = await guardClient.preflight(executionRequest);
  console.log(
    `[${scenario}] Preflight: decision=${preflightResult.decision}, reason=${preflightResult.reasonLabel}`
  );

  if (preflightResult.decision !== GuardDecision.GREEN) {
    return {
      scenario,
      outcome: "blocked",
      reasonCode: preflightResult.reasonLabel,
      reasonCodeHex: preflightResult.reasonCode,
    };
  }

  console.log(`[${scenario}] Executing guarded payment...`);
  const { receiptId, txHash } = await guardClient.execute(executionRequest);
  console.log(`[${scenario}] Success! receiptId: ${receiptId} txHash: ${txHash}`);

  return {
    scenario,
    outcome: "success",
    txHash,
    receiptId,
  };
}

/**
 * Run the preflight-only flow for the blocked agent.
 * Does NOT call executeWithGuard (reverts emit no logs).
 */
export async function runPreflightOnlyFlow(
  env: AgentEnv
): Promise<ScenarioResult> {
  const prepared = await prepareScenarioExecution("blocked", env);

  console.log("[blocked] Uploading trace...");
  const traceResponse = await uploadTrace(prepared.liveTrace, env.traceServiceUrl);
  console.log(`[blocked] TraceURI: ${traceResponse.traceURI}`);

  const guardClient = createGuardClient(env.account, { rpcUrl: env.rpcUrl, chain: pickChain() });
  const executionRequest = buildExecutionRequest({
    ...prepared.requestInput,
    traceURI: traceResponse.traceURI,
    traceAck: toTraceAck(traceResponse),
  });

  console.log("[blocked] Running preflight (will NOT execute)...");
  const result = await guardClient.preflight(executionRequest);
  console.log(
    `[blocked] Preflight: decision=${result.decision}, reason=${result.reasonLabel}`
  );

  if (result.decision !== GuardDecision.RED) {
    return {
      scenario: "blocked",
      outcome: "failed",
      reasonCode: result.reasonLabel,
      reasonCodeHex: result.reasonCode,
      error:
        `Blocked demo expects preflight RED (COUNTERPARTY_NOT_ALLOWED); got decision=${result.decision}. ` +
        `Check deployments, intent allowlist, and that expectedTarget in fixtures/blocked.json is not allowlisted.`,
    };
  }

  if (result.reasonCode.toLowerCase() !== REASON_CODE_HEX.COUNTERPARTY_NOT_ALLOWED.toLowerCase()) {
    console.warn(
      `[blocked] Expected reason COUNTERPARTY_NOT_ALLOWED; got ${result.reasonLabel} (${result.reasonCode})`
    );
  }

  return {
    scenario: "blocked",
    outcome: "blocked",
    reasonCode: result.reasonLabel,
    reasonCodeHex: result.reasonCode,
  };
}

async function readActiveIntentHash(
  env: AgentEnv,
  intentRegistry: Hex
): Promise<Hex> {
  const client = createPublicClient({
    chain: pickChain(),
    transport: http(env.rpcUrl),
  });

  const intentHash = (await client.readContract({
    address: intentRegistry,
    abi: IntentRegistryABI,
    functionName: "getActiveIntentHash",
    args: [env.ownerAddress],
  })) as Hex;

  if (/^0x0{64}$/.test(intentHash)) {
    throw new Error(
      `No active intent found for demo owner ${env.ownerAddress}. Run npm run bootstrap first.`
    );
  }

  return intentHash;
}
