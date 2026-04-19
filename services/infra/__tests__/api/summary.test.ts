import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createSummaryRouter } from "../../src/api/summary.js";
import { errorMiddleware } from "../../src/api/errors.js";
import type { ScreeningProvider, ScreeningResult, SummaryContext, IncidentSummary } from "../../src/screening/types.js";

// Mock the store modules
vi.mock("../../src/store/receipts.js", () => ({
  getReceipt: vi.fn(),
}));

vi.mock("../../src/store/traces.js", () => ({
  getTraceByDigest: vi.fn(),
}));

vi.mock("../../src/store/challenges.js", () => ({
  getChallenge: vi.fn(),
  findChallengeByReceipt: vi.fn(),
}));

import { getReceipt } from "../../src/store/receipts.js";
import { getTraceByDigest } from "../../src/store/traces.js";
import { getChallenge, findChallengeByReceipt } from "../../src/store/challenges.js";

const mockGetReceipt = vi.mocked(getReceipt);
const mockGetTraceByDigest = vi.mocked(getTraceByDigest);
const mockGetChallenge = vi.mocked(getChallenge);
const mockFindChallengeByReceipt = vi.mocked(findChallengeByReceipt);

function makeMockProvider(): ScreeningProvider {
  return {
    async screenTrace(): Promise<ScreeningResult> {
      return {
        injectionScore: 0,
        signals: [],
        explanation: "",
        advisory: true,
        screenedAt: new Date().toISOString(),
      };
    },
    async summarize(ctx: SummaryContext): Promise<IncidentSummary> {
      const bullets = [
        `Payment of ${ctx.receipt.amount} to ${ctx.receipt.target.slice(0, 10)}.`,
        ctx.trace ? "Trace evidence available." : "No trace available.",
      ];
      if (ctx.challenge) {
        bullets.push(`Challenge status: ${ctx.challenge.status}.`);
      }
      return {
        bullets,
        summary: bullets.join(" "),
        advisory: true,
        generatedAt: new Date().toISOString(),
      };
    },
  };
}

function makeReceiptRow() {
  return {
    receiptId: "0x" + "aa".repeat(32) as `0x${string}`,
    owner: "0x" + "22".repeat(20) as `0x${string}`,
    agentId: "0x" + "11".repeat(32) as `0x${string}`,
    intentHash: "0x" + "33".repeat(32) as `0x${string}`,
    target: "0x" + "44".repeat(20) as `0x${string}`,
    token: "0x" + "55".repeat(20) as `0x${string}`,
    amount: BigInt(2000000),
    callDataHash: "0x" + "66".repeat(32) as `0x${string}`,
    contextDigest: "0x" + "77".repeat(32) as `0x${string}`,
    nonce: BigInt(0),
    ts: 1700000100,
    traceUri: "ipfs://trace1",
    blockNumber: 100,
    txHash: "0x" + "88".repeat(32) as `0x${string}`,
    logIndex: 0,
    createdAt: 1700000100,
  };
}

function createTestApp(provider?: ScreeningProvider) {
  const app = express();
  app.use(express.json());
  app.use("/v1", createSummaryRouter(provider ?? makeMockProvider()));
  app.use(errorMiddleware);
  return app;
}

describe("GET /v1/receipts/:receiptId/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns advisory summary for valid receipt", async () => {
    const receipt = makeReceiptRow();
    mockGetReceipt.mockResolvedValueOnce(receipt);
    mockGetTraceByDigest.mockResolvedValueOnce({
      contextDigest: receipt.contextDigest,
      traceUri: "ipfs://trace",
      uriHash: "0x" + "cc".repeat(32) as `0x${string}`,
      agentId: receipt.agentId,
      owner: receipt.owner,
      traceJson: JSON.stringify({ prompts: [] }),
      expiresAt: BigInt(Date.now() + 600000),
      signer: "0x" + "99".repeat(20) as `0x${string}`,
      signature: "0x" + "dd".repeat(65) as `0x${string}`,
      createdAt: 1700000000,
    });
    mockFindChallengeByReceipt.mockResolvedValueOnce(null);

    const res = await request(createTestApp())
      .get(`/v1/receipts/${receipt.receiptId}/summary`)
      .expect(200);

    expect(res.body).toHaveProperty("summary");
    expect(res.body).toHaveProperty("bullets");
    expect(res.body).toHaveProperty("advisory", true);
    expect(res.body).toHaveProperty("generatedAt");
  });

  it("returns 404 for unknown receipt", async () => {
    const receiptId = "0x" + "ff".repeat(32);
    mockGetReceipt.mockResolvedValueOnce(null);

    await request(createTestApp())
      .get(`/v1/receipts/${receiptId}/summary`)
      .expect(404);
  });

  it("response always has advisory:true flag", async () => {
    const receipt = makeReceiptRow();
    mockGetReceipt.mockResolvedValueOnce(receipt);
    mockGetTraceByDigest.mockResolvedValueOnce(null);
    mockFindChallengeByReceipt.mockResolvedValueOnce(null);

    const res = await request(createTestApp())
      .get(`/v1/receipts/${receipt.receiptId}/summary`)
      .expect(200);

    expect(res.body.advisory).toBe(true);
  });
});

describe("GET /v1/challenges/:challengeId/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns summary with challenge resolution context", async () => {
    const receipt = makeReceiptRow();
    const challenge = {
      challengeId: "1",
      receiptId: receipt.receiptId,
      status: "UPHELD" as const,
      payout: BigInt(15000000),
      challenger: "0x" + "cc".repeat(20) as `0x${string}`,
      filedAt: 1700000200,
      resolvedAt: 1700000300,
      filedBlock: 200,
      filedTx: "0x" + "dd".repeat(32) as `0x${string}`,
      resolvedBlock: 300,
      resolvedTx: "0x" + "ee".repeat(32) as `0x${string}`,
    };

    mockGetChallenge.mockResolvedValueOnce(challenge);
    mockGetReceipt.mockResolvedValueOnce(receipt);
    mockGetTraceByDigest.mockResolvedValueOnce(null);

    const res = await request(createTestApp())
      .get("/v1/challenges/1/summary")
      .expect(200);

    expect(res.body.advisory).toBe(true);
    expect(res.body.bullets.some((b: string) => /challenge/i.test(b))).toBe(true);
  });

  it("returns 404 for unknown challenge", async () => {
    mockGetChallenge.mockResolvedValueOnce(null);

    await request(createTestApp())
      .get("/v1/challenges/999/summary")
      .expect(404);
  });
});
