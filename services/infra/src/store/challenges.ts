import type { Address, Hex } from "viem";
import { getDb } from "./db.js";

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

export function upsertChallengeFiled(input: InsertChallengeInput): void {
  const db = getDb();
  db.prepare(
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
  ).run(
    input.challengeId.toString(10),
    input.receiptId.toLowerCase(),
    input.challenger.toLowerCase(),
    "FILED",
    Number(input.blockNumber),
    input.txHash.toLowerCase(),
    Number(input.blockTimestamp),
  );
}

export function resolveChallenge(input: ResolveChallengeInput): void {
  const db = getDb();
  const status: ChallengeStatus = input.uphold ? "UPHELD" : "REJECTED";
  db.prepare(
    `UPDATE challenges SET
       status = ?,
       payout = ?,
       resolved_block = ?,
       resolved_tx = ?,
       resolved_at = ?
     WHERE challenge_id = ?`,
  ).run(
    status,
    input.payout.toString(10),
    Number(input.blockNumber),
    input.txHash.toLowerCase(),
    Number(input.blockTimestamp),
    input.challengeId.toString(10),
  );
}

export function getChallenge(challengeId: string): ChallengeRow | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM challenges WHERE challenge_id = ?`)
    .get(challengeId) as Record<string, unknown> | undefined;
  return row ? rowToChallenge(row) : null;
}

export function findChallengeByReceipt(receiptId: Hex): ChallengeRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM challenges WHERE receipt_id = ? ORDER BY filed_block DESC, filed_at DESC LIMIT 1`,
    )
    .get(receiptId.toLowerCase()) as Record<string, unknown> | undefined;
  return row ? rowToChallenge(row) : null;
}

export function listChallengesByOwner(owner: Address, limit = 100): ChallengeRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.*
         FROM challenges c
         JOIN receipts r ON r.receipt_id = c.receipt_id
        WHERE r.owner = ?
        ORDER BY c.filed_block DESC, c.filed_at DESC
        LIMIT ?`,
    )
    .all(owner.toLowerCase(), limit) as Record<string, unknown>[];
  return rows.map(rowToChallenge);
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
