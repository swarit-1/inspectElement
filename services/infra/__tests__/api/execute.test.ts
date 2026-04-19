import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createExecuteRouter } from "../../src/api/execute.js";
import { errorMiddleware } from "../../src/api/errors.js";

describe("POST /v1/execute", () => {
  function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use("/v1/execute", createExecuteRouter());
    app.use(errorMiddleware);
    return app;
  }

  it("accepts a valid execution request body", async () => {
    const body = {
      owner: "0x" + "22".repeat(20),
      agentId: "0x" + "11".repeat(32),
      target: "0x" + "44".repeat(20),
      token: "0x" + "55".repeat(20),
      amount: "2000000",
      data: "0x",
      trace: {
        schemaVersion: "1.0.0",
        agentId: "0x" + "11".repeat(32),
        owner: "0x" + "22".repeat(20),
        intentHash: "0x" + "33".repeat(32),
        session: { id: "api-test", startedAt: 1700000000, model: "test", temperature: 0 },
        prompts: [{ role: "user", content: "Pay merchant", timestamp: 1700000001 }],
        toolCalls: [],
        observations: [],
        proposedAction: {
          target: "0x" + "44".repeat(20),
          token: "0x" + "55".repeat(20),
          amount: "2000000",
          callData: "0x",
          rationale: "API payment",
        },
        nonce: 0,
      },
    };

    const res = await request(createTestApp())
      .post("/v1/execute")
      .send(body)
      .expect(200);

    expect(res.body).toHaveProperty("status");
    expect(["accepted", "rejected"]).toContain(res.body.status);
  });

  it("returns 400 when required fields are missing", async () => {
    // Missing owner, agentId, target, etc.
    const res = await request(createTestApp())
      .post("/v1/execute")
      .send({ amount: "2000000" })
      .expect(400);

    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 for invalid owner address format", async () => {
    const body = {
      owner: "not-an-address",
      agentId: "0x" + "11".repeat(32),
      target: "0x" + "44".repeat(20),
      token: "0x" + "55".repeat(20),
      amount: "2000000",
      data: "0x",
      trace: {},
    };

    await request(createTestApp())
      .post("/v1/execute")
      .send(body)
      .expect(400);
  });

  it("returns preflight result with decision and reasonCode", async () => {
    const body = {
      owner: "0x" + "22".repeat(20),
      agentId: "0x" + "11".repeat(32),
      target: "0x" + "44".repeat(20),
      token: "0x" + "55".repeat(20),
      amount: "2000000",
      data: "0x",
      trace: {
        schemaVersion: "1.0.0",
        agentId: "0x" + "11".repeat(32),
        owner: "0x" + "22".repeat(20),
        intentHash: "0x" + "33".repeat(32),
        session: { id: "api-test", startedAt: 1700000000, model: "test", temperature: 0 },
        prompts: [{ role: "user", content: "Pay merchant", timestamp: 1700000001 }],
        toolCalls: [],
        observations: [],
        proposedAction: {
          target: "0x" + "44".repeat(20),
          token: "0x" + "55".repeat(20),
          amount: "2000000",
          callData: "0x",
          rationale: "API payment",
        },
        nonce: 0,
      },
    };

    const res = await request(createTestApp())
      .post("/v1/execute")
      .send(body)
      .expect(200);

    expect(res.body).toHaveProperty("preflight");
    expect(res.body.preflight).toHaveProperty("decision");
    expect(res.body.preflight).toHaveProperty("reasonCode");
  });

  it("returns structured error when execution is rejected", async () => {
    // Missing trace — should result in validation error
    const body = {
      owner: "0x" + "22".repeat(20),
      agentId: "0x" + "11".repeat(32),
      target: "0x" + "44".repeat(20),
      token: "0x" + "55".repeat(20),
      amount: "2000000",
      data: "0x",
    };

    const res = await request(createTestApp())
      .post("/v1/execute")
      .send(body)
      .expect(400);

    expect(res.body).toHaveProperty("error");
  });
});
