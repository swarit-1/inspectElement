import crypto from "node:crypto";
import type { Address, Hex } from "viem";
import { db, getDb, getProvider } from "./db.js";

export type ExecutionStatus = "pending" | "preflight" | "allowed" | "blocked" | "executed" | "failed";

export interface ExecutionRow {
  id: string;
  owner: Address;
  agentId: Hex;
  status: ExecutionStatus;
  proposedAction: string;
  traceJson: string | null;
  contextDigest: Hex | null;
  resultJson: string | null;
  blockReason: string | null;
  receiptId: Hex | null;
  txHash: Hex | null;
  createdAt: number;
  updatedAt: number;
}

export interface InsertExecutionInput {
  owner: Address;
  agentId: Hex;
  proposedAction: string;
  traceJson?: string;
  contextDigest?: Hex;
}

export async function insertExecution(input: InsertExecutionInput): Promise<ExecutionRow> {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const row = {
    id,
    owner: input.owner.toLowerCase(),
    agent_id: input.agentId.toLowerCase(),
    status: "pending" as ExecutionStatus,
    proposed_action: input.proposedAction,
    trace_json: input.traceJson ?? null,
    context_digest: input.contextDigest?.toLowerCase() ?? null,
    result_json: null,
    block_reason: null,
    receipt_id: null,
    tx_hash: null,
    created_at: now,
    updated_at: now,
  };

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    sqliteDb
      .prepare(
        `INSERT INTO executions (
           id, owner, agent_id, status, proposed_action, trace_json,
           context_digest, result_json, block_reason, receipt_id, tx_hash,
           created_at, updated_at
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        row.id, row.owner, row.agent_id, row.status, row.proposed_action,
        row.trace_json, row.context_digest, row.result_json, row.block_reason,
        row.receipt_id, row.tx_hash, row.created_at, row.updated_at,
      );
  } else {
    await db().from("executions").insert(row);
  }

  return {
    id,
    owner: input.owner,
    agentId: input.agentId,
    status: "pending",
    proposedAction: input.proposedAction,
    traceJson: input.traceJson ?? null,
    contextDigest: input.contextDigest ?? null,
    resultJson: null,
    blockReason: null,
    receiptId: null,
    txHash: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateExecution(
  id: string,
  updates: Partial<{
    status: ExecutionStatus;
    resultJson: string;
    blockReason: string;
    receiptId: Hex;
    txHash: Hex;
    contextDigest: Hex;
  }>,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const sets: string[] = ["updated_at = ?"];
    const vals: unknown[] = [now];

    if (updates.status !== undefined) { sets.push("status = ?"); vals.push(updates.status); }
    if (updates.resultJson !== undefined) { sets.push("result_json = ?"); vals.push(updates.resultJson); }
    if (updates.blockReason !== undefined) { sets.push("block_reason = ?"); vals.push(updates.blockReason); }
    if (updates.receiptId !== undefined) { sets.push("receipt_id = ?"); vals.push(updates.receiptId.toLowerCase()); }
    if (updates.txHash !== undefined) { sets.push("tx_hash = ?"); vals.push(updates.txHash.toLowerCase()); }
    if (updates.contextDigest !== undefined) { sets.push("context_digest = ?"); vals.push(updates.contextDigest.toLowerCase()); }

    vals.push(id);
    sqliteDb.prepare(`UPDATE executions SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  } else {
    const dbUpdates: Record<string, unknown> = { updated_at: now };
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.resultJson !== undefined) dbUpdates.result_json = updates.resultJson;
    if (updates.blockReason !== undefined) dbUpdates.block_reason = updates.blockReason;
    if (updates.receiptId !== undefined) dbUpdates.receipt_id = updates.receiptId.toLowerCase();
    if (updates.txHash !== undefined) dbUpdates.tx_hash = updates.txHash.toLowerCase();
    if (updates.contextDigest !== undefined) dbUpdates.context_digest = updates.contextDigest.toLowerCase();

    await db().from("executions").update(dbUpdates).eq("id", id);
  }
}

export async function getExecution(id: string): Promise<ExecutionRow | null> {
  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const row = sqliteDb
      .prepare(`SELECT * FROM executions WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? rowToExecution(row) : null;
  }

  const { data } = await db()
    .from("executions")
    .select("*")
    .eq("id", id)
    .single();
  return data ? rowToExecution(data) : null;
}

function rowToExecution(row: Record<string, unknown>): ExecutionRow {
  return {
    id: row.id as string,
    owner: row.owner as Address,
    agentId: row.agent_id as Hex,
    status: row.status as ExecutionStatus,
    proposedAction: row.proposed_action as string,
    traceJson: (row.trace_json as string | null) ?? null,
    contextDigest: (row.context_digest as Hex | null) ?? null,
    resultJson: (row.result_json as string | null) ?? null,
    blockReason: (row.block_reason as string | null) ?? null,
    receiptId: (row.receipt_id as Hex | null) ?? null,
    txHash: (row.tx_hash as Hex | null) ?? null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}
