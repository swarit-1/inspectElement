import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  computeContextDigest,
  serializeCanonical,
  type DecisionTrace,
} from "../src/index.js";

const PYTHON_HELPER = "packages/trace/python/trace.py";

function makeTrace(): DecisionTrace {
  return {
    schemaVersion: "1.0.0",
    agentId: "0x" + "ab".repeat(32),
    owner: "0x" + "cd".repeat(20),
    intentHash: "0x" + "ef".repeat(32),
    session: {
      id: "cross-language-trace",
      startedAt: 1700000000,
      model: "claude-sonnet-4-20250514",
      temperature: 0,
    },
    prompts: [
      {
        role: "system",
        content: "You are a payment agent.\nPreserve exact line endings.",
        timestamp: 1700000000,
      },
      {
        role: "user",
        content: "Pay 2 USDC to the merchant.",
        timestamp: 1700000001,
      },
    ],
    toolCalls: [
      {
        name: "check_balance",
        input: { token: "USDC", metadata: { decimals: 6 } },
        output: { balance: "100000000" },
        timestamp: 1700000002,
      },
    ],
    observations: [
      {
        source: "balance_checker",
        content: "Sufficient USDC balance confirmed.",
        timestamp: 1700000003,
      },
    ],
    proposedAction: {
      target: "0x" + "11".repeat(20),
      token: "0x" + "22".repeat(20),
      amount: "2000000",
      callData: "0x",
      rationale: "User requested a payment to an allowlisted merchant.",
    },
    nonce: 7,
  };
}

describe("trace.py parity", () => {
  it("matches TypeScript canonical serialization", () => {
    const trace = makeTrace();
    const pythonCanonical = runPythonHelper("canonical", trace);
    expect(pythonCanonical).toBe(serializeCanonical(trace));
  });

  it("matches TypeScript contextDigest generation", () => {
    const trace = makeTrace();
    const pythonDigest = runPythonHelper("digest", trace);
    expect(pythonDigest).toBe(computeContextDigest(trace));
  });
});

function runPythonHelper(
  mode: "canonical" | "digest",
  trace: DecisionTrace
): string {
  return execFileSync("python3", [PYTHON_HELPER, mode], {
    cwd: process.cwd(),
    input: JSON.stringify(trace),
    encoding: "utf8",
  }).trim();
}
