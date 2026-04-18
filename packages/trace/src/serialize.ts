/**
 * Canonical serialization for DecisionTrace v1.
 *
 * Rules (critical for deterministic digests):
 * - UTF-8, no BOM.
 * - Keys alphabetically sorted at every depth.
 * - No whitespace outside string values.
 * - Numbers: integers only for amounts/timestamps (amounts encoded as JSON strings for uint256).
 * - Missing optional fields → emit with explicit `null`.
 * - Arrays preserve insertion order (do NOT sort).
 * - Line endings in string values are preserved (raw content).
 */

import type { DecisionTrace } from "./types.js";

/**
 * Recursively produces a canonical JSON string with sorted keys at every depth.
 * Arrays preserve insertion order. No extra whitespace.
 */
function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(
        `Non-finite number in trace: ${value}. Only finite integers allowed.`
      );
    }
    return String(value);
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "bigint") {
    return `"${value.toString()}"`;
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalStringify(item));
    return `[${items.join(",")}]`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const pairs = keys.map((key) => {
      const v = (value as Record<string, unknown>)[key];
      return `${JSON.stringify(key)}:${canonicalStringify(v)}`;
    });
    return `{${pairs.join(",")}}`;
  }

  throw new Error(`Unsupported type in trace: ${typeof value}`);
}

/**
 * Normalize a DecisionTrace to ensure all optional fields are explicitly present.
 * This prevents missing-field drift between serialization runs.
 */
function normalizeTrace(trace: DecisionTrace): Record<string, unknown> {
  return {
    schemaVersion: trace.schemaVersion,
    agentId: trace.agentId,
    owner: trace.owner,
    intentHash: trace.intentHash,
    session: {
      id: trace.session.id,
      startedAt: trace.session.startedAt,
      model: trace.session.model,
      temperature: trace.session.temperature,
    },
    prompts: trace.prompts.map((p) => ({
      role: p.role,
      content: p.content,
      timestamp: p.timestamp,
    })),
    toolCalls: trace.toolCalls.map((tc) => ({
      name: tc.name,
      input: tc.input,
      output: tc.output,
      timestamp: tc.timestamp,
    })),
    observations: trace.observations.map((o) => ({
      source: o.source,
      content: o.content,
      timestamp: o.timestamp,
    })),
    proposedAction: {
      target: trace.proposedAction.target,
      token: trace.proposedAction.token,
      amount: trace.proposedAction.amount,
      callData: trace.proposedAction.callData,
      rationale: trace.proposedAction.rationale,
    },
    nonce: trace.nonce,
  };
}

/**
 * Serialize a DecisionTrace to canonical JSON.
 * Deterministic: same trace → same string across all runs.
 */
export function serializeCanonical(trace: DecisionTrace): string {
  const normalized = normalizeTrace(trace);
  return canonicalStringify(normalized);
}
