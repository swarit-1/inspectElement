import "./setup.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { getAddress, type Address, type Hex } from "viem";
import { closeDb } from "../src/store/db.js";
import { insertManifest } from "../src/store/manifests.js";
import { upsertReceipt } from "../src/store/receipts.js";
import { resolveChallenge, upsertChallengeFiled } from "../src/store/challenges.js";

/**
 * Tier 4 — read-model + challenge-prep coverage.
 *
 * These tests seed the SQLite store directly and assert the API responses
 * conform to the frozen schemas in `schemas/{feed,receipt,challenge}.ts` that
 * Dev 4's dashboard consumes. They also exercise both branches of
 * /v1/challenges/prepare-amount (eligible + ineligible).
 */

const OWNER: Address = getAddress("0xdeadbeef00000000000000000000000000000777");
const AGENT_ID: Hex = ("0x" + "55".repeat(32)) as Hex;
const INTENT_HASH: Hex = ("0x" + "aa".repeat(32)) as Hex;
const RECEIPT_ID_OVERSPEND: Hex = ("0x" + "bb".repeat(32)) as Hex;
const RECEIPT_ID_LEGIT: Hex = ("0x" + "cc".repeat(32)) as Hex;
const TOKEN: Address = getAddress("0x0000000000000000000000000000000000000001");
const TARGET: Address = getAddress("0x0000000000000000000000000000000000000a01");

let app: Express;

beforeAll(async () => {
  const mod = await import("../src/api/app.js");
  app = mod.createApp();

  insertManifest({
    intentHash: INTENT_HASH,
    manifestUri: "ipfs://manifest-test",
    manifestJson: '{"manifest":"test"}',
    owner: OWNER,
    token: TOKEN,
    maxSpendPerTx: 10_000_000n,
    maxSpendPerDay: 50_000_000n,
    expiry: 2_000_000_000n,
    nonce: 1n,
    allowedCounterparties: [TARGET],
  });

  const nowSec = BigInt(Math.floor(Date.now() / 1000));

  upsertReceipt({
    receiptId: RECEIPT_ID_LEGIT,
    owner: OWNER,
    agentId: AGENT_ID,
    intentHash: INTENT_HASH,
    target: TARGET,
    token: TOKEN,
    amount: 2_000_000n,
    callDataHash: ("0x" + "00".repeat(32)) as Hex,
    contextDigest: ("0x" + "01".repeat(32)) as Hex,
    nonce: 0n,
    ts: nowSec,
    blockNumber: 100n,
    txHash: ("0x" + "11".repeat(32)) as Hex,
    logIndex: 1,
  });

  upsertReceipt({
    receiptId: RECEIPT_ID_OVERSPEND,
    owner: OWNER,
    agentId: AGENT_ID,
    intentHash: INTENT_HASH,
    target: TARGET,
    token: TOKEN,
    amount: 15_000_000n,
    callDataHash: ("0x" + "00".repeat(32)) as Hex,
    contextDigest: ("0x" + "02".repeat(32)) as Hex,
    nonce: 1n,
    ts: nowSec,
    blockNumber: 101n,
    txHash: ("0x" + "22".repeat(32)) as Hex,
    logIndex: 2,
  });
});

afterAll(() => {
  closeDb();
});

describe("GET /v1/feed", () => {
  it("returns receipt entries matching the FeedReceiptEntry schema, with overspend flagged challengeable", async () => {
    const res = await request(app).get("/v1/feed").query({ owner: OWNER });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const receipts = (res.body as Array<Record<string, unknown>>).filter(
      (e) => e.type === "receipt",
    );
    expect(receipts.length).toBe(2);

    for (const r of receipts) {
      expect(typeof r.id).toBe("string");
      expect(typeof r.timestamp).toBe("number");
      expect(typeof r.amount).toBe("string");
      expect(typeof r.challengeable).toBe("boolean");
      expect(typeof r.challengeWindowEndsAt).toBe("number");
      expect(r.receiptId).toMatch(/^0x[0-9a-f]{64}$/);
    }

    const overspend = receipts.find((r) => r.amount === "15000000");
    const legit = receipts.find((r) => r.amount === "2000000");
    expect(overspend?.challengeable).toBe(true);
    expect(legit?.challengeable).toBe(false);
  });
});

