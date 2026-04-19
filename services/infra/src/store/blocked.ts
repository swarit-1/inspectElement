import type { Address, Hex } from "viem";
import { db, getDb, getProvider } from "./db.js";

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

export async function insertBlockedAttempt(input: InsertBlockedAttemptInput): Promise<BlockedAttemptRow> {
  const createdAt = Math.floor(Date.now() / 1000);
  const row = {
    scenario_id: input.scenarioId ?? null,
    owner: input.owner ? input.owner.toLowerCase() : null,
    agent_id: input.agentId ? input.agentId.toLowerCase() : null,
    target: input.target ? input.target.toLowerCase() : null,
    token: input.token ? input.token.toLowerCase() : null,
    amount: input.amount != null ? input.amount.toString(10) : null,
    reason_code: input.reasonCode,
    reason_label: input.reasonLabel ?? null,
    source: input.source ?? "demo-status",
    created_at: createdAt,
  };

  let id: number;

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const result = sqliteDb
      .prepare(
        `INSERT INTO blocked_attempts (
           scenario_id, owner, agent_id, target, token, amount,
           reason_code, reason_label, source, created_at
         ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        row.scenario_id,
        row.owner,
        row.agent_id,
        row.target,
        row.token,
        row.amount,
        row.reason_code,
        row.reason_label,
        row.source,
        row.created_at,
      );
    id = Number(result.lastInsertRowid);
  } else {
    const { data } = await db()
      .from("blocked_attempts")
      .insert(row)
      .select("id")
      .single();
    id = data?.id ?? 0;
  }

  return {
    id,
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

export async function listBlockedByOwner(owner: Address | null, limit = 100): Promise<BlockedAttemptRow[]> {
  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const rows = (
      owner
        ? sqliteDb
            .prepare(
              `SELECT * FROM blocked_attempts WHERE owner = ? OR owner IS NULL ORDER BY created_at DESC LIMIT ?`,
            )
            .all(owner.toLowerCase(), limit)
        : sqliteDb
            .prepare(`SELECT * FROM blocked_attempts ORDER BY created_at DESC LIMIT ?`)
            .all(limit)
    ) as Record<string, unknown>[];
    return rows.map(rowToBlocked);
  }

  let query = db()
    .from("blocked_attempts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (owner) {
    query = query.or(`owner.eq.${owner.toLowerCase()},owner.is.null`);
  }

  const { data } = await query;
  return (data ?? []).map(rowToBlocked);
}

export async function blockedAttemptExists(scenarioId: string): Promise<boolean> {
  if (!scenarioId) return false;

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const row = sqliteDb
      .prepare(`SELECT 1 FROM blocked_attempts WHERE scenario_id = ? LIMIT 1`)
      .get(scenarioId);
    return !!row;
  }

  const { data } = await db()
    .from("blocked_attempts")
    .select("id")
    .eq("scenario_id", scenarioId)
    .limit(1);
  return (data ?? []).length > 0;
}

function rowToBlocked(row: Record<string, unknown>): BlockedAttemptRow {
  return {
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
  };
}
