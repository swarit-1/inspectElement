/**
 * Shared utilities for demo agents.
 *
 * Each agent is a scripted LLM loop (hard-coded for demo) that ends
 * in an executeWithGuard or preflightCheck call.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { getAddress, type Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { baseSepolia, hardhat } from "viem/chains";
import type { DecisionTrace } from "../packages/trace/src/types.js";
import {
  uploadTrace,
  toTraceAck,
  loadDeploymentConfig,
  createGuardClient,
  GuardDecision,
  loadRuntimeEnv,
  REASON_CODE_HEX,
} from "../packages/trace/src/index.js";

function pickChain() {
  const id = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : undefined;
  return id === 31337 ? hardhat : baseSepolia;
}

export interface AgentEnv {
  readonly operatorKey: Hex;
  readonly account: PrivateKeyAccount;
  readonly agentId: Hex;
  readonly rpcUrl: string;
  readonly traceServiceUrl: string;
}

/**
 * Load common environment for all demo agents.
 */
export function loadAgentEnv(): AgentEnv {
  const runtime = loadRuntimeEnv();
  return {
    operatorKey: runtime.operatorKey,
    account: runtime.account,
    agentId: runtime.agentId,
    rpcUrl: runtime.rpcUrl,
    traceServiceUrl: runtime.traceServiceUrl,
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

/**
 * Run the full trace-upload → execute flow for a legit/overspend agent.
 */
export async function runExecuteFlow(
  scenario: "legit" | "overspend",
  env: AgentEnv
): Promise<ScenarioResult> {
  const config = loadDeploymentConfig();
  const { trace, expectedTarget, expectedAmount } = loadFixture(scenario);

  // Override trace fields with live values
  const normalizedTarget = getAddress(expectedTarget.toLowerCase());
  const normalizedToken = getAddress((config.contracts.USDC as string).toLowerCase());
  const normalizedOwner = getAddress((trace.owner as string).toLowerCase());

  const liveTrace: DecisionTrace = {
    ...trace,
    owner: normalizedOwner,
    agentId: env.agentId,
    proposedAction: {
      ...trace.proposedAction,
      target: normalizedTarget,
      token: normalizedToken,
      amount: expectedAmount,
    },
  };

  console.log(`[${scenario}] Uploading trace...`);
  const traceResponse = await uploadTrace(liveTrace, env.traceServiceUrl);
  console.log(`[${scenario}] TraceURI: ${traceResponse.traceURI}`);
  console.log(`[${scenario}] Digest:   ${traceResponse.contextDigest}`);

  const traceAck = toTraceAck(traceResponse);
  const guardClient = createGuardClient(env.account, { rpcUrl: env.rpcUrl, chain: pickChain() });

  const executionRequest = {
    owner: normalizedOwner,
    agentId: env.agentId,
    target: normalizedTarget,
    token: normalizedToken,
    amount: BigInt(expectedAmount),
    data: "0x" as Hex,
    traceURI: traceResponse.traceURI,
    traceAck,
  };

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
  const config = loadDeploymentConfig();
  const { trace, expectedTarget, expectedAmount } = loadFixture("blocked");

  const normalizedTarget = getAddress(expectedTarget.toLowerCase());
  const normalizedToken = getAddress((config.contracts.USDC as string).toLowerCase());
  const normalizedOwner = getAddress((trace.owner as string).toLowerCase());

  const liveTrace: DecisionTrace = {
    ...trace,
    owner: normalizedOwner,
    agentId: env.agentId,
    proposedAction: {
      ...trace.proposedAction,
      target: normalizedTarget,
      token: normalizedToken,
      amount: expectedAmount,
    },
  };

  console.log("[blocked] Uploading trace...");
  const traceResponse = await uploadTrace(liveTrace, env.traceServiceUrl);
  console.log(`[blocked] TraceURI: ${traceResponse.traceURI}`);

  const traceAck = toTraceAck(traceResponse);
  const guardClient = createGuardClient(env.account, { rpcUrl: env.rpcUrl, chain: pickChain() });

  const executionRequest = {
    owner: normalizedOwner,
    agentId: env.agentId,
    target: normalizedTarget,
    token: normalizedToken,
    amount: BigInt(expectedAmount),
    data: "0x" as Hex,
    traceURI: traceResponse.traceURI,
    traceAck,
  };

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
