import type { Address, Hex } from "viem";
import { db, getDb, getProvider } from "./db.js";

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
  ts: number;
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

export async function upsertReceipt(input: InsertReceiptInput): Promise<void> {
  const createdAt = Math.floor(Date.now() / 1000);
  const row = {
    receipt_id: input.receiptId.toLowerCase(),
    owner: input.owner.toLowerCase(),
    agent_id: input.agentId.toLowerCase(),
    intent_hash: input.intentHash.toLowerCase(),
    target: input.target.toLowerCase(),
    token: input.token.toLowerCase(),
    amount: input.amount.toString(10),
    call_data_hash: input.callDataHash.toLowerCase(),
    context_digest: input.contextDigest.toLowerCase(),
    nonce: input.nonce.toString(10),
    ts: Number(input.ts),
    block_number: Number(input.blockNumber),
    tx_hash: input.txHash.toLowerCase(),
    log_index: input.logIndex,
    created_at: createdAt,
  };

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    sqliteDb
      .prepare(
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
      )
      .run(
        row.receipt_id,
        row.owner,
        row.agent_id,
        row.intent_hash,
        row.target,
        row.token,
        row.amount,
        row.call_data_hash,
        row.context_digest,
        row.nonce,
        row.ts,
        row.block_number,
        row.tx_hash,
        row.log_index,
        row.created_at,
      );
  } else {
    await db()
      .from("receipts")
      .upsert(row, { onConflict: "receipt_id" });
  }
}

export async function setReceiptTraceUri(receiptId: Hex, traceUri: string): Promise<void> {
  const key = receiptId.toLowerCase();

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    sqliteDb.prepare(`UPDATE receipts SET trace_uri = ? WHERE receipt_id = ?`).run(traceUri, key);
  } else {
    await db()
      .from("receipts")
      .update({ trace_uri: traceUri })
      .eq("receipt_id", key);
  }
}

export async function getReceipt(receiptId: Hex): Promise<ReceiptRow | null> {
  const key = receiptId.toLowerCase();

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const row = sqliteDb
      .prepare(`SELECT * FROM receipts WHERE receipt_id = ?`)
      .get(key) as Record<string, unknown> | undefined;
    return row ? rowToReceipt(row) : null;
  }

  const { data } = await db()
    .from("receipts")
    .select("*")
    .eq("receipt_id", key)
    .single();
  return data ? rowToReceipt(data) : null;
}

export async function listReceiptsByOwner(owner: Address, limit = 100): Promise<ReceiptRow[]> {
  const key = owner.toLowerCase();

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const rows = sqliteDb
      .prepare(
        `SELECT * FROM receipts WHERE owner = ? ORDER BY block_number DESC, log_index DESC LIMIT ?`,
      )
      .all(key, limit) as Record<string, unknown>[];
    return rows.map(rowToReceipt);
  }

  const { data } = await db()
    .from("receipts")
    .select("*")
    .eq("owner", key)
    .order("block_number", { ascending: false })
    .order("log_index", { ascending: false })
    .limit(limit);
  return (data ?? []).map(rowToReceipt);
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
