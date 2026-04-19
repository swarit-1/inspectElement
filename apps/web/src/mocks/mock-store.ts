"use client";

import type {
  FeedItem,
  FeedItemReceipt,
  FeedItemBlocked,
  FeedItemChallenge,
  ReceiptDetail,
  ChallengeDetail,
  DemoScenario,
} from "@/lib/types";
import type { Hex, Address } from "viem";
import {
  MOCK_FEED,
  MOCK_RECEIPT_DETAIL,
  MOCK_CHALLENGE_DETAIL,
} from "./fixtures";

/**
 * Mutable client-side mock state. When `NEXT_PUBLIC_USE_MOCKS` is on, demo
 * scenarios append entries to the feed so the story feels end-to-end without
 * wiring up a real runtime. Nothing here persists to localStorage — a refresh
 * or `reset()` returns to the baseline fixtures.
 */

type Subscriber = () => void;
const subs = new Set<Subscriber>();

let feed: FeedItem[] = [...MOCK_FEED];
const receipts = new Map<string, ReceiptDetail>([
  [MOCK_RECEIPT_DETAIL.receiptId.toLowerCase(), MOCK_RECEIPT_DETAIL],
]);
const challenges = new Map<string, ChallengeDetail>();

function notify() {
  subs.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

export function subscribeMockStore(fn: Subscriber): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function getMockFeed(): FeedItem[] {
  return [...feed];
}

export function getMockReceipt(id: string): ReceiptDetail | null {
  return receipts.get(id.toLowerCase()) ?? null;
}

export function getMockChallenge(id: string): ChallengeDetail | null {
  return challenges.get(id) ?? null;
}

function randHex(prefix: string, n: number): Hex {
  const hex = Math.floor(Math.random() * 16 ** 8)
    .toString(16)
    .padStart(8, "0");
  return `0x${prefix}${hex.padEnd(n - 2 - prefix.length, "0")}`.slice(0, n + 2) as Hex;
}

/**
 * Append a realistic feed entry for a freshly-run mock scenario. Returns any
 * receipt/challenge IDs the caller can use to deep-link.
 */
export function appendScenarioToFeed(
  scenario: DemoScenario,
  owner: Address | undefined,
): { receiptId?: Hex; challengeId?: string } {
  const now = Math.floor(Date.now() / 1000);
  const agentId =
    "0x00000000000000000000000000000000000000000000000000000000deadbeef" as Hex;
  const usdc = "0x0000000000000000000000000000000000000001" as Address;

  if (scenario === "legit") {
    const merchant = "0x1111111111111111111111111111111111111111" as Address;
    const receiptId = randHex("a", 64) as Hex;
    const txHash = randHex("f", 64) as Hex;
    const row: FeedItemReceipt = {
      type: "receipt",
      id: `live-legit-${now}`,
      receiptId,
      timestamp: now,
      agentId,
      target: merchant,
      token: usdc,
      amount: "2000000",
      status: "confirmed",
      txHash,
      contextDigest: randHex("b", 64) as Hex,
      traceURI: "ipfs://Qm.../live.json",
      intentHash:
        "0xcccc000000000000000000000000000000000000000000000000000000000001" as Hex,
    };
    feed = [row, ...feed];
    receipts.set(receiptId.toLowerCase(), {
      receiptId,
      owner: owner ?? (merchant as Address),
      agentId,
      intentHash: row.intentHash,
      target: merchant,
      token: usdc,
      amount: "2000000",
      callDataHash: randHex("d", 64) as Hex,
      contextDigest: row.contextDigest,
      traceURI: row.traceURI,
      nonce: String(now),
      timestamp: now,
      txHash,
      status: "confirmed",
      challengeable: false,
      challengeFiled: false,
    });
    notify();
    return { receiptId };
  }

  if (scenario === "blocked") {
    const attacker = "0x9999999999999999999999999999999999999999" as Address;
    const row: FeedItemBlocked = {
      type: "blocked",
      id: `live-blocked-${now}`,
      timestamp: now,
      agentId,
      target: attacker,
      token: usdc,
      amount: "20000000",
      reasonCode: "COUNTERPARTY_NOT_ALLOWED",
    };
    feed = [row, ...feed];
    notify();
    return {};
  }

  // overspend
  const merchant = "0x1111111111111111111111111111111111111111" as Address;
  const receiptId = randHex("a", 64) as Hex;
  const txHash = randHex("f", 64) as Hex;
  const row: FeedItemReceipt = {
    type: "receipt",
    id: `live-overspend-${now}`,
    receiptId,
    timestamp: now,
    agentId,
    target: merchant,
    token: usdc,
    amount: "15000000",
    status: "overspend",
    txHash,
    contextDigest: randHex("b", 64) as Hex,
    traceURI: "ipfs://Qm.../live.json",
    intentHash:
      "0xcccc000000000000000000000000000000000000000000000000000000000001" as Hex,
  };
  feed = [row, ...feed];
  receipts.set(receiptId.toLowerCase(), {
    receiptId,
    owner: owner ?? (merchant as Address),
    agentId,
    intentHash: row.intentHash,
    target: merchant,
    token: usdc,
    amount: "15000000",
    callDataHash: randHex("d", 64) as Hex,
    contextDigest: row.contextDigest,
    traceURI: row.traceURI,
    nonce: String(now),
    timestamp: now,
    txHash,
    status: "overspend",
    challengeable: true,
    challengeFiled: false,
    challengeWindowEndsAt: now + 86_400,
  });
  notify();
  return { receiptId };
}

/**
 * Append a filed-challenge entry for `receiptId` and return a synthetic id.
 * Also flips the receipt's `challengeFiled` so the CTA doesn't re-offer.
 */
export function appendMockChallengeFiled(receiptId: Hex): string {
  const id = `c-${Date.now().toString(36)}`;
  const now = Math.floor(Date.now() / 1000);
  const row: FeedItemChallenge = {
    type: "challenge",
    id: `live-challenge-${now}`,
    challengeId: id,
    receiptId,
    timestamp: now,
    challengeType: "AmountViolation",
    status: "FILED",
  };
  feed = [row, ...feed];
  const r = receipts.get(receiptId.toLowerCase());
  if (r) {
    receipts.set(receiptId.toLowerCase(), { ...r, challengeFiled: true });
  }
  challenges.set(id, {
    challengeId: id,
    receiptId,
    challenger:
      (r?.owner ?? "0xaBcD00000000000000000000000000000000dEaD") as Address,
    challengeType: "AmountViolation",
    status: "FILED",
    bondAmount: "1000000",
    filedAt: now,
  });
  notify();
  return id;
}

/**
 * Resolve a filed challenge after `delayMs`. Drives the "Awaiting arbiter"
 * phase of the mock flow so judges see it transition from FILED → UPHELD.
 */
export function scheduleMockChallengeResolve(id: string, delayMs = 6000) {
  setTimeout(() => {
    const prev = challenges.get(id);
    if (!prev) return;
    const now = Math.floor(Date.now() / 1000);
    const payout = "15000000";
    const resolved: ChallengeDetail = {
      ...prev,
      status: "UPHELD",
      payoutAmount: payout,
      resolvedAt: now,
      txHash:
        "0xaaaa000000000000000000000000000000000000000000000000000000000003" as Hex,
    };
    challenges.set(id, resolved);
    // Also reflect in feed.
    feed = feed.map((e) =>
      e.type === "challenge" && e.challengeId === id
        ? { ...e, status: "UPHELD" as const, payoutAmount: payout, timestamp: now }
        : e
    );
    notify();
  }, delayMs);
}

/** Reset all in-memory mock state back to fixtures. */
export function resetMockStore(): void {
  feed = [...MOCK_FEED];
  receipts.clear();
  receipts.set(MOCK_RECEIPT_DETAIL.receiptId.toLowerCase(), MOCK_RECEIPT_DETAIL);
  challenges.clear();
  notify();
}

/** Seed the UPHELD challenge fixture so the "happy ending" screen works without demo runs. */
export function seedUpheldChallenge(): string {
  challenges.set(MOCK_CHALLENGE_DETAIL.challengeId, MOCK_CHALLENGE_DETAIL);
  return MOCK_CHALLENGE_DETAIL.challengeId;
}
