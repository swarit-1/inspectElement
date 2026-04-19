import type { Address, Hex } from "viem";
import { db, getDb, getProvider } from "./db.js";

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

export async function insertIntentCommitted(input: {
  intentHash: Hex;
  owner: Address;
  manifestUri: string;
  blockNumber: bigint;
  txHash: Hex;
  logIndex: number;
}): Promise<void> {
  const createdAt = Math.floor(Date.now() / 1000);
  const ownerLower = input.owner.toLowerCase();

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const tx = sqliteDb.transaction(() => {
      sqliteDb
        .prepare(`UPDATE intents SET active = 0 WHERE owner = ? AND active = 1`)
        .run(ownerLower);
      sqliteDb
        .prepare(
          `INSERT INTO intents (
             intent_hash, owner, manifest_uri, active,
             block_number, tx_hash, log_index, created_at
           ) VALUES (?,?,?,?,?,?,?,?)
           ON CONFLICT(tx_hash, log_index) DO NOTHING`,
        )
        .run(
          input.intentHash.toLowerCase(),
          ownerLower,
          input.manifestUri,
          1,
          Number(input.blockNumber),
          input.txHash.toLowerCase(),
          input.logIndex,
          createdAt,
        );
    });
    tx();
  } else {
    const supabase = db();
    // Deactivate existing active intents for this owner
    await supabase
      .from("intents")
      .update({ active: false })
      .eq("owner", ownerLower)
      .eq("active", true);

    // Insert new intent (ignore conflict on tx_hash + log_index)
    await supabase.from("intents").upsert(
      {
        intent_hash: input.intentHash.toLowerCase(),
        owner: ownerLower,
        manifest_uri: input.manifestUri,
        active: true,
        block_number: Number(input.blockNumber),
        tx_hash: input.txHash.toLowerCase(),
        log_index: input.logIndex,
        created_at: createdAt,
      },
      { onConflict: "intent_hash", ignoreDuplicates: true },
    );
  }
}

export async function markIntentRevoked(owner: Address): Promise<void> {
  const key = owner.toLowerCase();

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    sqliteDb
      .prepare(`UPDATE intents SET active = 0 WHERE owner = ? AND active = 1`)
      .run(key);
  } else {
    await db()
      .from("intents")
      .update({ active: false })
      .eq("owner", key)
      .eq("active", true);
  }
}

export async function getActiveIntent(owner: Address): Promise<IntentRow | null> {
  const key = owner.toLowerCase();

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const row = sqliteDb
      .prepare(
        `SELECT * FROM intents WHERE owner = ? AND active = 1 ORDER BY block_number DESC LIMIT 1`,
      )
      .get(key) as Record<string, unknown> | undefined;
    return row ? rowToIntent(row) : null;
  }

  const { data } = await db()
    .from("intents")
    .select("*")
    .eq("owner", key)
    .eq("active", true)
    .order("block_number", { ascending: false })
    .limit(1)
    .single();
  return data ? rowToIntent(data) : null;
}

export async function listIntentsByOwner(owner: Address, limit = 100): Promise<IntentRow[]> {
  const key = owner.toLowerCase();

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const rows = sqliteDb
      .prepare(
        `SELECT * FROM intents WHERE owner = ? ORDER BY block_number DESC LIMIT ?`,
      )
      .all(key, limit) as Record<string, unknown>[];
    return rows.map(rowToIntent);
  }

  const { data } = await db()
    .from("intents")
    .select("*")
    .eq("owner", key)
    .order("block_number", { ascending: false })
    .limit(limit);
  return (data ?? []).map(rowToIntent);
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
