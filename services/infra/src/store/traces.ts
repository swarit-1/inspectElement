import type { Address, Hex } from "viem";
import { db, getDb, getProvider } from "./db.js";

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

export async function insertTrace(input: InsertTraceInput): Promise<TraceRow> {
  const createdAt = Math.floor(Date.now() / 1000);
  const norm = {
    contextDigest: input.contextDigest.toLowerCase() as Hex,
    uriHash: input.uriHash.toLowerCase() as Hex,
    agentId: input.agentId ? (input.agentId.toLowerCase() as Hex) : null,
    owner: input.owner ? (input.owner.toLowerCase() as Address) : null,
    signer: input.signer.toLowerCase() as Address,
    signature: input.signature.toLowerCase() as Hex,
  };

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    sqliteDb
      .prepare(
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
      )
      .run(
        norm.contextDigest,
        input.traceUri,
        norm.uriHash,
        norm.agentId,
        norm.owner,
        input.traceJson,
        Number(input.expiresAt),
        norm.signer,
        norm.signature,
        createdAt,
      );
  } else {
    await db()
      .from("traces")
      .upsert(
        {
          context_digest: norm.contextDigest,
          trace_uri: input.traceUri,
          uri_hash: norm.uriHash,
          agent_id: norm.agentId,
          owner: norm.owner,
          trace_json: input.traceJson,
          expires_at: Number(input.expiresAt),
          signer: norm.signer,
          signature: norm.signature,
          created_at: createdAt,
        },
        { onConflict: "context_digest" },
      );
  }

  return { ...input, ...norm, createdAt };
}

export async function getTraceByDigest(contextDigest: Hex): Promise<TraceRow | null> {
  const key = contextDigest.toLowerCase();

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const row = sqliteDb
      .prepare(`SELECT * FROM traces WHERE context_digest = ?`)
      .get(key) as Record<string, unknown> | undefined;
    return row ? rowToTrace(row) : null;
  }

  const { data } = await db()
    .from("traces")
    .select("*")
    .eq("context_digest", key)
    .single();
  return data ? rowToTrace(data) : null;
}

function rowToTrace(row: Record<string, unknown>): TraceRow {
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
