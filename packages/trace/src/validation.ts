import decisionTraceSchema from "../schema/decision-trace-v1.schema.json";
import {
  DECISION_TRACE_SCHEMA_VERSION,
  type DecisionTrace,
} from "./types.js";

export const DECISION_TRACE_SCHEMA_PATH =
  "packages/trace/schema/decision-trace-v1.schema.json" as const;

export const DECISION_TRACE_SCHEMA = decisionTraceSchema;

export class DecisionTraceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionTraceValidationError";
  }
}

export function validateDecisionTrace(trace: DecisionTrace): void {
  const root = toRecord(trace);
  const requiredKeys = [
    "schemaVersion",
    "agentId",
    "owner",
    "intentHash",
    "session",
    "prompts",
    "toolCalls",
    "observations",
    "proposedAction",
    "nonce",
  ];

  for (const key of requiredKeys) {
    if (!(key in root)) {
      throw new DecisionTraceValidationError(`DecisionTrace missing required field "${key}"`);
    }
  }
  assertExactKeys(root, requiredKeys, "DecisionTrace");

  if (trace.schemaVersion !== DECISION_TRACE_SCHEMA_VERSION) {
    throw new DecisionTraceValidationError(
      `schemaVersion must be ${DECISION_TRACE_SCHEMA_VERSION}; received ${trace.schemaVersion}`
    );
  }

  assertHex(trace.agentId, 64, "agentId");
  assertHex(trace.owner, 40, "owner");
  assertHex(trace.intentHash, 64, "intentHash");
  assertExactKeys(
    toRecord(trace.session),
    ["id", "startedAt", "model", "temperature"],
    "session"
  );
  assertInteger(trace.session.startedAt, "session.startedAt");
  assertNumber(trace.session.temperature, "session.temperature");

  assertArray(trace.prompts, "prompts");
  for (const [index, prompt] of trace.prompts.entries()) {
    assertExactKeys(
      toRecord(prompt),
      ["role", "content", "timestamp"],
      `prompts[${index}]`
    );
    if (!["user", "system", "assistant"].includes(prompt.role)) {
      throw new DecisionTraceValidationError(`prompts[${index}].role is invalid`);
    }
    assertString(prompt.content, `prompts[${index}].content`);
    assertInteger(prompt.timestamp, `prompts[${index}].timestamp`);
  }

  assertArray(trace.toolCalls, "toolCalls");
  for (const [index, toolCall] of trace.toolCalls.entries()) {
    assertExactKeys(
      toRecord(toolCall),
      ["name", "input", "output", "timestamp"],
      `toolCalls[${index}]`
    );
    assertString(toolCall.name, `toolCalls[${index}].name`);
    assertRecord(toolCall.input, `toolCalls[${index}].input`);
    assertRecord(toolCall.output, `toolCalls[${index}].output`);
    assertInteger(toolCall.timestamp, `toolCalls[${index}].timestamp`);
  }

  assertArray(trace.observations, "observations");
  for (const [index, observation] of trace.observations.entries()) {
    assertExactKeys(
      toRecord(observation),
      ["source", "content", "timestamp"],
      `observations[${index}]`
    );
    assertString(observation.source, `observations[${index}].source`);
    assertString(observation.content, `observations[${index}].content`);
    assertInteger(observation.timestamp, `observations[${index}].timestamp`);
  }

  assertExactKeys(
    toRecord(trace.proposedAction),
    ["target", "token", "amount", "callData", "rationale"],
    "proposedAction"
  );
  assertHex(trace.proposedAction.target, 40, "proposedAction.target");
  assertHex(trace.proposedAction.token, 40, "proposedAction.token");
  if (!/^\d+$/.test(trace.proposedAction.amount)) {
    throw new DecisionTraceValidationError("proposedAction.amount must be a base-10 integer string");
  }
  if (!/^0x[0-9a-fA-F]*$/.test(trace.proposedAction.callData)) {
    throw new DecisionTraceValidationError("proposedAction.callData must be a 0x-prefixed hex string");
  }
  assertString(trace.proposedAction.rationale, "proposedAction.rationale");
  assertInteger(trace.nonce, "nonce");
}

function assertString(value: unknown, field: string): void {
  if (typeof value !== "string") {
    throw new DecisionTraceValidationError(`${field} must be a string`);
  }
}

function assertNumber(value: unknown, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DecisionTraceValidationError(`${field} must be a finite number`);
  }
}

function assertInteger(value: unknown, field: string): void {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new DecisionTraceValidationError(`${field} must be an integer`);
  }
}

function assertArray(value: unknown, field: string): void {
  if (!Array.isArray(value)) {
    throw new DecisionTraceValidationError(`${field} must be an array`);
  }
}

function assertRecord(value: unknown, field: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DecisionTraceValidationError(`${field} must be an object`);
  }
}

function assertHex(value: unknown, hexLength: number, field: string): void {
  if (typeof value !== "string" || !new RegExp(`^0x[0-9a-fA-F]{${hexLength}}$`).test(value)) {
    throw new DecisionTraceValidationError(
      `${field} must be a 0x-prefixed hex string with ${hexLength} hex chars`
    );
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
  field: string
): void {
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...allowedKeys].sort();

  if (actualKeys.length !== expectedKeys.length) {
    throw new DecisionTraceValidationError(
      `${field} has unexpected keys: expected ${expectedKeys.join(", ")}`
    );
  }

  for (let index = 0; index < expectedKeys.length; index += 1) {
    if (actualKeys[index] !== expectedKeys[index]) {
      throw new DecisionTraceValidationError(
        `${field} has unexpected keys: expected ${expectedKeys.join(", ")}`
      );
    }
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DecisionTraceValidationError("Expected object shape while validating DecisionTrace");
  }

  return value as unknown as Record<string, unknown>;
}
