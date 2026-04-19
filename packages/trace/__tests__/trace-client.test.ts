import { afterEach, describe, expect, it, vi } from "vitest";
import type { DecisionTrace } from "../src/index.js";
import {
  TraceDigestMismatchError,
  TraceUploadError,
  toTraceAck,
  uploadTrace,
} from "../src/index.js";
import { computeContextDigest } from "../src/digest.js";

function makeTrace(): DecisionTrace {
  return {
    schemaVersion: "1.0.0",
    agentId: "0x" + "11".repeat(32),
    owner: "0x" + "22".repeat(20),
    intentHash: "0x" + "33".repeat(32),
    session: {
      id: "trace-upload-test",
      startedAt: 1700000000,
      model: "claude-sonnet-4-20250514",
      temperature: 0,
    },
    prompts: [
      {
        role: "user",
        content: "Pay 2 USDC to the merchant.",
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("uploadTrace", () => {
  it("posts the canonical trace payload and returns a validated ack response", async () => {
    const trace = makeTrace();
    const contextDigest = computeContextDigest(trace);
    const json = vi.fn().mockResolvedValue({
      traceURI: "ipfs://trace/demo",
      contextDigest,
      uriHash: ("0x" + "aa".repeat(32)) as `0x${string}`,
      expiresAt: 1_700_000_999,
      signature: ("0x" + "bb".repeat(65)) as `0x${string}`,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadTrace(trace, "http://localhost:8787");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8787/v1/traces",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      agentId: string;
      owner: string;
      contextDigest: string;
      trace: Record<string, unknown>;
    };

    expect(body.agentId).toBe(trace.agentId);
    expect(body.owner).toBe(trace.owner);
    expect(body.contextDigest).toBe(contextDigest);
    expect(body.trace.proposedAction).toMatchObject({
      amount: "2000000",
      rationale: "Legit payment.",
    });
    expect(result.contextDigest).toBe(contextDigest);
  });

  it("throws TraceUploadError on non-2xx responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("kaboom"),
      })
    );

    await expect(uploadTrace(makeTrace(), "http://localhost:8787")).rejects.toBeInstanceOf(
      TraceUploadError
    );
  });

  it("throws TraceDigestMismatchError when infra returns a different digest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          traceURI: "ipfs://trace/demo",
          contextDigest: ("0x" + "ff".repeat(32)) as `0x${string}`,
          uriHash: ("0x" + "aa".repeat(32)) as `0x${string}`,
          expiresAt: 1_700_000_999,
          signature: ("0x" + "bb".repeat(65)) as `0x${string}`,
        }),
      })
    );

    await expect(uploadTrace(makeTrace(), "http://localhost:8787")).rejects.toBeInstanceOf(
      TraceDigestMismatchError
    );
  });
});

describe("toTraceAck", () => {
  it("converts a validated upload response into the ExecutionRequest struct shape", () => {
    const ack = toTraceAck({
      traceURI: "ipfs://trace/demo",
      contextDigest: ("0x" + "11".repeat(32)) as `0x${string}`,
      uriHash: ("0x" + "22".repeat(32)) as `0x${string}`,
      expiresAt: 1_700_000_999,
      signature: ("0x" + "33".repeat(65)) as `0x${string}`,
    });

    expect(ack).toEqual({
      contextDigest: ("0x" + "11".repeat(32)) as `0x${string}`,
      uriHash: ("0x" + "22".repeat(32)) as `0x${string}`,
      expiresAt: 1_700_000_999,
      signature: ("0x" + "33".repeat(65)) as `0x${string}`,
    });
  });
});
