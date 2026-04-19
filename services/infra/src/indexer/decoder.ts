import {
  decodeEventLog,
  encodeAbiParameters,
  keccak256,
  type Address,
  type Hex,
  type Log,
} from "viem";
import {
  agentRegistryEvents,
  challengeArbiterEvents,
  guardedExecutorEvents,
  intentRegistryEvents,
} from "../abi/index.js";
import {
  applyStakeIncrease,
  insertDelegate,
  upsertAgentRegistered,
} from "../store/agents.js";
import {
  resolveChallenge,
  upsertChallengeFiled,
} from "../store/challenges.js";
import {
  insertIntentCommitted,
  markIntentRevoked,
} from "../store/intents.js";
import {
  setReceiptTraceUri,
  upsertReceipt,
} from "../store/receipts.js";
import { logger } from "../utils/logger.js";

const ALL_ABI = [
  ...guardedExecutorEvents,
  ...challengeArbiterEvents,
  ...intentRegistryEvents,
  ...agentRegistryEvents,
];

export interface DecodeContext {
  /** Resolves a block number → unix timestamp. Cached by the caller. */
  blockTimestamp: (blockNumber: bigint) => Promise<bigint>;
}

/**
 * Decode + persist a single log. Idempotent: tx_hash + log_index keys protect
 * against double-inserts when reindexing. Returns true if the log matched a
 * known event, false otherwise (so the caller can count "skipped" logs).
 */
export async function handleLog(log: Log, ctx: DecodeContext): Promise<boolean> {
  let decoded: { eventName: string; args: Record<string, unknown> } | null = null;
  try {
    const result = decodeEventLog({
      abi: ALL_ABI,
      data: log.data,
      topics: log.topics,
    });
    decoded = {
      eventName: result.eventName as string,
      args: result.args as unknown as Record<string, unknown>,
    };
  } catch {
    return false;
  }
  if (!decoded) return false;

  if (
    log.blockNumber == null ||
    log.transactionHash == null ||
    log.logIndex == null ||
    log.address == null
  ) {
    logger.warn({ decoded }, "Skipping log with missing on-chain provenance");
    return false;
  }

  const args = decoded.args;
  const blockNumber = log.blockNumber;
  const txHash = log.transactionHash as Hex;
  const logIndex = log.logIndex;
  const ts = await ctx.blockTimestamp(blockNumber);

  switch (decoded.eventName) {
    case "ActionReceipt": {
      await upsertReceipt({
        receiptId: args.receiptId as Hex,
        owner: args.owner as Address,
        agentId: args.agentId as Hex,
        intentHash: args.intentHash as Hex,
        target: args.target as Address,
        token: args.token as Address,
        amount: args.amount as bigint,
        callDataHash: args.callDataHash as Hex,
        contextDigest: args.contextDigest as Hex,
        nonce: args.nonce as bigint,
        ts: args.timestamp as bigint,
        blockNumber,
        txHash,
        logIndex,
      });
      logger.info(
        { receiptId: args.receiptId, owner: args.owner, amount: (args.amount as bigint).toString() },
        "Indexed ActionReceipt",
      );
      return true;
    }
    case "ReceiptStored":
      return true;
    case "TraceURIStored": {
      await setReceiptTraceUri(args.receiptId as Hex, args.traceURI as string);
      return true;
    }
    case "AgentDelegateSet": {
      await insertDelegate({
        owner: args.owner as Address,
        agentId: args.agentId as Hex,
        delegate: args.delegate as Address,
        approved: args.approved as boolean,
        blockNumber,
        txHash,
        logIndex,
      });
      return true;
    }
    case "ChallengeFiled": {
      await upsertChallengeFiled({
        challengeId: args.challengeId as bigint,
        receiptId: args.receiptId as Hex,
        challenger: args.challenger as Address,
        blockNumber,
        txHash,
        blockTimestamp: ts,
      });
      logger.info(
        { challengeId: (args.challengeId as bigint).toString(), receiptId: args.receiptId },
        "Indexed ChallengeFiled",
      );
      return true;
    }
    case "ChallengeResolved": {
      await resolveChallenge({
        challengeId: args.challengeId as bigint,
        uphold: args.uphold as boolean,
        payout: args.payout as bigint,
        blockNumber,
        txHash,
        blockTimestamp: ts,
      });
      logger.info(
        {
          challengeId: (args.challengeId as bigint).toString(),
          uphold: args.uphold,
          payout: (args.payout as bigint).toString(),
        },
        "Indexed ChallengeResolved",
      );
      return true;
    }
    case "IntentCommitted": {
      await insertIntentCommitted({
        intentHash: args.intentHash as Hex,
        owner: args.owner as Address,
        manifestUri: args.manifestURI as string,
        blockNumber,
        txHash,
        logIndex,
      });
      return true;
    }
    case "IntentRevoked": {
      await markIntentRevoked(args.owner as Address);
      return true;
    }
    case "AgentRegistered": {
      await upsertAgentRegistered({
        agentId: args.agentId as Hex,
        operator: args.operator as Address,
        metadataUri: args.metadataURI as string,
        blockNumber,
        txHash,
      });
      return true;
    }
    case "AgentStaked": {
      await applyStakeIncrease({
        agentId: args.agentId as Hex,
        newStake: args.newStake as bigint,
      });
      return true;
    }
    default:
      return false;
  }
}

/**
 * Convenience: compute the same `keccak256(abi.encode(...))` that a contract
 * would. Currently unused inside the decoder but exported for tests/utilities.
 */
export function abiEncodeKeccak(types: { name: string; type: string }[], values: unknown[]): Hex {
  return keccak256(encodeAbiParameters(types, values));
}
