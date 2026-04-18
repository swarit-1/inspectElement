import { INFRA_API_BASE, RUNTIME_API_BASE, USE_MOCKS } from "./constants";
import type {
  ManifestResponse,
  FeedItem,
  ReceiptDetail,
  ChallengeDetail,
  ChallengePrep,
  DemoStatus,
  DemoScenario,
} from "./types";
import {
  MOCK_FEED,
  MOCK_FEED_WITH_CHALLENGE,
  MOCK_RECEIPT_DETAIL,
  MOCK_CHALLENGE_DETAIL,
  MOCK_DEMO_IDLE,
} from "@/mocks/fixtures";
import type { Address, Hex } from "viem";

// ── Infra API (Dev 3) ──

export async function postManifest(manifest: {
  owner: string;
  token: string;
  maxSpendPerTx: string;
  maxSpendPerDay: string;
  allowedCounterparties: string[];
  expiry: number;
  nonce: number;
}): Promise<ManifestResponse> {
  if (USE_MOCKS) {
    await delay(800);
    return {
      manifestURI: "ipfs://QmMock.../manifest.json",
      intentHash:
        "0xcccc000000000000000000000000000000000000000000000000000000000001" as Hex,
    };
  }

  const res = await fetch(`${INFRA_API_BASE}/v1/manifests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(manifest),
  });

  if (!res.ok) throw new Error(`Manifest pin failed: ${res.status}`);
  return res.json();
}

export async function getFeed(owner: Address): Promise<FeedItem[]> {
  if (USE_MOCKS) {
    await delay(300);
    // Show challenge after a bit
    if (mockChallengeVisible) return MOCK_FEED_WITH_CHALLENGE;
    return MOCK_FEED;
  }

  const res = await fetch(
    `${INFRA_API_BASE}/v1/feed?owner=${owner}`
  );
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  return res.json();
}

export async function getReceipt(
  receiptId: string
): Promise<ReceiptDetail> {
  if (USE_MOCKS) {
    await delay(200);
    return MOCK_RECEIPT_DETAIL;
  }

  const res = await fetch(
    `${INFRA_API_BASE}/v1/receipts/${receiptId}`
  );
  if (!res.ok) throw new Error(`Receipt fetch failed: ${res.status}`);
  return res.json();
}

export async function getChallenge(
  challengeId: string
): Promise<ChallengeDetail> {
  if (USE_MOCKS) {
    await delay(200);
    return MOCK_CHALLENGE_DETAIL;
  }

  const res = await fetch(
    `${INFRA_API_BASE}/v1/challenges/${challengeId}`
  );
  if (!res.ok) throw new Error(`Challenge fetch failed: ${res.status}`);
  return res.json();
}

export async function prepareChallenge(
  receiptId: Hex,
  challenger: Address
): Promise<ChallengePrep> {
  if (USE_MOCKS) {
    await delay(500);
    return {
      eligible: true,
      reason: "Amount exceeds per-tx cap",
      bondAmount: "1000000",
      to: "0x0000000000000000000000000000000000000005" as Address,
      data: "0x" as Hex,
      value: "0",
      chainId: 84532,
    };
  }

  const res = await fetch(
    `${INFRA_API_BASE}/v1/challenges/prepare-amount`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptId, challenger }),
    }
  );
  if (!res.ok) throw new Error(`Challenge prep failed: ${res.status}`);
  return res.json();
}

// ── Runtime API (Dev 2) ──

export async function runDemoScenario(
  scenario: DemoScenario
): Promise<void> {
  if (USE_MOCKS) {
    await delay(300);
    return;
  }

  const res = await fetch(
    `${RUNTIME_API_BASE}/demo/run-${scenario}`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error(`Demo run failed: ${res.status}`);
}

export async function getDemoStatus(): Promise<DemoStatus> {
  if (USE_MOCKS) {
    await delay(200);
    return { ...MOCK_DEMO_IDLE, ...mockDemoOverride };
  }

  const res = await fetch(`${RUNTIME_API_BASE}/demo/status`);
  if (!res.ok) throw new Error(`Demo status failed: ${res.status}`);
  return res.json();
}

// ── Mock state (client-side only, for demo) ──

let mockChallengeVisible = false;
let mockDemoOverride: Partial<DemoStatus> = {};

export function setMockChallengeVisible(v: boolean): void {
  mockChallengeVisible = v;
}

export function setMockDemoOverride(o: Partial<DemoStatus>): void {
  mockDemoOverride = o;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
