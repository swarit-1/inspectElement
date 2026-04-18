import type {
  FeedItem,
  ReceiptDetail,
  ChallengeDetail,
  DemoStatus,
} from "@/lib/types";
import type { Address, Hex } from "viem";

const MOCK_OWNER = "0xaBcD00000000000000000000000000000000dEaD" as Address;
const MOCK_AGENT_ID =
  "0x00000000000000000000000000000000000000000000000000000000deadbeef" as Hex;
const MOCK_MERCHANT = "0x1111111111111111111111111111111111111111" as Address;
const MOCK_ATTACKER = "0x9999999999999999999999999999999999999999" as Address;
const MOCK_USDC = "0x0000000000000000000000000000000000000001" as Address;

const now = Math.floor(Date.now() / 1000);

// ── Feed fixtures ──

export const MOCK_FEED: FeedItem[] = [
  {
    type: "receipt",
    id: "feed-1",
    receiptId:
      "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex,
    timestamp: now - 300,
    agentId: MOCK_AGENT_ID,
    target: MOCK_MERCHANT,
    token: MOCK_USDC,
    amount: "2000000",
    status: "confirmed",
    txHash:
      "0xaaaa000000000000000000000000000000000000000000000000000000000001" as Hex,
    contextDigest:
      "0xbbbb000000000000000000000000000000000000000000000000000000000001" as Hex,
    traceURI: "ipfs://Qm.../trace-1.json",
    intentHash:
      "0xcccc000000000000000000000000000000000000000000000000000000000001" as Hex,
  },
  {
    type: "blocked",
    id: "feed-2",
    timestamp: now - 180,
    agentId: MOCK_AGENT_ID,
    target: MOCK_ATTACKER,
    token: MOCK_USDC,
    amount: "20000000",
    reasonCode: "COUNTERPARTY_NOT_ALLOWED",
  },
  {
    type: "receipt",
    id: "feed-3",
    receiptId:
      "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex,
    timestamp: now - 60,
    agentId: MOCK_AGENT_ID,
    target: MOCK_MERCHANT,
    token: MOCK_USDC,
    amount: "15000000",
    status: "overspend",
    txHash:
      "0xaaaa000000000000000000000000000000000000000000000000000000000002" as Hex,
    contextDigest:
      "0xbbbb000000000000000000000000000000000000000000000000000000000002" as Hex,
    traceURI: "ipfs://Qm.../trace-2.json",
    intentHash:
      "0xcccc000000000000000000000000000000000000000000000000000000000001" as Hex,
  },
];

export const MOCK_FEED_WITH_CHALLENGE: FeedItem[] = [
  ...MOCK_FEED,
  {
    type: "challenge",
    id: "feed-4",
    challengeId: "1",
    receiptId:
      "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex,
    timestamp: now - 30,
    challengeType: "AmountViolation",
    status: "UPHELD",
    payoutAmount: "15000000",
    txHash:
      "0xaaaa000000000000000000000000000000000000000000000000000000000003" as Hex,
  },
];

// ── Receipt detail ──

export const MOCK_RECEIPT_DETAIL: ReceiptDetail = {
  receiptId:
    "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex,
  owner: MOCK_OWNER,
  agentId: MOCK_AGENT_ID,
  intentHash:
    "0xcccc000000000000000000000000000000000000000000000000000000000001" as Hex,
  target: MOCK_MERCHANT,
  token: MOCK_USDC,
  amount: "15000000",
  callDataHash:
    "0xdddd000000000000000000000000000000000000000000000000000000000001" as Hex,
  contextDigest:
    "0xbbbb000000000000000000000000000000000000000000000000000000000002" as Hex,
  traceURI: "ipfs://Qm.../trace-2.json",
  nonce: "1",
  timestamp: now - 60,
  txHash:
    "0xaaaa000000000000000000000000000000000000000000000000000000000002" as Hex,
  status: "overspend",
};

// ── Challenge detail ──

export const MOCK_CHALLENGE_DETAIL: ChallengeDetail = {
  challengeId: "1",
  receiptId:
    "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex,
  challenger: MOCK_OWNER,
  challengeType: "AmountViolation",
  status: "UPHELD",
  bondAmount: "1000000",
  payoutAmount: "15000000",
  filedAt: now - 30,
  resolvedAt: now - 10,
  txHash:
    "0xaaaa000000000000000000000000000000000000000000000000000000000003" as Hex,
};

// ── Demo status ──

export const MOCK_DEMO_IDLE: DemoStatus = {
  scenario: "legit",
  status: "idle",
};
