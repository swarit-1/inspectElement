/**
 * Helpers for turning a frozen DecisionTrace fixture into a live runtime trace
 * and building a GuardedExecutor-compatible ExecutionRequest.
 */

import { getAddress, type Hex } from "viem";
import type { DecisionTrace, ExecutionRequest, TraceAck } from "./types.js";

export interface LiveTraceOverrides {
  readonly owner: string;
  readonly agentId: Hex;
  readonly target: string;
  readonly token: string;
  readonly amount: string;
}

export interface BuildExecutionRequestInput {
  readonly owner: string;
  readonly agentId: Hex;
  readonly target: string;
  readonly token: string;
  readonly amount: string | number | bigint;
  readonly traceURI: string;
  readonly traceAck: TraceAck;
  readonly data?: Hex;
}

/**
 * Replace placeholder fixture values with live addresses and amount while
 * preserving the rest of the frozen trace byte-for-byte.
 */
export function prepareLiveTrace(
  trace: DecisionTrace,
  overrides: LiveTraceOverrides
): DecisionTrace {
  return {
    ...trace,
    owner: getAddress(overrides.owner.toLowerCase()),
    agentId: overrides.agentId,
    proposedAction: {
      ...trace.proposedAction,
      target: getAddress(overrides.target.toLowerCase()),
      token: getAddress(overrides.token.toLowerCase()),
      amount: normalizeAmountString(overrides.amount),
    },
  };
}

/**
 * Build the typed struct consumed by GuardedExecutor from normalized runtime
 * values. This keeps request construction consistent across every scenario.
 */
export function buildExecutionRequest(
  input: BuildExecutionRequestInput
): ExecutionRequest {
  const traceURI = input.traceURI.trim();
  if (!traceURI) {
    throw new Error("traceURI is required to build an ExecutionRequest");
  }

  return {
    owner: getAddress(input.owner.toLowerCase()) as `0x${string}`,
    agentId: input.agentId,
    target: getAddress(input.target.toLowerCase()) as `0x${string}`,
    token: getAddress(input.token.toLowerCase()) as `0x${string}`,
    amount: normalizeAmountBigInt(input.amount),
    data: input.data ?? ("0x" as Hex),
    traceURI,
    traceAck: input.traceAck,
  };
}

function normalizeAmountString(value: string): string {
  return normalizeAmountBigInt(value).toString();
}

function normalizeAmountBigInt(value: string | number | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`amount must be a non-negative integer; received ${value}`);
    }
    return BigInt(value);
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`amount must be a base-10 integer string; received "${value}"`);
  }
  return BigInt(trimmed);
}
