import { INFRA_API_BASE, RUNTIME_API_BASE, USE_MOCKS, DEMO_CHALLENGE_BOND } from "./constants";
import type {
  ManifestResponse,
  FeedItem,
  FeedItemIntent,
  FeedItemReceipt,
  FeedItemBlocked,
  FeedItemChallenge,
  ReceiptDetail,
  ChallengeDetail,
  ChallengePrep,
  DemoStatus,
  DemoScenario,
  DemoStatusLast,
  ReceiptStatus,
  BlockedReason,
  ChallengeStatus,
  ChallengeType,
} from "./types";
import { MOCK_DEMO_IDLE } from "@/mocks/fixtures";
import {
  getMockFeed,
  getMockReceipt,
  getMockChallenge,
  appendMockChallengeFiled,
  scheduleMockChallengeResolve,
  seedUpheldChallenge,
} from "@/mocks/mock-store";
import { getAuthToken } from "@/hooks/use-siwe-auth";
import type { Address, Hex } from "viem";

/** Thrown when a receipt/challenge id is syntactically valid but no record exists. */
export class NotFoundError extends Error {
  constructor(what: string, id: string) {
    super(`${what} ${id} not found`);
    this.name = "NotFoundError";
  }
}

function describeServiceOffline(kind: "infra" | "runtime"): Error {
  if (kind === "infra") {
    return new Error(
      `Infra service offline at ${INFRA_API_BASE}. Start \`npm --prefix services/infra run dev\` or set \`NEXT_PUBLIC_USE_MOCKS=true\`.`,
    );
  }

  return new Error(
    `Demo runtime offline at ${RUNTIME_API_BASE}. Start \`npm run demo\` or set \`NEXT_PUBLIC_USE_MOCKS=true\`.`,
  );
}

async function fetchWithHelpfulErrors(
  input: string,
  init: RequestInit | undefined,
  kind: "infra" | "runtime",
): Promise<Response> {
  try {
    // Inject auth header if we have a token
    const token = getAuthToken();
    if (token && kind === "infra") {
      const headers = new Headers(init?.headers);
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      init = { ...init, headers };
    }
    return await fetch(input, init);
  } catch (err) {
    if (err instanceof TypeError) {
      throw describeServiceOffline(kind);
    }
    throw err;
  }
}

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

  const res = await fetchWithHelpfulErrors(`${INFRA_API_BASE}/v1/manifests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(manifest),
  }, "infra");

  if (!res.ok) throw new Error(`Manifest pin failed: ${res.status}`);
  return res.json();
}

export async function getFeed(owner: Address): Promise<FeedItem[]> {
  if (USE_MOCKS) {
    await delay(180);
    return getMockFeed();
  }

  const res = await fetchWithHelpfulErrors(`${INFRA_API_BASE}/v1/feed?owner=${owner}`, undefined, "infra");
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  const raw = (await res.json()) as unknown[];
  return raw.map(normalizeFeedEntry).filter((x): x is FeedItem => x !== null);
}

export async function getReceipt(receiptId: string): Promise<ReceiptDetail> {
  if (USE_MOCKS) {
    await delay(180);
    const hit = getMockReceipt(receiptId);
    if (!hit) throw new NotFoundError("Receipt", receiptId);
    return hit;
  }

  const res = await fetchWithHelpfulErrors(`${INFRA_API_BASE}/v1/receipts/${receiptId}`, undefined, "infra");
  if (res.status === 404) throw new NotFoundError("Receipt", receiptId);
  if (!res.ok) throw new Error(`Receipt fetch failed: ${res.status}`);
  const raw = await res.json();
  return normalizeReceiptDetail(raw);
}

export async function getChallenge(challengeId: string): Promise<ChallengeDetail> {
  if (USE_MOCKS) {
    await delay(180);
    const hit = getMockChallenge(challengeId);
    if (hit) return hit;
    // Fallback to the canonical upheld fixture if caller passed the seeded id.
    const seeded = seedUpheldChallenge();
    const seededHit = getMockChallenge(seeded);
    if (seededHit && (challengeId === seeded || challengeId === "pending")) {
      return seededHit;
    }
    throw new NotFoundError("Challenge", challengeId);
  }

  const res = await fetchWithHelpfulErrors(
    `${INFRA_API_BASE}/v1/challenges/${challengeId}`,
    undefined,
    "infra",
  );
  if (!res.ok) throw new Error(`Challenge fetch failed: ${res.status}`);
  const raw = await res.json();
  return normalizeChallengeDetail(raw);
}

export async function prepareChallenge(
  receiptId: Hex,
  challenger: Address
): Promise<ChallengePrep> {
  if (USE_MOCKS) {
    await delay(500);
    return {
      eligible: true,
      reason: null,
      bondAmount: "1000000",
      to: "0x0000000000000000000000000000000000000005" as Address,
      data: "0x" as Hex,
      value: "0",
      chainId: 84532,
    };
  }

  const res = await fetchWithHelpfulErrors(`${INFRA_API_BASE}/v1/challenges/prepare-amount`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receiptId, challenger }),
  }, "infra");
  if (!res.ok) throw new Error(`Challenge prep failed: ${res.status}`);
  return res.json();
}

export async function postReviewerResolve(body: {
  challengeId: string | number;
  uphold: boolean;
  slashAmount: string | number;
}): Promise<unknown> {
  if (USE_MOCKS) {
    await delay(400);
    return { broadcasted: false, calldata: "0x" };
  }
  const res = await fetchWithHelpfulErrors(`${INFRA_API_BASE}/v1/reviewer/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, "infra");
  if (!res.ok) throw new Error(`Reviewer resolve failed: ${res.status}`);
  return res.json();
}

