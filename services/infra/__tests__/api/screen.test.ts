import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createScreenRouter } from "../../src/api/screen.js";
import { errorMiddleware } from "../../src/api/errors.js";
import type { ScreeningProvider, ScreeningResult, SummaryContext, IncidentSummary } from "../../src/screening/types.js";

// Mock the store module
vi.mock("../../src/store/traces.js", () => ({
  getTraceByDigest: vi.fn(),
}));

import { getTraceByDigest } from "../../src/store/traces.js";

const mockGetTraceByDigest = vi.mocked(getTraceByDigest);

function makeMockProvider(): ScreeningProvider {
  return {
    async screenTrace(traceJson: string): Promise<ScreeningResult> {
      return {
        injectionScore: 42,
        signals: [],
        explanation: "Test screening result",
        advisory: true,
        screenedAt: new Date().toISOString(),
      };
    },
    async summarize(_ctx: SummaryContext): Promise<IncidentSummary> {
      return {
        bullets: ["Test bullet"],
        summary: "Test summary",
        advisory: true,
        generatedAt: new Date().toISOString(),
      };
    },
  };
}

function createTestApp(provider?: ScreeningProvider) {
  const app = express();
  app.use(express.json());
  app.use("/v1/screen", createScreenRouter(provider ?? makeMockProvider()));
  app.use(errorMiddleware);
  return app;
}

describe("POST /v1/screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with screening result for valid contextDigest", async () => {
    const contextDigest = "0x" + "ab".repeat(32);
    mockGetTraceByDigest.mockResolvedValueOnce({
      contextDigest: contextDigest as `0x${string}`,
      traceUri: "ipfs://test",
      uriHash: "0x" + "cc".repeat(32) as `0x${string}`,
      agentId: "0x" + "11".repeat(32) as `0x${string}`,
      owner: "0x" + "22".repeat(20) as `0x${string}`,
      traceJson: JSON.stringify({ prompts: [], toolCalls: [] }),
      expiresAt: BigInt(Date.now() + 600000),
      signer: "0x" + "33".repeat(20) as `0x${string}`,
      signature: "0x" + "44".repeat(65) as `0x${string}`,
      createdAt: Math.floor(Date.now() / 1000),
    });

    const res = await request(createTestApp())
      .post("/v1/screen")
      .send({ contextDigest })
      .expect(200);

    expect(res.body).toHaveProperty("injectionScore");
    expect(res.body).toHaveProperty("signals");
    expect(res.body).toHaveProperty("explanation");
    expect(res.body).toHaveProperty("advisory", true);
    expect(res.body).toHaveProperty("screenedAt");
  });

  it("returns 400 for invalid contextDigest format", async () => {
    await request(createTestApp())
      .post("/v1/screen")
      .send({ contextDigest: "not-a-hex" })
      .expect(400);
  });

  it("returns 400 when contextDigest is missing", async () => {
    await request(createTestApp())
      .post("/v1/screen")
      .send({})
      .expect(400);
  });

  it("returns 404 when trace not found", async () => {
    const contextDigest = "0x" + "ab".repeat(32);
    mockGetTraceByDigest.mockResolvedValueOnce(null);

    await request(createTestApp())
      .post("/v1/screen")
      .send({ contextDigest })
      .expect(404);
  });

  it("response shape matches ScreeningResult interface", async () => {
    const contextDigest = "0x" + "ab".repeat(32);
    mockGetTraceByDigest.mockResolvedValueOnce({
      contextDigest: contextDigest as `0x${string}`,
      traceUri: "ipfs://test",
      uriHash: "0x" + "cc".repeat(32) as `0x${string}`,
      agentId: "0x" + "11".repeat(32) as `0x${string}`,
      owner: "0x" + "22".repeat(20) as `0x${string}`,
      traceJson: JSON.stringify({ prompts: [{ role: "user", content: "test", timestamp: 0 }] }),
      expiresAt: BigInt(Date.now() + 600000),
      signer: "0x" + "33".repeat(20) as `0x${string}`,
      signature: "0x" + "44".repeat(65) as `0x${string}`,
      createdAt: Math.floor(Date.now() / 1000),
    });

    const res = await request(createTestApp())
      .post("/v1/screen")
      .send({ contextDigest })
      .expect(200);

    expect(typeof res.body.injectionScore).toBe("number");
    expect(Array.isArray(res.body.signals)).toBe(true);
    expect(typeof res.body.explanation).toBe("string");
    expect(res.body.advisory).toBe(true);
    expect(typeof res.body.screenedAt).toBe("string");
  });
});
