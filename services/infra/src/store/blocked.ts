import type { Address, Hex } from "viem";
import { getDb } from "./db.js";

export interface BlockedAttemptRow {
  id: number;
  scenarioId: string | null;
  owner: Address | null;
  agentId: Hex | null;
  target: Address | null;
  token: Address | null;
  amount: bigint | null;
  reasonCode: string;
  reasonLabel: string | null;
  source: string;
  createdAt: number;
}

export interface InsertBlockedAttemptInput {
  scenarioId?: string | null;
  owner?: Address | null;
  agentId?: Hex | null;
  target?: Address | null;
  token?: Address | null;
  amount?: bigint | null;
  reasonCode: string;
  reasonLabel?: string | null;
  source?: string;
}

export function insertBlockedAttempt(input: InsertBlockedAttemptInput): BlockedAttemptRow {
  const db = getDb();
  const createdAt = Math.floor(Date.now() / 1000);
  const result = db
    .prepare(
      `INSERT INTO blocked_attempts (
         scenario_id, owner, agent_id, target, token, amount,
         reason_code, reason_label, source, created_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      input.scenarioId ?? null,
      input.owner ? input.owner.toLowerCase() : null,
      input.agentId ? input.agentId.toLowerCase() : null,
      input.target ? input.target.toLowerCase() : null,
      input.token ? input.token.toLowerCase() : null,
      input.amount != null ? input.amount.toString(10) : null,
      input.reasonCode,
      input.reasonLabel ?? null,
      input.source ?? "demo-status",
      createdAt,
    );
  return {
    id: Number(result.lastInsertRowid),
    scenarioId: input.scenarioId ?? null,
    owner: input.owner ?? null,
    agentId: input.agentId ?? null,
    target: input.target ?? null,
    token: input.token ?? null,
    amount: input.amount ?? null,
    reasonCode: input.reasonCode,
    reasonLabel: input.reasonLabel ?? null,
    source: input.source ?? "demo-status",
    createdAt,
  };
}

export function listBlockedByOwner(owner: Address | null, limit = 100): BlockedAttemptRow[] {
  const db = getDb();
  const rows = (
    owner
      ? db
          .prepare(
            `SELECT * FROM blocked_attempts WHERE owner = ? OR owner IS NULL ORDER BY created_at DESC LIMIT ?`,
          )
          .all(owner.toLowerCase(), limit)
      : db
          .prepare(`SELECT * FROM blocked_attempts ORDER BY created_at DESC LIMIT ?`)
          .all(limit)
  ) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as number,
    scenarioId: (row.scenario_id as string | null) ?? null,
    owner: (row.owner as Address | null) ?? null,
    agentId: (row.agent_id as Hex | null) ?? null,
    target: (row.target as Address | null) ?? null,
    token: (row.token as Address | null) ?? null,
    amount: row.amount != null ? BigInt(row.amount as string) : null,
    reasonCode: row.reason_code as string,
    reasonLabel: (row.reason_label as string | null) ?? null,
    source: row.source as string,
    createdAt: row.created_at as number,
  }));
}

/**
 * Idempotency helper for the demo-status poller — avoids duplicating the same
 * blocked entry every poll. We treat (scenarioId, reasonCode) as a natural
 * dedupe key. Returns true if a row with the same scenarioId already exists.
 */
export function blockedAttemptExists(scenarioId: string): boolean {
  if (!scenarioId) return false;
  const db = getDb();
  const row = db
    .prepare(`SELECT 1 FROM blocked_attempts WHERE scenario_id = ? LIMIT 1`)
    .get(scenarioId);
  return !!row;
}
