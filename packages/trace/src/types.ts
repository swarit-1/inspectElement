/**
 * DecisionTrace v1 — canonical schema for IntentGuard agent decision traces.
 *
 * FROZEN after hour 12. Any field change invalidates all prior contextDigests
 * and breaks Dev 1's guard + Dev 3's replay.
 *
 * JSON Schema: `packages/trace/schema/decision-trace-v1.schema.json`
 */

/** Frozen schema version — bump only with team agreement (specs-dev2). */
export const DECISION_TRACE_SCHEMA_VERSION = "1.0.0" as const;

export interface SessionInfo {
  readonly id: string;
  readonly startedAt: number;
  readonly model: string;
  readonly temperature: number;
}

export interface PromptMessage {
  readonly role: "user" | "system" | "assistant";
  readonly content: string;
  readonly timestamp: number;
}

export interface ToolCall {
  readonly name: string;
  readonly input: Record<string, unknown>;
  readonly output: Record<string, unknown>;
  readonly timestamp: number;
}

export interface Observation {
  readonly source: string;
  readonly content: string;
  readonly timestamp: number;
}

export interface ProposedAction {
  readonly target: string;
  readonly token: string;
  readonly amount: string;
  readonly callData: string;
  readonly rationale: string;
}

export interface DecisionTrace {
  readonly schemaVersion: typeof DECISION_TRACE_SCHEMA_VERSION;
  readonly agentId: string;
  readonly owner: string;
  readonly intentHash: string;
  readonly session: SessionInfo;
  readonly prompts: readonly PromptMessage[];
  readonly toolCalls: readonly ToolCall[];
  readonly observations: readonly Observation[];
  readonly proposedAction: ProposedAction;
  readonly nonce: number;
}

/**
 * TraceAck — signed attestation from the infra service that a trace
 * exists at a given URI for a given digest.
 */
export interface TraceAck {
  readonly contextDigest: `0x${string}`;
  readonly uriHash: `0x${string}`;
  readonly expiresAt: number;
  readonly signature: `0x${string}`;
}

/**
 * ExecutionRequest — the struct submitted to GuardedExecutor.
 * Must match Dev 1's Solidity struct exactly.
 */
export interface ExecutionRequest {
  readonly owner: `0x${string}`;
  readonly agentId: `0x${string}`;
  readonly target: `0x${string}`;
  readonly token: `0x${string}`;
  readonly amount: bigint;
  readonly data: `0x${string}`;
  readonly traceURI: string;
  readonly traceAck: TraceAck;
}

/**
 * Guard decision enum — matches Dev 1's Solidity enum.
 */
export enum GuardDecision {
  GREEN = 0,
  YELLOW = 1,
  RED = 2,
}

/**
 * Reason codes — bytes32 keccak256 of the string.
 * Must match Dev 1's constants.
 */
export const REASON_CODES = {
  COUNTERPARTY_NOT_ALLOWED: "COUNTERPARTY_NOT_ALLOWED",
  TOKEN_NOT_USDC: "TOKEN_NOT_USDC",
  INTENT_EXPIRED: "INTENT_EXPIRED",
  DAY_CAP_EXCEEDED: "DAY_CAP_EXCEEDED",
  DELEGATE_NOT_APPROVED: "DELEGATE_NOT_APPROVED",
  TRACE_ACK_INVALID: "TRACE_ACK_INVALID",
  TRACE_ACK_EXPIRED: "TRACE_ACK_EXPIRED",
  NO_ACTIVE_INTENT: "NO_ACTIVE_INTENT",
} as const;

export type ReasonCode = (typeof REASON_CODES)[keyof typeof REASON_CODES];
