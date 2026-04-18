import type { Address, Hex } from "viem";
import { getDb } from "./db.js";

export interface ReceiptRow {
  receiptId: Hex;
  owner: Address;
  agentId: Hex;
  intentHash: Hex;
  target: Address;
  token: Address;
  amount: bigint;
  callDataHash: Hex;
  contextDigest: Hex;
  nonce: bigint;
  ts: number; // block timestamp seconds
  traceUri: string | null;
  blockNumber: number;
  txHash: Hex;
  logIndex: number;
  createdAt: number;
}

export interface InsertReceiptInput {
  receiptId: Hex;
  owner: Address;
  agentId: Hex;
  intentHash: Hex;
  target: Address;
  token: Address;
  amount: bigint;
  callDataHash: Hex;
  contextDigest: Hex;
  nonce: bigint;
  ts: bigint;
  blockNumber: bigint;
  txHash: Hex;
  logIndex: number;
}

export function upsertReceipt(input: InsertReceiptInput): void {
  const db = getDb();
  const createdAt = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO receipts (
       receipt_id, owner, agent_id, intent_hash, target, token, amount,
       call_data_hash, context_digest, nonce, ts, block_number, tx_hash,
       log_index, created_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(receipt_id) DO UPDATE SET
       owner = excluded.owner,
       agent_id = excluded.agent_id,
       intent_hash = excluded.intent_hash,
       target = excluded.target,
       token = excluded.token,
       amount = excluded.amount,
       call_data_hash = excluded.call_data_hash,
       context_digest = excluded.context_digest,
       nonce = excluded.nonce,
       ts = excluded.ts,
       block_number = excluded.block_number,
       tx_hash = excluded.tx_hash,
       log_index = excluded.log_index`,
  ).run(
    input.receiptId.toLowerCase(),
    input.owner.toLowerCase(),
    input.agentId.toLowerCase(),
    input.intentHash.toLowerCase(),
    input.target.toLowerCase(),
    input.token.toLowerCase(),
    input.amount.toString(10),
    input.callDataHash.toLowerCase(),
    input.contextDigest.toLowerCase(),
    input.nonce.toString(10),
    Number(input.ts),
    Number(input.blockNumber),
    input.txHash.toLowerCase(),
    input.logIndex,
    createdAt,
  );
}

export function setReceiptTraceUri(receiptId: Hex, traceUri: string): void {
  const db = getDb();
  db.prepare(`UPDATE receipts SET trace_uri = ? WHERE receipt_id = ?`).run(
    traceUri,
    receiptId.toLowerCase(),
  );
}

export function getReceipt(receiptId: Hex): ReceiptRow | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM receipts WHERE receipt_id = ?`)
    .get(receiptId.toLowerCase()) as Record<string, unknown> | undefined;
  return row ? rowToReceipt(row) : null;
}

export function listReceiptsByOwner(owner: Address, limit = 100): ReceiptRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM receipts WHERE owner = ? ORDER BY block_number DESC, log_index DESC LIMIT ?`,
    )
    .all(owner.toLowerCase(), limit) as Record<string, unknown>[];
  return rows.map(rowToReceipt);
}

function rowToReceipt(row: Record<string, unknown>): ReceiptRow {
  return {
    receiptId: row.receipt_id as Hex,
    owner: row.owner as Address,
    agentId: row.agent_id as Hex,
    intentHash: row.intent_hash as Hex,
    target: row.target as Address,
    token: row.token as Address,
    amount: BigInt(row.amount as string),
    callDataHash: row.call_data_hash as Hex,
    contextDigest: row.context_digest as Hex,
    nonce: BigInt(row.nonce as string),
    ts: row.ts as number,
    traceUri: (row.trace_uri as string | null) ?? null,
    blockNumber: row.block_number as number,
    txHash: row.tx_hash as Hex,
    logIndex: row.log_index as number,
    createdAt: row.created_at as number,
  };
}
