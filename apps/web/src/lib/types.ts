import type { Address, Hex } from "viem";

// ── On-chain structs ──

export interface IntentConfig {
  owner: Address;
  token: Address;
  maxSpendPerTx: bigint;
  maxSpendPerDay: bigint;
  allowedCounterparties: Address[];
  expiry: bigint;
  nonce: bigint;
}

export interface TraceAck {
  contextDigest: Hex;
  uriHash: Hex;
  expiresAt: bigint;
  signature: Hex;
}

export interface ExecutionRequest {
  owner: Address;
  agentId: Hex;
  target: Address;
  token: Address;
  amount: bigint;
  data: Hex;
  traceURI: string;
  traceAck: TraceAck;
}

// ── API response types ──

export interface ManifestResponse {
  manifestURI: string;
  intentHash: Hex;
}

export interface TraceResponse {
  traceURI: string;
  contextDigest: Hex;
  uriHash: Hex;
  expiresAt: number;
  signature: Hex;
}

export interface ChallengePrep {
  eligible: boolean;
  reason: string | null;
  bondAmount: string;
  to: Address | null;
  data: Hex | null;
  value: string;
  chainId: number;
}

// ── Feed types ──

export type FeedItemType = "receipt" | "blocked" | "challenge" | "intent";

export type ReceiptStatus = "confirmed" | "overspend";
export type BlockedReason =
  | "COUNTERPARTY_NOT_ALLOWED"
  | "TOKEN_NOT_ALLOWED"
  | "INTENT_EXPIRED"
  | "DAY_CAP_EXCEEDED"
  | "INVALID_TRACE_ACK"
  | "DELEGATE_NOT_APPROVED";

export type ChallengeStatus = "PENDING" | "FILED" | "UPHELD" | "REJECTED";
export type ChallengeType = "AmountViolation";

export interface FeedItemIntent {
  type: "intent";
  id: string;
  timestamp: number;
  intentHash: Hex;
  owner: Address;
  manifestURI: string;
  active: boolean;
  txHash: Hex;
}

export interface FeedItemReceipt {
  type: "receipt";
  id: string;
  receiptId: Hex;
  timestamp: number;
  agentId: Hex;
  target: Address;
  token: Address;
  amount: string;
  status: ReceiptStatus;
  txHash: Hex;
  contextDigest: Hex;
  traceURI: string;
  intentHash: Hex;
}

export interface FeedItemBlocked {
  type: "blocked";
  id: string;
  timestamp: number;
  agentId: Hex;
  target: Address;
  token: Address;
  amount: string;
  reasonCode: BlockedReason;
}

export interface FeedItemChallenge {
  type: "challenge";
  id: string;
  challengeId: string;
  receiptId: Hex;
  timestamp: number;
  challengeType: ChallengeType;
  status: ChallengeStatus;
  payoutAmount?: string;
  txHash?: Hex;
}

export type FeedItem =
  | FeedItemIntent
  | FeedItemReceipt
  | FeedItemBlocked
  | FeedItemChallenge;

// ── Receipt detail ──

export interface ReceiptDetail {
  receiptId: Hex;
  owner: Address;
  agentId: Hex;
  intentHash: Hex;
  target: Address;
  token: Address;
  amount: string;
  callDataHash: Hex;
  contextDigest: Hex;
  traceURI: string;
  nonce: string;
  timestamp: number;
  txHash: Hex;
  status: ReceiptStatus;
  challengeable?: boolean;
  challengeWindowEndsAt?: number;
  challengeFiled?: boolean;
}

// ── Challenge detail ──

export interface ChallengeDetail {
  challengeId: string;
  receiptId: Hex;
  challenger: Address;
  challengeType: ChallengeType;
  status: ChallengeStatus;
  bondAmount: string;
  payoutAmount?: string;
  filedAt: number;
  resolvedAt?: number;
  txHash?: Hex;
}

// ── Demo status ──

export type DemoScenario = "legit" | "blocked" | "overspend";
export type DemoRunStatus = "idle" | "running" | "success" | "failed";

export interface DemoStatus {
  scenario: DemoScenario;
  status: DemoRunStatus;
  txHash?: Hex;
  reasonCode?: BlockedReason;
  receiptId?: Hex;
  error?: string;
}

/** Raw last-run payload from demo-control `GET /demo/status`. */
export interface DemoStatusLast {
  scenarioId: string;
  status: "running" | "completed" | "failed";
  outcome?: "success" | "blocked" | "failed" | null;
  txHash?: string | null;
  reasonCode?: string | null;
  receiptId?: string | null;
  error?: string | null;
}

// ── App state ──

export type OnboardingStep =
  | "connect"
  | "deploying"
  | "deployed"
  | "intent"
  | "delegate"
  | "ready";
