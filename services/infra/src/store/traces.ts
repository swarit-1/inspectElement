import type { Address, Hex } from "viem";
import { getDb } from "./db.js";

export interface TraceRow {
  contextDigest: Hex;
  traceUri: string;
  uriHash: Hex;
  agentId: Hex | null;
  owner: Address | null;
  traceJson: string;
  expiresAt: bigint;
  signer: Address;
  signature: Hex;
  createdAt: number;
}

export interface InsertTraceInput {
  contextDigest: Hex;
  traceUri: string;
  uriHash: Hex;
  agentId: Hex | null;
  owner: Address | null;
  traceJson: string;
  expiresAt: bigint;
  signer: Address;
  signature: Hex;
}

export function insertTrace(input: InsertTraceInput): TraceRow {
  const db = getDb();
  const createdAt = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO traces (
       context_digest, trace_uri, uri_hash, agent_id, owner,
       trace_json, expires_at, signer, signature, created_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(context_digest) DO UPDATE SET
       trace_uri = excluded.trace_uri,
       uri_hash  = excluded.uri_hash,
       expires_at = excluded.expires_at,
       signer    = excluded.signer,
       signature = excluded.signature`,
  ).run(
    input.contextDigest.toLowerCase(),
    input.traceUri,
    input.uriHash.toLowerCase(),
    input.agentId ? input.agentId.toLowerCase() : null,
    input.owner ? input.owner.toLowerCase() : null,
    input.traceJson,
    Number(input.expiresAt),
    input.signer.toLowerCase(),
    input.signature.toLowerCase(),
    createdAt,
  );
  return {
    ...input,
    contextDigest: input.contextDigest.toLowerCase() as Hex,
    uriHash: input.uriHash.toLowerCase() as Hex,
    agentId: input.agentId ? (input.agentId.toLowerCase() as Hex) : null,
    owner: input.owner ? (input.owner.toLowerCase() as Address) : null,
    signer: input.signer.toLowerCase() as Address,
    signature: input.signature.toLowerCase() as Hex,
    createdAt,
  };
}

export function getTraceByDigest(contextDigest: Hex): TraceRow | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM traces WHERE context_digest = ?`)
    .get(contextDigest.toLowerCase()) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    contextDigest: row.context_digest as Hex,
    traceUri: row.trace_uri as string,
    uriHash: row.uri_hash as Hex,
    agentId: (row.agent_id as Hex | null) ?? null,
    owner: (row.owner as Address | null) ?? null,
    traceJson: row.trace_json as string,
    expiresAt: BigInt(row.expires_at as number),
    signer: row.signer as Address,
    signature: row.signature as Hex,
    createdAt: row.created_at as number,
  };
}
