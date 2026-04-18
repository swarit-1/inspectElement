/**
 * Shared utilities for demo agents.
 *
 * Each agent is a scripted LLM loop (hard-coded for demo) that ends
 * in an executeWithGuard or preflightCheck call.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { keccak256, encodePacked, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { DecisionTrace } from "../packages/trace/src/types.js";
import {
  computeContextDigest,
  uploadTrace,
  toTraceAck,
  loadDeploymentConfig,
  createGuardClient,
  GuardDecision,
} from "../packages/trace/src/index.js";

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
  const operatorKey = process.env.OPERATOR_PRIVATE_KEY as Hex | undefined;
  if (!operatorKey) {
    throw new Error("OPERATOR_PRIVATE_KEY env var required");
  }

  const salt = process.env.AGENT_SALT ?? "intentguard-demo-agent-v1";
  const account = privateKeyToAccount(operatorKey);
  const agentId = keccak256(
    encodePacked(["address", "string"], [account.address, salt])
  );

  return {
    operatorKey,
    account,
    agentId,
    rpcUrl: process.env.RPC_URL ?? "https://sepolia.base.org",
    traceServiceUrl: process.env.TRACE_SERVICE_URL ?? "http://localhost:7403",
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
  readonly reasonCode?: string;
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
  const liveTrace: DecisionTrace = {
    ...trace,
    agentId: env.agentId,
    proposedAction: {
      ...trace.proposedAction,
      target: expectedTarget,
      token: config.contracts.USDC,
      amount: expectedAmount,
    },
  };

  console.log(`[${scenario}] Uploading trace...`);
  const traceResponse = await uploadTrace(liveTrace, env.traceServiceUrl);
  console.log(`[${scenario}] TraceURI: ${traceResponse.traceURI}`);
  console.log(`[${scenario}] Digest:   ${traceResponse.contextDigest}`);

  const traceAck = toTraceAck(traceResponse);
  const guardClient = createGuardClient(env.account, { rpcUrl: env.rpcUrl });

  const executionRequest = {
    owner: liveTrace.owner as Hex,
    agentId: env.agentId,
    target: expectedTarget,
    token: config.contracts.USDC,
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

  const liveTrace: DecisionTrace = {
    ...trace,
    agentId: env.agentId,
    proposedAction: {
      ...trace.proposedAction,
      target: expectedTarget,
      token: config.contracts.USDC,
      amount: expectedAmount,
    },
  };

  console.log("[blocked] Uploading trace...");
  const traceResponse = await uploadTrace(liveTrace, env.traceServiceUrl);
  console.log(`[blocked] TraceURI: ${traceResponse.traceURI}`);

  const traceAck = toTraceAck(traceResponse);
  const guardClient = createGuardClient(env.account, { rpcUrl: env.rpcUrl });

  const executionRequest = {
    owner: liveTrace.owner as Hex,
    agentId: env.agentId,
    target: expectedTarget,
    token: config.contracts.USDC,
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

  return {
    scenario: "blocked",
    outcome: "blocked",
    reasonCode: result.reasonLabel,
  };
}
