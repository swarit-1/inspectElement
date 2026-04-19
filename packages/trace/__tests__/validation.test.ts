import { describe, expect, it } from "vitest";
import type { DecisionTrace } from "../src/index.js";
import {
  DecisionTraceValidationError,
  DECISION_TRACE_SCHEMA_PATH,
  validateDecisionTrace,
} from "../src/index.js";

function makeTrace(): DecisionTrace {
  return {
    schemaVersion: "1.0.0",
    agentId: "0x" + "11".repeat(32),
    owner: "0x" + "22".repeat(20),
    intentHash: "0x" + "33".repeat(32),
    session: {
      id: "trace-validation",
      startedAt: 1700000000,
      model: "claude-sonnet-4-20250514",
      temperature: 0,
    },
    prompts: [
      {
        role: "user",
        content: "Pay the merchant.",
        timestamp: 1700000001,
      },
    ],
    toolCalls: [],
    observations: [],
    proposedAction: {
      target: "0x" + "44".repeat(20),
      token: "0x" + "55".repeat(20),
      amount: "2000000",
      callData: "0x",
      rationale: "Legit payment.",
    },
    nonce: 0,
  };
}

describe("validateDecisionTrace", () => {
  it("accepts a valid DecisionTrace", () => {
    expect(() => validateDecisionTrace(makeTrace())).not.toThrow();
  });

  it("rejects malformed address-like fields", () => {
    expect(() =>
      validateDecisionTrace({
        ...makeTrace(),
        owner: "not-an-address",
      } as DecisionTrace)
    ).toThrow(DecisionTraceValidationError);
  });

  it("rejects malformed amount strings", () => {
    expect(() =>
      validateDecisionTrace({
        ...makeTrace(),
        proposedAction: {
          ...makeTrace().proposedAction,
          amount: "2.5",
        },
      })
    ).toThrow(/amount/i);
  });
});

describe("schema exports", () => {
  it("exports the frozen schema path", () => {
    expect(DECISION_TRACE_SCHEMA_PATH).toBe(
      "packages/trace/schema/decision-trace-v1.schema.json"
    );
  });
});
