import "./setup.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import {
  getAddress,
  hashMessage,
  keccak256,
  recoverAddress,
  stringToBytes,
  type Address,
  type Hex,
} from "viem";
import type { Express } from "express";
import { canonicalize, type CanonicalValue } from "../src/canonical/json.js";
import { closeDb } from "../src/store/db.js";
import { Signer } from "../src/signer/index.js";
import {
  serializeCanonical,
  computeContextDigest,
} from "../../../packages/trace/src/index.js";
import type { DecisionTrace } from "../../../packages/trace/src/index.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let app: Express;

beforeAll(async () => {
  const mod = await import("../src/api/app.js");
  app = mod.createApp();
});

afterAll(() => {
  closeDb();
});

function loadFixtureTrace(name: "legit" | "blocked" | "overspend"): DecisionTrace {
  const path = resolve(__dirname, "../../../fixtures", `${name}.json`);
  return (JSON.parse(readFileSync(path, "utf-8")) as { trace: DecisionTrace }).trace;
}

describe("POST /v1/manifests", () => {
  it("returns a stable intentHash and pins canonical bytes", async () => {
    const body = {
      owner: getAddress("0xdeadbeef00000000000000000000000000000001"),
      token: getAddress("0xca11000000000000000000000000000000000002"),
      maxSpendPerTx: "10000000",
      maxSpendPerDay: "50000000",
      allowedCounterparties: [
        getAddress("0x0000000000000000000000000000000000000111"),
        getAddress("0x0000000000000000000000000000000000000222"),
        getAddress("0x0000000000000000000000000000000000000333"),
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
        token: getAddress("0xca11000000000000000000000000000000000002"),
        maxSpendPerTx: "10000000",
        maxSpendPerDay: "50000000",
        allowedCounterparties: [getAddress("0x0000000000000000000000000000000000000111")],
        expiry: "2000000000",
        nonce: "1",
      });
    expect(res.status).toBe(400);
  });
});

describe("POST /v1/traces — both trace shapes accepted", () => {
  it("accepts the OBJECT shape (hand-rolled clients) and signs an EIP-712 TraceAck", async () => {
    const trace = {
      schemaVersion: "1.0.0",
      agentId: "0x" + "ab".repeat(32),
      owner: getAddress("0xdeadbeef00000000000000000000000000000001"),
      proposedAction: {
        amount: "15000000",
        target: getAddress("0x0000000000000000000000000000000000000111"),
        token: getAddress("0xca11000000000000000000000000000000000002"),
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
    expect(ok.body.signer).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(ok.body.guardedExecutor).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(typeof ok.body.chainId).toBe("number");
    expect(ok.body.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(ok.body.uriHash).toBe(keccak256(stringToBytes(ok.body.traceURI)));
  });

  it("accepts the STRING shape that Dev 2's uploadTrace sends (Tier 0c regression)", async () => {
    const trace = loadFixtureTrace("legit");
    const canonical = serializeCanonical(trace);
    const contextDigest = computeContextDigest(trace);

    const res = await request(app).post("/v1/traces").send({
      agentId: trace.agentId,
      owner: trace.owner,
      contextDigest,
      trace: canonical,
    });
    expect(res.status).toBe(200);
    expect(res.body.contextDigest).toBe(contextDigest);
    expect(res.body.signer).toMatch(/^0x[0-9a-fA-F]{40}$/);

    const recovered = await recoverAddress({
      hash: Signer.traceAckDigest(
        {
          contextDigest,
          uriHash: res.body.uriHash,
          expiresAt: BigInt(res.body.expiresAt),
          agentId: trace.agentId as Hex,
          owner: trace.owner as Address,
        },
        {
          guardedExecutor: res.body.guardedExecutor,
          chainId: res.body.chainId,
        },
      ),
      signature: res.body.signature,
    });
    expect(recovered.toLowerCase()).toBe((res.body.signer as string).toLowerCase());
  });

  it("is idempotent: posting the same trace twice returns the same TraceAck", async () => {
    const trace = loadFixtureTrace("overspend");
    const canonical = serializeCanonical(trace);
    const contextDigest = computeContextDigest(trace);

    const first = await request(app).post("/v1/traces").send({
      agentId: trace.agentId,
      owner: trace.owner,
      contextDigest,
      trace: canonical,
    });
    const second = await request(app).post("/v1/traces").send({
      agentId: trace.agentId,
      owner: trace.owner,
      contextDigest,
      trace: canonical,
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.traceURI).toBe(second.body.traceURI);
    expect(first.body.signature).toBe(second.body.signature);
    expect(first.body.expiresAt).toBe(second.body.expiresAt);
  });

  it("rejects missing agentId / owner (now required for EIP-712 binding)", async () => {
    const res = await request(app).post("/v1/traces").send({
      contextDigest: "0x" + "11".repeat(32),
      trace: { foo: "bar" },
    });
    expect(res.status).toBe(400);
  });

  it("rejects mismatched contextDigest from object trace", async () => {
    const res = await request(app)
      .post("/v1/traces")
      .send({
        agentId: "0x" + "00".repeat(32),
        owner: getAddress("0x000000000000000000000000000000000000beef"),
        contextDigest: "0x" + "11".repeat(32),
        trace: { foo: "bar" },
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

describe("POST /v1/reviewer/resolve", () => {
  it("returns a recoverable EIP-191 reviewer signature bound to arbiter+chainId", async () => {
    const res = await request(app).post("/v1/reviewer/resolve").send({
      challengeId: "42",
      uphold: true,
      slashAmount: "15000000",
    });
    expect(res.status).toBe(200);
    expect(res.body.signature).toMatch(/^0x[0-9a-f]{130}$/);
    expect(res.body.signer).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(res.body.calldata).toMatch(/^0x[0-9a-f]+$/);

    const recovered = await recoverAddress({
      hash: hashMessage({ raw: res.body.digest as Hex }),
      signature: res.body.signature as Hex,
    });
    expect(recovered.toLowerCase()).toBe((res.body.signer as string).toLowerCase());
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
