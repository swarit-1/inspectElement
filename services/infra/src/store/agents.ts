import type { Address, Hex } from "viem";
import { getDb } from "./db.js";

export interface AgentRow {
  agentId: Hex;
  operator: Address;
  metadataUri: string;
  totalStake: bigint;
  blockNumber: number;
  txHash: Hex;
  createdAt: number;
}

export function upsertAgentRegistered(input: {
  agentId: Hex;
  operator: Address;
  metadataUri: string;
  blockNumber: bigint;
  txHash: Hex;
}): void {
  const db = getDb();
  const createdAt = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO agents (agent_id, operator, metadata_uri, total_stake, block_number, tx_hash, created_at)
     VALUES (?,?,?, '0', ?, ?, ?)
     ON CONFLICT(agent_id) DO UPDATE SET
       operator = excluded.operator,
       metadata_uri = excluded.metadata_uri`,
  ).run(
    input.agentId.toLowerCase(),
    input.operator.toLowerCase(),
    input.metadataUri,
    Number(input.blockNumber),
    input.txHash.toLowerCase(),
    createdAt,
  );
}

export function applyStakeIncrease(input: {
  agentId: Hex;
  newStake: bigint;
}): void {
  const db = getDb();
  db.prepare(`UPDATE agents SET total_stake = ? WHERE agent_id = ?`).run(
    input.newStake.toString(10),
    input.agentId.toLowerCase(),
  );
}

export function getAgent(agentId: Hex): AgentRow | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM agents WHERE agent_id = ?`)
    .get(agentId.toLowerCase()) as Record<string, unknown> | undefined;
  if (!row) return null;
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

export function insertDelegate(input: {
  owner: Address;
  agentId: Hex;
  delegate: Address;
  approved: boolean;
  blockNumber: bigint;
  txHash: Hex;
  logIndex: number;
}): void {
  const db = getDb();
  const createdAt = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT OR REPLACE INTO delegates (
       owner, agent_id, delegate, approved, block_number, tx_hash, log_index, created_at
     ) VALUES (?,?,?,?,?,?,?,?)`,
  ).run(
    input.owner.toLowerCase(),
    input.agentId.toLowerCase(),
    input.delegate.toLowerCase(),
    input.approved ? 1 : 0,
    Number(input.blockNumber),
    input.txHash.toLowerCase(),
    input.logIndex,
    createdAt,
  );
}