describe("GET /v1/receipts/:id", () => {
  it("returns ReceiptDetail with challengeable=true for an overspend within the window", async () => {
    const res = await request(app).get(`/v1/receipts/${RECEIPT_ID_OVERSPEND}`);
    expect(res.status).toBe(200);
    expect(res.body.receiptId).toBe(RECEIPT_ID_OVERSPEND);
    expect(res.body.challengeable).toBe(true);
    expect(res.body.challengeFiled).toBe(false);
    expect(typeof res.body.challengeWindowEndsAt).toBe("number");
    expect(res.body.amount).toBe("15000000");
  });

  it("returns 404 for an unknown receipt", async () => {
    const res = await request(app).get(`/v1/receipts/0x${"de".repeat(32)}`);
    expect(res.status).toBe(404);
  });
});

describe("POST /v1/challenges/prepare-amount", () => {
  it("eligible=true for an overspend; returns ChallengeArbiter calldata", async () => {
    const res = await request(app).post("/v1/challenges/prepare-amount").send({
      receiptId: RECEIPT_ID_OVERSPEND,
      challenger: OWNER,
    });
    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(true);
    expect(res.body.reason).toBeNull();
    expect(res.body.bondAmount).toBe("1000000");
    expect(res.body.to).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(res.body.data).toMatch(/^0x[0-9a-f]+$/);
    expect(res.body.value).toBe("0");
    expect(res.body.chainId).toBe(84532);
  });

  it("eligible=false with reason 'not_overspend' for a within-cap receipt", async () => {
    const res = await request(app).post("/v1/challenges/prepare-amount").send({
      receiptId: RECEIPT_ID_LEGIT,
      challenger: OWNER,
    });
    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(false);
    expect(res.body.reason).toBe("not_overspend");
  });

  it("eligible=false with reason 'receipt_not_found' for unknown receipts", async () => {
    const res = await request(app).post("/v1/challenges/prepare-amount").send({
      receiptId: "0x" + "fe".repeat(32),
      challenger: OWNER,
    });
    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(false);
    expect(res.body.reason).toBe("receipt_not_found");
  });
});

describe("Challenge lifecycle in /v1/feed", () => {
  it("flips overspend receipt to challengeable=false after a challenge is filed", async () => {
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    upsertChallengeFiled({
      challengeId: 1n,
      receiptId: RECEIPT_ID_OVERSPEND,
      challenger: OWNER,
      blockNumber: 102n,
      txHash: ("0x" + "33".repeat(32)) as Hex,
      blockTimestamp: nowSec,
    });

    const res = await request(app).get("/v1/feed").query({ owner: OWNER });
    const receipt = (res.body as Array<Record<string, unknown>>).find(
      (e) => e.type === "receipt" && e.amount === "15000000",
    );
    expect(receipt?.challengeable).toBe(false);

    const challengeEntry = (res.body as Array<Record<string, unknown>>).find(
      (e) => e.type === "challenge",
    );
    expect(challengeEntry?.status).toBe("FILED");
    expect(challengeEntry?.challengeId).toBe("1");
  });

  it("includes payout once resolved", async () => {
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    resolveChallenge({
      challengeId: 1n,
      uphold: true,
      payout: 15_000_000n,
      blockNumber: 103n,
      txHash: ("0x" + "44".repeat(32)) as Hex,
      blockTimestamp: nowSec,
    });

    const res = await request(app).get("/v1/challenges/1");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("UPHELD");
    expect(res.body.payout).toBe("15000000");
  });
});
