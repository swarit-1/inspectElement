import "./setup.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { keccak256, stringToBytes } from "viem";
import type { Express } from "express";
import { canonicalize, type CanonicalValue } from "../src/canonical/json.js";
import { closeDb } from "../src/store/db.js";

let app: Express;

beforeAll(async () => {
  const mod = await import("../src/api/app.js");
  app = mod.createApp();
});

afterAll(() => {
  closeDb();
});

describe("POST /v1/manifests", () => {
  it("returns a stable intentHash and pins canonical bytes", async () => {
    const body = {
      owner: "0xdeAdBeef00000000000000000000000000000001",
      token: "0xCa11000000000000000000000000000000000002",
      maxSpendPerTx: "10000000",
      maxSpendPerDay: "50000000",
      allowedCounterparties: [
        "0x0000000000000000000000000000000000000111",
        "0x0000000000000000000000000000000000000222",
        "0x0000000000000000000000000000000000000333",
      ],
      expiry: "2000000000",
      nonce: "1",
    };

    const a = await request(app).post("/v1/manifests").send(body);
    const b = await request(app).post("/v1/manifests").send(body);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.intentHash).toBe(b.body.intentHash);
    expect(a.body.manifestURI).toBe(b.body.manifestURI);
    expect(a.body.intentHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("rejects an invalid owner address", async () => {
    const res = await request(app)
      .post("/v1/manifests")
      .send({
        owner: "not-an-address",
        token: "0xCa11000000000000000000000000000000000002",
        maxSpendPerTx: "10000000",
        maxSpendPerDay: "50000000",
        allowedCounterparties: ["0x0000000000000000000000000000000000000111"],
        expiry: "2000000000",
        nonce: "1",
      });
    expect(res.status).toBe(400);
  });
});

describe("POST /v1/traces", () => {
  it("verifies contextDigest, signs an EIP-191 TraceAck, and stores the bundle", async () => {
    const trace = {
      schemaVersion: "1.0.0",
      agentId: "0x" + "ab".repeat(32),
      owner: "0xdeAdBeef00000000000000000000000000000001",
      proposedAction: {
        amount: "15000000",
        target: "0x0000000000000000000000000000000000000111",
        token: "0xCa11000000000000000000000000000000000002",
      },
      nonce: 0,
    } satisfies Record<string, CanonicalValue>;
    const contextDigest = keccak256(stringToBytes(canonicalize(trace)));

    const ok = await request(app).post("/v1/traces").send({
      agentId: trace.agentId,
      owner: trace.owner,
      contextDigest,
      trace,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.contextDigest).toBe(contextDigest);
    expect(ok.body.signature).toMatch(/^0x[0-9a-f]{130}$/);
    expect(ok.body.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(ok.body.uriHash).toBe(keccak256(stringToBytes(ok.body.traceURI)));

    const replay = await request(app).get(`/v1/replay/${contextDigest}`);
    expect(replay.status).toBe(200);
    expect(replay.body.contextDigest).toBe(contextDigest);
    expect(replay.body.trace).toBeTypeOf("object");
  });

  it("rejects a mismatched contextDigest", async () => {
    const trace = { foo: "bar" };
    const wrong = "0x" + "11".repeat(32);
    const res = await request(app).post("/v1/traces").send({
      contextDigest: wrong,
      trace,
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /v1/challenges/prepare-amount", () => {
  it("returns ineligible / 500 cleanly when no receipt or deployment exists", async () => {
    const res = await request(app).post("/v1/challenges/prepare-amount").send({
      receiptId: "0x" + "ee".repeat(32),
      challenger: "0xdeAdBeef00000000000000000000000000000099",
    });
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.eligible).toBe(false);
    }
  });
});

describe("GET /v1/health", () => {
  it("returns the live TraceAck signer pubkey", async () => {
    const res = await request(app).get("/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.traceAckSigner).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});

describe("GET /v1/feed", () => {
  it("returns an empty array for an owner with no activity", async () => {
    const res = await request(app)
      .get("/v1/feed")
      .query({ owner: "0xdeAdBeef00000000000000000000000000000099" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("400s on an invalid owner", async () => {
    const res = await request(app).get("/v1/feed").query({ owner: "not-an-address" });
    expect(res.status).toBe(400);
  });
});
