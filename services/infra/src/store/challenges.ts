import type { Address, Hex } from "viem";
import { db, getDb, getProvider } from "./db.js";

export type ChallengeStatus = "FILED" | "UPHELD" | "REJECTED";

export interface ChallengeRow {
  challengeId: string;
  receiptId: Hex;
  challenger: Address;
  status: ChallengeStatus;
  payout: bigint | null;
  filedBlock: number;
  filedTx: Hex;
  filedAt: number;
  resolvedBlock: number | null;
  resolvedTx: Hex | null;
  resolvedAt: number | null;
}

export interface InsertChallengeInput {
  challengeId: bigint;
  receiptId: Hex;
  challenger: Address;
  blockNumber: bigint;
  txHash: Hex;
  blockTimestamp: bigint;
}

export interface ResolveChallengeInput {
  challengeId: bigint;
  uphold: boolean;
  payout: bigint;
  blockNumber: bigint;
  txHash: Hex;
  blockTimestamp: bigint;
}

export async function upsertChallengeFiled(input: InsertChallengeInput): Promise<void> {
  const row = {
    challenge_id: input.challengeId.toString(10),
    receipt_id: input.receiptId.toLowerCase(),
    challenger: input.challenger.toLowerCase(),
    status: "FILED" as const,
    filed_block: Number(input.blockNumber),
    filed_tx: input.txHash.toLowerCase(),
    filed_at: Number(input.blockTimestamp),
  };

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    sqliteDb
      .prepare(
        `INSERT INTO challenges (
           challenge_id, receipt_id, challenger, status,
           filed_block, filed_tx, filed_at
         ) VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(challenge_id) DO UPDATE SET
           receipt_id = excluded.receipt_id,
           challenger = excluded.challenger,
           filed_block = excluded.filed_block,
           filed_tx = excluded.filed_tx,
           filed_at = excluded.filed_at`,
      )
      .run(
        row.challenge_id,
        row.receipt_id,
        row.challenger,
        row.status,
        row.filed_block,
        row.filed_tx,
        row.filed_at,
      );
  } else {
    await db()
      .from("challenges")
      .upsert(row, { onConflict: "challenge_id" });
  }
}

export async function resolveChallenge(input: ResolveChallengeInput): Promise<void> {
  const status: ChallengeStatus = input.uphold ? "UPHELD" : "REJECTED";
  const id = input.challengeId.toString(10);
  const updates = {
    status,
    payout: input.payout.toString(10),
    resolved_block: Number(input.blockNumber),
    resolved_tx: input.txHash.toLowerCase(),
    resolved_at: Number(input.blockTimestamp),
  };

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    sqliteDb
      .prepare(
        `UPDATE challenges SET
           status = ?, payout = ?, resolved_block = ?,
           resolved_tx = ?, resolved_at = ?
         WHERE challenge_id = ?`,
      )
      .run(updates.status, updates.payout, updates.resolved_block, updates.resolved_tx, updates.resolved_at, id);
  } else {
    await db()
      .from("challenges")
      .update(updates)
      .eq("challenge_id", id);
  }
}

export async function getChallenge(challengeId: string): Promise<ChallengeRow | null> {
  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const row = sqliteDb
      .prepare(`SELECT * FROM challenges WHERE challenge_id = ?`)
      .get(challengeId) as Record<string, unknown> | undefined;
    return row ? rowToChallenge(row) : null;
  }

  const { data } = await db()
    .from("challenges")
    .select("*")
    .eq("challenge_id", challengeId)
    .single();
  return data ? rowToChallenge(data) : null;
}

export async function findChallengeByReceipt(receiptId: Hex): Promise<ChallengeRow | null> {
  const key = receiptId.toLowerCase();

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const row = sqliteDb
      .prepare(
        `SELECT * FROM challenges WHERE receipt_id = ? ORDER BY filed_block DESC, filed_at DESC LIMIT 1`,
      )
      .get(key) as Record<string, unknown> | undefined;
    return row ? rowToChallenge(row) : null;
  }

  const { data } = await db()
    .from("challenges")
    .select("*")
    .eq("receipt_id", key)
    .order("filed_block", { ascending: false })
    .order("filed_at", { ascending: false })
    .limit(1)
    .single();
  return data ? rowToChallenge(data) : null;
}

export async function listChallengesByOwner(owner: Address, limit = 100): Promise<ChallengeRow[]> {
  const key = owner.toLowerCase();

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const rows = sqliteDb
      .prepare(
        `SELECT c.*
           FROM challenges c
           JOIN receipts r ON r.receipt_id = c.receipt_id
          WHERE r.owner = ?
          ORDER BY c.filed_block DESC, c.filed_at DESC
          LIMIT ?`,
      )
      .all(key, limit) as Record<string, unknown>[];
    return rows.map(rowToChallenge);
  }

  // For Supabase, we need to get receipt_ids for this owner first, then query challenges
  const { data: receiptData } = await db()
    .from("receipts")
    .select("receipt_id")
    .eq("owner", key);
  const receiptIds = (receiptData ?? []).map((r: Record<string, unknown>) => r.receipt_id as string);
  if (receiptIds.length === 0) return [];

  const { data } = await db()
    .from("challenges")
    .select("*")
    .in("receipt_id", receiptIds)
    .order("filed_block", { ascending: false })
    .order("filed_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(rowToChallenge);
}

function rowToChallenge(row: Record<string, unknown>): ChallengeRow {
  return {
    challengeId: row.challenge_id as string,
    receiptId: row.receipt_id as Hex,
    challenger: row.challenger as Address,
    status: row.status as ChallengeStatus,
    payout: row.payout != null ? BigInt(row.payout as string) : null,
    filedBlock: row.filed_block as number,
    filedTx: row.filed_tx as Hex,
    filedAt: row.filed_at as number,
    resolvedBlock: (row.resolved_block as number | null) ?? null,
    resolvedTx: (row.resolved_tx as Hex | null) ?? null,
    resolvedAt: (row.resolved_at as number | null) ?? null,
  };
}
