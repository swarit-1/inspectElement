import { describe, it, expect } from "vitest";
import {
  serializeCanonical,
  computeContextDigest,
  type DecisionTrace,
} from "../src/index.js";

function makeTrace(overrides: Partial<DecisionTrace> = {}): DecisionTrace {
  return {
    schemaVersion: "1.0.0",
    agentId: "0x" + "ab".repeat(32),
    owner: "0x" + "cd".repeat(20),
    intentHash: "0x" + "ef".repeat(32),
    session: {
      id: "test-session-001",
      startedAt: 1700000000,
      model: "claude-sonnet-4-20250514",
      temperature: 0,
    },
    prompts: [
      {
        role: "system",
        content: "You are a payment agent.",
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
        input: { token: "USDC" },
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
      rationale: "User requested 2 USDC payment to allowlisted merchant.",
    },
    nonce: 0,
    ...overrides,
  };
}

describe("serializeCanonical", () => {
  it("produces valid JSON", () => {
    const trace = makeTrace();
    const json = serializeCanonical(trace);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("sorts keys alphabetically at every depth", () => {
    const trace = makeTrace();
    const json = serializeCanonical(trace);
    const parsed = JSON.parse(json);

    // Top-level keys must be sorted
    const topKeys = Object.keys(parsed);
    expect(topKeys).toEqual([...topKeys].sort());

    // Session keys must be sorted
    const sessionKeys = Object.keys(parsed.session);
    expect(sessionKeys).toEqual([...sessionKeys].sort());

    // ProposedAction keys must be sorted
    const actionKeys = Object.keys(parsed.proposedAction);
    expect(actionKeys).toEqual([...actionKeys].sort());
  });

  it("contains no whitespace outside string values", () => {
    const trace = makeTrace();
    const json = serializeCanonical(trace);

    // Remove all string values and check no whitespace remains
    // Simple check: the canonical output should not have ": " or ", "
    expect(json).not.toContain(": ");
    expect(json).not.toContain(", ");
    // No newlines or tabs
    expect(json).not.toMatch(/[\n\t\r]/);
  });

  it("preserves array insertion order", () => {
    const trace = makeTrace({
      prompts: [
        { role: "user", content: "first", timestamp: 1 },
        { role: "system", content: "second", timestamp: 2 },
        { role: "assistant", content: "third", timestamp: 3 },
      ],
    });
    const json = serializeCanonical(trace);
    const parsed = JSON.parse(json);

    expect(parsed.prompts[0].content).toBe("first");
    expect(parsed.prompts[1].content).toBe("second");
    expect(parsed.prompts[2].content).toBe("third");
  });

  it("preserves line endings in string values", () => {
    const trace = makeTrace({
      prompts: [
        {
          role: "user",
          content: "line one\nline two\r\nline three",
          timestamp: 1700000000,
        },
      ],
    });
    const json = serializeCanonical(trace);
    const parsed = JSON.parse(json);
    expect(parsed.prompts[0].content).toBe(
      "line one\nline two\r\nline three"
    );
  });

  it("handles empty arrays", () => {
    const trace = makeTrace({
      toolCalls: [],
      observations: [],
    });
    const json = serializeCanonical(trace);
    const parsed = JSON.parse(json);
    expect(parsed.toolCalls).toEqual([]);
    expect(parsed.observations).toEqual([]);
  });

  it("handles unicode content", () => {
    const trace = makeTrace({
      prompts: [
        {
          role: "user",
          content: "Pay 2 USDC to merchant \u2014 urgent! \u{1F4B0}",
          timestamp: 1700000000,
        },
      ],
    });
    const json = serializeCanonical(trace);
    const parsed = JSON.parse(json);
    expect(parsed.prompts[0].content).toContain("\u2014");
  });

  it("rejects non-integer numbers anywhere in the trace", () => {
    const trace = makeTrace({
      session: {
        id: "fractional-temperature",
        startedAt: 1700000000,
        model: "claude-sonnet-4-20250514",
        temperature: 0.5,
      },
    });

    expect(() => serializeCanonical(trace)).toThrow(/Invalid number/i);
  });
});

describe("computeContextDigest", () => {
  it("returns a 0x-prefixed 66-char hex string (bytes32)", () => {
    const trace = makeTrace();
    const digest = computeContextDigest(trace);
    expect(digest).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("produces identical digest for identical traces", () => {
    const trace = makeTrace();
    const d1 = computeContextDigest(trace);
    const d2 = computeContextDigest(trace);
    expect(d1).toBe(d2);
  });

  it("produces different digests for different traces", () => {
    const trace1 = makeTrace({ nonce: 0 });
    const trace2 = makeTrace({ nonce: 1 });
    expect(computeContextDigest(trace1)).not.toBe(
      computeContextDigest(trace2)
    );
  });

  it("is deterministic across 100 runs", () => {
    const traces: DecisionTrace[] = [];

    // Generate 100 traces with varying content
    for (let i = 0; i < 100; i++) {
      traces.push(
        makeTrace({
          nonce: i,
          session: {
            id: `session-${i}`,
            startedAt: 1700000000 + i,
            model: "claude-sonnet-4-20250514",
            temperature: 0,
          },
          prompts: [
            {
              role: "user",
              content: `Pay ${i + 1} USDC to merchant-${i}`,
              timestamp: 1700000000 + i,
            },
          ],
          proposedAction: {
            target: "0x" + i.toString(16).padStart(40, "0"),
            token: "0x" + "22".repeat(20),
            amount: String((i + 1) * 1000000),
            callData: "0x",
            rationale: `Payment ${i + 1}`,
          },
        })
      );
    }

    // Compute digests twice and verify they match
    const digestsRun1 = traces.map((t) => computeContextDigest(t));
    const digestsRun2 = traces.map((t) => computeContextDigest(t));

    for (let i = 0; i < 100; i++) {
      expect(digestsRun1[i]).toBe(digestsRun2[i]);
    }

    // Also verify serialization is identical
    const serRun1 = traces.map((t) => serializeCanonical(t));
    const serRun2 = traces.map((t) => serializeCanonical(t));

    for (let i = 0; i < 100; i++) {
      expect(serRun1[i]).toBe(serRun2[i]);
    }
  });

  it("changes when any field changes", () => {
    const base = makeTrace();
    const baseDigest = computeContextDigest(base);

    // Change agentId
    expect(computeContextDigest(makeTrace({ agentId: "0x" + "ff".repeat(32) }))).not.toBe(baseDigest);

    // Change owner
    expect(computeContextDigest(makeTrace({ owner: "0x" + "ff".repeat(20) }))).not.toBe(baseDigest);

    // Change proposedAction amount
    expect(
      computeContextDigest(
        makeTrace({
          proposedAction: {
            ...base.proposedAction,
            amount: "9999999",
          },
        })
      )
    ).not.toBe(baseDigest);
  });
});
