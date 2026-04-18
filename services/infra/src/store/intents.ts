import type { Address, Hex } from "viem";
import { getDb } from "./db.js";

export interface IntentRow {
  intentHash: Hex;
  owner: Address;
  manifestUri: string;
  active: boolean;
  blockNumber: number;
  txHash: Hex;
  logIndex: number;
  createdAt: number;
}

export function insertIntentCommitted(input: {
  intentHash: Hex;
  owner: Address;
  manifestUri: string;
  blockNumber: bigint;
  txHash: Hex;
  logIndex: number;
}): void {
  const db = getDb();
  const createdAt = Math.floor(Date.now() / 1000);
  const tx = db.transaction(() => {
    db.prepare(`UPDATE intents SET active = 0 WHERE owner = ? AND active = 1`).run(
      input.owner.toLowerCase(),
    );
    db.prepare(
      `INSERT INTO intents (
         intent_hash, owner, manifest_uri, active,
         block_number, tx_hash, log_index, created_at
       ) VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(tx_hash, log_index) DO NOTHING`,
    ).run(
      input.intentHash.toLowerCase(),
      input.owner.toLowerCase(),
      input.manifestUri,
      1,
      Number(input.blockNumber),
      input.txHash.toLowerCase(),
      input.logIndex,
      createdAt,
    );
  });
  tx();
}

export function markIntentRevoked(owner: Address): void {
  const db = getDb();
  db.prepare(`UPDATE intents SET active = 0 WHERE owner = ? AND active = 1`).run(
    owner.toLowerCase(),
  );
}

export function getActiveIntent(owner: Address): IntentRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM intents WHERE owner = ? AND active = 1 ORDER BY block_number DESC LIMIT 1`,
    )
    .get(owner.toLowerCase()) as Record<string, unknown> | undefined;
  return row ? rowToIntent(row) : null;
}

export function listIntentsByOwner(owner: Address, limit = 100): IntentRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM intents WHERE owner = ? ORDER BY block_number DESC LIMIT ?`,
    )
    .all(owner.toLowerCase(), limit) as Record<string, unknown>[];
  return rows.map(rowToIntent);
}

function rowToIntent(row: Record<string, unknown>): IntentRow {
  return {
    intentHash: row.intent_hash as Hex,
    owner: row.owner as Address,
    manifestUri: row.manifest_uri as string,
    active: !!row.active,
    blockNumber: row.block_number as number,
    txHash: row.tx_hash as Hex,
    logIndex: row.log_index as number,
    createdAt: row.created_at as number,
  };
}
