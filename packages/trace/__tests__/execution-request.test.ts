import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import type { DecisionTrace, TraceAck } from "../src/index.js";
import { buildExecutionRequest, prepareLiveTrace } from "../src/index.js";

function makeTrace(): DecisionTrace {
  return {
    schemaVersion: "1.0.0",
    agentId: "0x" + "11".repeat(32),
    owner: "0x" + "22".repeat(20),
    intentHash: "0x" + "33".repeat(32),
    session: {
      id: "demo-session",
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

const TRACE_ACK: TraceAck = {
  contextDigest: ("0x" + "aa".repeat(32)) as `0x${string}`,
  uriHash: ("0x" + "bb".repeat(32)) as `0x${string}`,
  expiresAt: 1_700_000_999,
  signature: ("0x" + "cc".repeat(65)) as `0x${string}`,
};

describe("prepareLiveTrace", () => {
  it("overrides the live execution fields while preserving the rest of the trace", () => {
    const base = makeTrace();

    const live = prepareLiveTrace(base, {
      owner: "0x1234567890123456789012345678901234567890",
      agentId: ("0x" + "99".repeat(32)) as `0x${string}`,
      target: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      token: "0x0000000000000000000000000000000000000001",
      amount: "15000000",
    });

    expect(live.owner).toBe("0x1234567890123456789012345678901234567890");
    expect(live.agentId).toBe(("0x" + "99".repeat(32)) as `0x${string}`);
    expect(live.proposedAction.target).toBe(
      getAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd")
    );
    expect(live.proposedAction.token).toBe(
      getAddress("0x0000000000000000000000000000000000000001")
    );
    expect(live.proposedAction.amount).toBe("15000000");
    expect(live.session).toEqual(base.session);
    expect(live.prompts).toEqual(base.prompts);
  });
});

describe("buildExecutionRequest", () => {
  it("normalizes addresses and amount and defaults data to 0x", () => {
    const req = buildExecutionRequest({
      owner: "0x1234567890123456789012345678901234567890",
      agentId: ("0x" + "77".repeat(32)) as `0x${string}`,
      target: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      token: "0x0000000000000000000000000000000000000001",
      amount: "2000000",
      traceURI: "ipfs://trace/demo",
      traceAck: TRACE_ACK,
    });

    expect(req.owner).toBe("0x1234567890123456789012345678901234567890");
    expect(req.target).toBe(
      getAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd")
    );
    expect(req.amount).toBe(2_000_000n);
    expect(req.data).toBe("0x");
    expect(req.traceAck).toBe(TRACE_ACK);
  });

  it("accepts bigint amounts", () => {
    const req = buildExecutionRequest({
      owner: "0x1234567890123456789012345678901234567890",
      agentId: ("0x" + "77".repeat(32)) as `0x${string}`,
      target: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      token: "0x0000000000000000000000000000000000000001",
      amount: 15_000_000n,
      traceURI: "ipfs://trace/demo",
      traceAck: TRACE_ACK,
      data: "0xdeadbeef",
    });

    expect(req.amount).toBe(15_000_000n);
    expect(req.data).toBe("0xdeadbeef");
  });

  it("rejects blank trace URIs", () => {
    expect(() =>
      buildExecutionRequest({
        owner: "0x1234567890123456789012345678901234567890",
        agentId: ("0x" + "77".repeat(32)) as `0x${string}`,
        target: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        token: "0x0000000000000000000000000000000000000001",
        amount: "2000000",
        traceURI: "   ",
        traceAck: TRACE_ACK,
      })
    ).toThrow(/traceURI/i);
  });

  it("rejects non-integer amount strings", () => {
    expect(() =>
      buildExecutionRequest({
        owner: "0x1234567890123456789012345678901234567890",
        agentId: ("0x" + "77".repeat(32)) as `0x${string}`,
        target: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        token: "0x0000000000000000000000000000000000000001",
        amount: "20.5",
        traceURI: "ipfs://trace/demo",
        traceAck: TRACE_ACK,
      })
    ).toThrow(/amount/i);
  });
});
