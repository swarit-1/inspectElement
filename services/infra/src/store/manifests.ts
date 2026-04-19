import type { Address, Hex } from "viem";
import { db, getDb, getProvider } from "./db.js";

export interface ManifestRow {
  intentHash: Hex;
  manifestUri: string;
  manifestJson: string;
  owner: Address;
  token: Address;
  maxSpendPerTx: bigint;
  maxSpendPerDay: bigint;
  expiry: bigint;
  nonce: bigint;
  allowedCounterparties: Address[];
  createdAt: number;
}

export interface InsertManifestInput {
  intentHash: Hex;
  manifestUri: string;
  manifestJson: string;
  owner: Address;
  token: Address;
  maxSpendPerTx: bigint;
  maxSpendPerDay: bigint;
  expiry: bigint;
  nonce: bigint;
  allowedCounterparties: Address[];
}

export async function insertManifest(input: InsertManifestInput): Promise<ManifestRow> {
  const createdAt = nowSec();
  const norm = {
    intentHash: input.intentHash.toLowerCase() as Hex,
    owner: input.owner.toLowerCase() as Address,
    token: input.token.toLowerCase() as Address,
    allowedCounterparties: input.allowedCounterparties.map((a) => a.toLowerCase() as Address),
  };

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    sqliteDb
      .prepare(
        `INSERT INTO manifests (
           intent_hash, manifest_uri, manifest_json, owner, token,
           max_spend_per_tx, max_spend_per_day, expiry, nonce,
           allowed_counterparties_json, created_at
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(intent_hash) DO UPDATE SET
           manifest_uri = excluded.manifest_uri,
           manifest_json = excluded.manifest_json`,
      )
      .run(
        norm.intentHash,
        input.manifestUri,
        input.manifestJson,
        norm.owner,
        norm.token,
        input.maxSpendPerTx.toString(10),
        input.maxSpendPerDay.toString(10),
        Number(input.expiry),
        input.nonce.toString(10),
        JSON.stringify(norm.allowedCounterparties),
        createdAt,
      );
  } else {
    await db()
      .from("manifests")
      .upsert(
        {
          intent_hash: norm.intentHash,
          manifest_uri: input.manifestUri,
          manifest_json: input.manifestJson,
          owner: norm.owner,
          token: norm.token,
          max_spend_per_tx: input.maxSpendPerTx.toString(10),
          max_spend_per_day: input.maxSpendPerDay.toString(10),
          expiry: Number(input.expiry),
          nonce: input.nonce.toString(10),
          allowed_counterparties_json: JSON.stringify(norm.allowedCounterparties),
          created_at: createdAt,
        },
        { onConflict: "intent_hash" },
      );
  }

  return {
    ...input,
    ...norm,
    createdAt,
  };
}

export async function getManifestByHash(intentHash: Hex): Promise<ManifestRow | null> {
  const key = intentHash.toLowerCase();

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const row = sqliteDb
      .prepare(`SELECT * FROM manifests WHERE intent_hash = ?`)
      .get(key) as Record<string, unknown> | undefined;
    return row ? rowToManifest(row) : null;
  }

  const { data } = await db()
    .from("manifests")
    .select("*")
    .eq("intent_hash", key)
    .single();
  return data ? rowToManifest(data) : null;
}

function rowToManifest(row: Record<string, unknown>): ManifestRow {
  return {
    intentHash: row.intent_hash as Hex,
    manifestUri: row.manifest_uri as string,
    manifestJson: row.manifest_json as string,
    owner: row.owner as Address,
    token: row.token as Address,
    maxSpendPerTx: BigInt(row.max_spend_per_tx as string),
    maxSpendPerDay: BigInt(row.max_spend_per_day as string),
    expiry: BigInt(row.expiry as number),
    nonce: BigInt(row.nonce as string),
    allowedCounterparties: JSON.parse(row.allowed_counterparties_json as string) as Address[],
    createdAt: row.created_at as number,
  };
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}