// ── Runtime API (Dev 2) — demo-control ──

export async function runDemoScenario(scenario: DemoScenario): Promise<string> {
  if (USE_MOCKS) {
    await delay(300);
    return `mock-${scenario}-${Date.now()}`;
  }

  const res = await fetchWithHelpfulErrors(`${RUNTIME_API_BASE}/demo/run-${scenario}`, {
    method: "POST",
  }, "runtime");
  if (!res.ok) throw new Error(`Demo run failed: ${res.status}`);
  const body = (await res.json()) as { scenarioId?: string };
  if (!body.scenarioId) throw new Error("Demo run did not return scenarioId");
  return body.scenarioId;
}

export async function getDemoStatus(): Promise<DemoStatus> {
  if (USE_MOCKS) {
    await delay(200);
    return { ...MOCK_DEMO_IDLE, ...mockDemoOverride };
  }

  const res = await fetchWithHelpfulErrors(`${RUNTIME_API_BASE}/demo/status`, undefined, "runtime");
  if (!res.ok) throw new Error(`Demo status failed: ${res.status}`);
  const raw = await res.json();
  return mapDemoStatusResponse(raw);
}

/** Poll until the demo-control run for `scenarioId` finishes (or timeout). */
export async function waitForDemoScenario(
  scenario: DemoScenario,
  scenarioId: string,
  maxAttempts = 90
): Promise<DemoStatus> {
  if (USE_MOCKS) {
    await delay(200);
    return { ...MOCK_DEMO_IDLE, ...mockDemoOverride };
  }

  for (let i = 0; i < maxAttempts; i++) {
    await delay(1000);
    let res: Response;
    try {
      res = await fetchWithHelpfulErrors(`${RUNTIME_API_BASE}/demo/status`, undefined, "runtime");
    } catch (err) {
      return {
        scenario,
        status: "failed",
        error: err instanceof Error ? err.message : "Demo runtime offline",
      };
    }
    if (!res.ok) continue;
    const raw = await res.json();
    const last = (raw as { last?: DemoStatusLast | null }).last;
    if (
      last &&
      last.scenarioId === scenarioId &&
      last.status !== "running"
    ) {
      return mapLastToDemoStatus(scenario, last);
    }
  }
  return {
    scenario,
    status: "failed",
    error: "Timed out waiting for demo scenario",
  };
}

function mapDemoStatusResponse(body: unknown): DemoStatus {
  const last = (body as { last?: DemoStatusLast | null }).last;
  if (!last) {
    return { scenario: "legit", status: "idle" };
  }
  if (last.status === "running") {
    return { scenario: "legit", status: "running" };
  }
  const scenario: DemoScenario = last.reasonCode ? "blocked" : "legit";
  return mapLastToDemoStatus(scenario, last);
}

export function mapLastToDemoStatus(
  scenario: DemoScenario,
  last: DemoStatusLast
): DemoStatus {
  if (last.status === "failed") {
    return {
      scenario,
      status: "failed",
      error: last.error ?? "Demo agent failed",
    };
  }

  if (last.outcome === "blocked") {
    const rc = (last.reasonCode ?? "COUNTERPARTY_NOT_ALLOWED") as string;
    return {
      scenario,
      status: "success",
      reasonCode: rc as BlockedReason,
    };
  }

  if (last.outcome === "failed") {
    return {
      scenario,
      status: "failed",
      error: last.error ?? "Execution failed",
    };
  }

  if (last.outcome === "success") {
    return {
      scenario,
      status: "success",
      txHash: (last.txHash as Hex) ?? undefined,
      receiptId: (last.receiptId as Hex) ?? undefined,
    };
  }

  return {
    scenario,
    status: "failed",
    error: last.error ?? "Unknown demo outcome",
  };
}

// ── IF-09 normalization (infra → UI model) ──

