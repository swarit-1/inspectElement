import type { Address, Hex } from "viem";
import { getDb } from "./db.js";

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

export function insertManifest(input: InsertManifestInput): ManifestRow {
  const db = getDb();
  const createdAt = nowSec();
  const stmt = db.prepare(
    `INSERT INTO manifests (
       intent_hash, manifest_uri, manifest_json, owner, token,
       max_spend_per_tx, max_spend_per_day, expiry, nonce,
       allowed_counterparties_json, created_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(intent_hash) DO UPDATE SET
       manifest_uri = excluded.manifest_uri,
       manifest_json = excluded.manifest_json`,
  );
  stmt.run(
    input.intentHash.toLowerCase(),
    input.manifestUri,
    input.manifestJson,
    input.owner.toLowerCase(),
    input.token.toLowerCase(),
    input.maxSpendPerTx.toString(10),
    input.maxSpendPerDay.toString(10),
    Number(input.expiry),
    input.nonce.toString(10),
    JSON.stringify(input.allowedCounterparties.map((a) => a.toLowerCase())),
    createdAt,
  );
  return {
    ...input,
    intentHash: input.intentHash.toLowerCase() as Hex,
    owner: input.owner.toLowerCase() as Address,
    token: input.token.toLowerCase() as Address,
    allowedCounterparties: input.allowedCounterparties.map(
      (a) => a.toLowerCase() as Address,
    ),
    createdAt,
  };
}

export function getManifestByHash(intentHash: Hex): ManifestRow | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM manifests WHERE intent_hash = ?`)
    .get(intentHash.toLowerCase()) as Record<string, unknown> | undefined;
  return row ? rowToManifest(row) : null;
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
