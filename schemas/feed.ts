/**
 * IF-09 feed entry shape (frozen by hour 6 per Dev 3 spec §6).
 *
 * Consumed by Dev 4. New entry types must NOT be added without coordinating
 * with Dev 4 first.
 */
export type FeedEntryType = "intent" | "receipt" | "challenge" | "blocked";

export interface FeedEntryBase {
  type: FeedEntryType;
  timestamp: number; // unix seconds
  id: string;
}

export interface FeedReceiptEntry extends FeedEntryBase {
  type: "receipt";
  receiptId: string;
  owner: string;
  agentId: string;
  intentHash: string;
  target: string;
  token: string;
  amount: string;
  contextDigest: string;
  traceURI: string | null;
  txHash: string;
  blockNumber: number;
  challengeable: boolean;
  challengeWindowEndsAt: number; // unix seconds
}

export interface FeedChallengeEntry extends FeedEntryBase {
  type: "challenge";
  challengeId: string;
  receiptId: string;
  status: "FILED" | "UPHELD" | "REJECTED";
  payout: string | null;
  challenger: string;
  filedAt: number;
  resolvedAt: number | null;
}

export interface FeedIntentEntry extends FeedEntryBase {
  type: "intent";
  intentHash: string;
  owner: string;
  manifestURI: string;
  active: boolean;
  txHash: string;
}

export interface FeedBlockedEntry extends FeedEntryBase {
  type: "blocked";
  scenarioId: string | null;
  reasonCode: string;
  reasonLabel: string | null;
  owner: string | null;
  agentId: string | null;
  target: string | null;
  token: string | null;
  amount: string | null;
}

export type FeedEntry =
  | FeedReceiptEntry
  | FeedChallengeEntry
  | FeedIntentEntry
  | FeedBlockedEntry;