function normalizeFeedEntry(entry: unknown): FeedItem | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  const type = e.type as string | undefined;
  if (type === "intent") {
    const row: FeedItemIntent = {
      type: "intent",
      id: String(e.id),
      timestamp: Number(e.timestamp),
      intentHash: e.intentHash as Hex,
      owner: e.owner as Address,
      manifestURI: String(e.manifestURI),
      active: Boolean(e.active),
      txHash: e.txHash as Hex,
    };
    return row;
  }
  if (type === "receipt") {
    const challengeable = Boolean(e.challengeable);
    const status: ReceiptStatus = challengeable ? "overspend" : "confirmed";
    const row: FeedItemReceipt = {
      type: "receipt",
      id: String(e.id),
      receiptId: e.receiptId as Hex,
      timestamp: Number(e.timestamp),
      agentId: e.agentId as Hex,
      target: e.target as Address,
      token: e.token as Address,
      amount: String(e.amount ?? "0"),
      status,
      txHash: e.txHash as Hex,
      contextDigest: e.contextDigest as Hex,
      traceURI: typeof e.traceURI === "string" ? e.traceURI : "",
      intentHash: e.intentHash as Hex,
    };
    return row;
  }
  if (type === "blocked") {
    const code = String(e.reasonCode ?? "COUNTERPARTY_NOT_ALLOWED");
    const row: FeedItemBlocked = {
      type: "blocked",
      id: String(e.id),
      timestamp: Number(e.timestamp),
      agentId: (e.agentId as Hex) ?? ("0x" as Hex),
      target: (e.target as Address) ?? ("0x" as Address),
      token: (e.token as Address) ?? ("0x" as Address),
      amount: e.amount != null ? String(e.amount) : "0",
      reasonCode: code as BlockedReason,
    };
    return row;
  }
  if (type === "challenge") {
    const st = e.status as string;
    const mapped: ChallengeStatus =
      st === "FILED"
        ? "FILED"
        : st === "UPHELD"
          ? "UPHELD"
          : st === "REJECTED"
            ? "REJECTED"
            : "PENDING";
    const row: FeedItemChallenge = {
      type: "challenge",
      id: String(e.id),
      challengeId: String(e.challengeId),
      receiptId: e.receiptId as Hex,
      timestamp: Number(e.timestamp),
      challengeType: "AmountViolation" as ChallengeType,
      status: mapped,
      payoutAmount: e.payout != null ? String(e.payout) : undefined,
      txHash: e.resolvedAt ? undefined : (e.filedTx as Hex | undefined),
    };
    return row;
  }
  return null;
}

function normalizeReceiptDetail(raw: unknown): ReceiptDetail {
  const r = raw as Record<string, unknown>;
  const challengeable = Boolean(r.challengeable);
  const status: ReceiptStatus = challengeable ? "overspend" : "confirmed";
  return {
    receiptId: r.receiptId as Hex,
    owner: r.owner as Address,
    agentId: r.agentId as Hex,
    intentHash: r.intentHash as Hex,
    target: r.target as Address,
    token: r.token as Address,
    amount: String(r.amount ?? "0"),
    callDataHash: r.callDataHash as Hex,
    contextDigest: r.contextDigest as Hex,
    traceURI: typeof r.traceURI === "string" ? r.traceURI : "",
    nonce: String(r.nonce ?? "0"),
    timestamp: Number(r.timestamp ?? 0),
    txHash: r.txHash as Hex,
    status,
    challengeable,
    challengeWindowEndsAt:
      r.challengeWindowEndsAt != null
        ? Number(r.challengeWindowEndsAt)
        : undefined,
    challengeFiled: Boolean(r.challengeFiled),
  };
}

function normalizeChallengeDetail(raw: unknown): ChallengeDetail {
  const c = raw as Record<string, unknown>;
  const st = String(c.status ?? "FILED");
  const status: ChallengeStatus =
    st === "UPHELD"
      ? "UPHELD"
      : st === "REJECTED"
        ? "REJECTED"
        : st === "FILED"
          ? "FILED"
          : "PENDING";
  return {
    challengeId: String(c.challengeId),
    receiptId: c.receiptId as Hex,
    challenger: c.challenger as Address,
    challengeType: "AmountViolation",
    status,
    bondAmount: DEMO_CHALLENGE_BOND.toString(),
    payoutAmount:
      c.payout != null ? String(c.payout) : undefined,
    filedAt: Number(c.filedAt ?? 0),
    resolvedAt:
      c.resolvedAt != null ? Number(c.resolvedAt) : undefined,
    txHash: (c.resolvedTx as Hex) ?? (c.filedTx as Hex) ?? undefined,
  };
}

// ── Mock state (client-side only, for demo) ──

let mockDemoOverride: Partial<DemoStatus> = {};

export function setMockDemoOverride(o: Partial<DemoStatus>): void {
  mockDemoOverride = o;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * After filing on-chain, wait for the indexer to attach a challenge row to
 * the feed and return its id. In mock mode this appends an in-memory row
 * immediately and schedules a delayed UPHELD resolution so the UI has
 * something to poll.
 */
export async function pollChallengeIdForReceipt(
  owner: Address,
  receiptId: Hex,
  maxAttempts = 40
): Promise<string | null> {
  if (USE_MOCKS) {
    const id = appendMockChallengeFiled(receiptId);
    scheduleMockChallengeResolve(id, 6500);
    return id;
  }
  for (let i = 0; i < maxAttempts; i++) {
    await delay(2000);
    const feed = await getFeed(owner);
    const hit = feed.find(
      (e): e is FeedItemChallenge =>
        e.type === "challenge" && e.receiptId.toLowerCase() === receiptId.toLowerCase()
    );
    if (hit) return hit.challengeId;
  }
  return null;
}
