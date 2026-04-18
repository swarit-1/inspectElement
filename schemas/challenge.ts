/**
 * IF-07 + IF-09 challenge shapes.
 */
export type ChallengeStatus = "FILED" | "UPHELD" | "REJECTED";

export interface ChallengeDetail {
  challengeId: string;
  receiptId: string;
  status: ChallengeStatus;
  filedAt: number;
  resolvedAt: number | null;
  payout: string | null;
  challenger: string;
  filedTx: string;
  resolvedTx: string | null;
}

export interface PrepareAmountRequest {
  receiptId: string;
  challenger: string;
}

export interface PrepareAmountResponse {
  eligible: boolean;
  reason: string | null;
  /** Bond amount in token base units (USDC has 6 decimals). */
  bondAmount: string;
  to: string | null;
  data: string | null;
  value: string;
  chainId: number;
}
