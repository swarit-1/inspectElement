import type { Address, Hex } from "viem";
import { db, getDb, getProvider } from "./db.js";

export interface AgentRow {
  agentId: Hex;
  operator: Address;
  metadataUri: string;
  totalStake: bigint;
  blockNumber: number;
  txHash: Hex;
  createdAt: number;
}

export async function upsertAgentRegistered(input: {
  agentId: Hex;
  operator: Address;
  metadataUri: string;
  blockNumber: bigint;
  txHash: Hex;
}): Promise<void> {
  const createdAt = Math.floor(Date.now() / 1000);
  const row = {
    agent_id: input.agentId.toLowerCase(),
    operator: input.operator.toLowerCase(),
    metadata_uri: input.metadataUri,
    total_stake: "0",
    block_number: Number(input.blockNumber),
    tx_hash: input.txHash.toLowerCase(),
    created_at: createdAt,
  };

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    sqliteDb
      .prepare(
        `INSERT INTO agents (agent_id, operator, metadata_uri, total_stake, block_number, tx_hash, created_at)
         VALUES (?,?,?, '0', ?, ?, ?)
         ON CONFLICT(agent_id) DO UPDATE SET
           operator = excluded.operator,
           metadata_uri = excluded.metadata_uri`,
      )
      .run(row.agent_id, row.operator, row.metadata_uri, row.block_number, row.tx_hash, row.created_at);
  } else {
    await db()
      .from("agents")
      .upsert(row, { onConflict: "agent_id" });
  }
}

export async function applyStakeIncrease(input: {
  agentId: Hex;
  newStake: bigint;
}): Promise<void> {
  const key = input.agentId.toLowerCase();
  const stakeStr = input.newStake.toString(10);

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    sqliteDb.prepare(`UPDATE agents SET total_stake = ? WHERE agent_id = ?`).run(stakeStr, key);
  } else {
    await db()
      .from("agents")
      .update({ total_stake: stakeStr })
      .eq("agent_id", key);
  }
}

export async function getAgent(agentId: Hex): Promise<AgentRow | null> {
  const key = agentId.toLowerCase();

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const row = sqliteDb
      .prepare(`SELECT * FROM agents WHERE agent_id = ?`)
      .get(key) as Record<string, unknown> | undefined;
    return row ? rowToAgent(row) : null;
  }

  const { data } = await db()
    .from("agents")
    .select("*")
    .eq("agent_id", key)
    .single();
  return data ? rowToAgent(data) : null;
}

export async function insertDelegate(input: {
  owner: Address;
  agentId: Hex;
  delegate: Address;
  approved: boolean;
  blockNumber: bigint;
  txHash: Hex;
  logIndex: number;
}): Promise<void> {
  const createdAt = Math.floor(Date.now() / 1000);
  const row = {
    owner: input.owner.toLowerCase(),
    agent_id: input.agentId.toLowerCase(),
    delegate: input.delegate.toLowerCase(),
    approved: input.approved,
    block_number: Number(input.blockNumber),
    tx_hash: input.txHash.toLowerCase(),
    log_index: input.logIndex,
    created_at: createdAt,
  };

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    sqliteDb
      .prepare(
        `INSERT OR REPLACE INTO delegates (
           owner, agent_id, delegate, approved, block_number, tx_hash, log_index, created_at
         ) VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(
        row.owner,
        row.agent_id,
        row.delegate,
        input.approved ? 1 : 0,
        row.block_number,
        row.tx_hash,
        row.log_index,
        row.created_at,
      );
  } else {
    await db()
      .from("delegates")
      .upsert(row, { onConflict: "owner,agent_id,delegate,log_index,tx_hash" });
  }
}

function rowToAgent(row: Record<string, unknown>): AgentRow {
  return {
    agentId: row.agent_id as Hex,
    operator: row.operator as Address,
    metadataUri: row.metadata_uri as string,
    totalStake: BigInt(row.total_stake as string),
    blockNumber: row.block_number as number,
    txHash: row.tx_hash as Hex,
    createdAt: row.created_at as number,
  };
}
