import { type Address, type Hex, type PublicClient } from "viem";
import {
  agentRegistryEvents,
  challengeArbiterEvents,
  guardedExecutorEvents,
  intentRegistryEvents,
} from "../abi/index.js";
import { loadEnv, loadDeployments, type Env, type DeploymentManifest } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { getMeta, META_LAST_INDEXED_BLOCK, setMeta } from "../store/meta.js";
import { handleLog } from "./decoder.js";
import { createIndexerClient } from "./client.js";

/**
 * Direct viem log poller. We deliberately avoid `watchContractEvent` — for a
 * 5-minute demo, a 2-3s `getLogs` poll over the last N blocks is more
 * predictable and recovers cleanly from disconnects.
 */
export class IndexerPoller {
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly client: PublicClient;
  private readonly addresses: Address[];
  private readonly blockTsCache = new Map<bigint, bigint>();

  constructor(
    private readonly env: Env,
    private readonly deployment: DeploymentManifest,
    client?: PublicClient,
  ) {
    this.client = client ?? createIndexerClient(env);
    this.addresses = [
      deployment.contracts.GuardedExecutor,
      deployment.contracts.IntentRegistry,
      deployment.contracts.AgentRegistry,
      deployment.contracts.ChallengeArbiter,
    ].map((a) => a.toLowerCase()) as Address[];
  }

  static async fromEnv(): Promise<IndexerPoller> {
    const env = loadEnv();
    const deployment = loadDeployments(env);
    if (!deployment) {
      throw new Error(
        "deployments/base-sepolia.json not found; cannot start indexer (waiting on Dev 1)",
      );
    }
    return new IndexerPoller(env, deployment);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info(
      {
        addresses: this.addresses,
        pollMs: this.env.INDEXER_POLL_MS,
        batchBlocks: this.env.INDEXER_BATCH_BLOCKS,
      },
      "Indexer started",
    );
    void this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  /** One-shot: catch up from the last indexed block to chain head, then exit. */
  async catchUp(): Promise<void> {
    const head = await this.client.getBlockNumber();
    const start = await this.resolveStartBlock();
    await this.indexRange(start, head);
  }

  /** Reindex from genesis-of-deployment. Caller is responsible for truncating tables. */
  async reindexFromGenesis(): Promise<void> {
    setMeta(META_LAST_INDEXED_BLOCK, "0");
    await this.catchUp();
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        await this.catchUp();
      } catch (e) {
        logger.error({ err: (e as Error).message }, "Indexer poll error");
      }
      await this.sleep(this.env.INDEXER_POLL_MS);
    }
  }

  private async indexRange(fromBlock: bigint, toBlock: bigint): Promise<void> {
    if (fromBlock > toBlock) return;
    const batchSize = BigInt(this.env.INDEXER_BATCH_BLOCKS);

    for (let cursor = fromBlock; cursor <= toBlock; cursor += batchSize + 1n) {
      const upper = cursor + batchSize > toBlock ? toBlock : cursor + batchSize;
      const logs = await this.client.getLogs({
        address: this.addresses,
        events: [
          ...guardedExecutorEvents,
          ...challengeArbiterEvents,
          ...intentRegistryEvents,
          ...agentRegistryEvents,
        ],
        fromBlock: cursor,
        toBlock: upper,
      });

      let handled = 0;
      for (const log of logs) {
        const ok = await handleLog(log, {
          blockTimestamp: (bn) => this.getBlockTimestamp(bn),
        });
        if (ok) handled += 1;
      }
      if (logs.length > 0) {
        logger.info(
          { from: cursor.toString(), to: upper.toString(), logs: logs.length, handled },
          "Indexed range",
        );
      }
      setMeta(META_LAST_INDEXED_BLOCK, upper.toString());
    }
  }

  private async resolveStartBlock(): Promise<bigint> {
    const last = getMeta(META_LAST_INDEXED_BLOCK);
    if (last) {
      const lastNum = BigInt(last);
      if (lastNum > 0n) return lastNum + 1n;
    }
    if (this.env.INDEXER_START_BLOCK != null) return this.env.INDEXER_START_BLOCK;
    if (this.deployment.startBlock != null) return BigInt(this.deployment.startBlock);
    // Conservative fallback: index from chain head minus a small safety window.
    const head = await this.client.getBlockNumber();
    return head > 1000n ? head - 1000n : 0n;
  }

  private async getBlockTimestamp(blockNumber: bigint): Promise<bigint> {
    const cached = this.blockTsCache.get(blockNumber);
    if (cached != null) return cached;
    const block = await this.client.getBlock({ blockNumber });
    this.blockTsCache.set(blockNumber, block.timestamp);
    if (this.blockTsCache.size > 1024) {
      const firstKey = this.blockTsCache.keys().next().value;
      if (firstKey != null) this.blockTsCache.delete(firstKey);
    }
    return block.timestamp;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => {
      this.timer = setTimeout(r, ms);
    });
  }
}

export type { Hex };
