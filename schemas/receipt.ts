/**
 * IF-09 receipt detail shape.
 */
export interface ReceiptDetail {
  receiptId: string;
  owner: string;
  agentId: string;
  intentHash: string;
  target: string;
  token: string;
  amount: string;
  contextDigest: string;
  traceURI: string | null;
  callDataHash: string;
  nonce: string;
  timestamp: number;
  blockNumber: number;
  txHash: string;
  challengeable: boolean;
  challengeWindowEndsAt: number;
  /** True if a challenge has already been filed against this receipt. */
  challengeFiled: boolean;
}
