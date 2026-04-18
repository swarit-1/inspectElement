import "./setup.js";
import { afterAll, describe, expect, it } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  keccak256,
  toBytes,
  type Abi,
  type Address,
  type Hex,
  type Log,
  type PublicClient,
} from "viem";
import {
  agentRegistryEvents,
  challengeArbiterEvents,
  guardedExecutorEvents,
  intentRegistryEvents,
} from "../src/abi/index.js";
import { handleLog } from "../src/indexer/decoder.js";
import { IndexerPoller } from "../src/indexer/poller.js";
import { closeDb } from "../src/store/db.js";
import { getReceipt } from "../src/store/receipts.js";
import { getChallenge } from "../src/store/challenges.js";
import { listIntentsByOwner } from "../src/store/intents.js";
import { getMeta, META_LAST_INDEXED_BLOCK } from "../src/store/meta.js";

/**
 * Tier 5 — indexer decoder + poller cursor.
 *
 * No live RPC: we synthesize logs against my ABI fragments and a fake
 * PublicClient. Verifies:
 *   - decoder writes correctly typed rows for every event we care about
 *   - poller advances the last-indexed-block cursor
 *   - poller resumes from the cursor on restart (does not re-process old logs)
 *
 * The full live verification of these decoders is blocked on Dev 1
 * deploying real contracts; this test covers everything I can without that.
 */

const RAW_ZERO_HASH = ("0x" + "00".repeat(32)) as Hex;

function makeLog(opts: {
  abi: Abi;
  eventName: string;
  args: Record<string, unknown>;
  address: Address;
  blockNumber: bigint;
  txHash: Hex;
  logIndex: number;
}): Log {
  const event = opts.abi.find(
    (e) => e.type === "event" && e.name === opts.eventName,
  ) as
    | {
        type: "event";
        name: string;
        inputs: Array<{ name: string; type: string; indexed: boolean }>;
      }
    | undefined;
  if (!event) throw new Error(`event ${opts.eventName} not in supplied ABI`);

  const indexedArgs: Record<string, unknown> = {};
  const dataParams: Array<{ name: string; type: string }> = [];
  const dataValues: unknown[] = [];
  for (const input of event.inputs) {
    if (input.indexed) {
      indexedArgs[input.name] = opts.args[input.name];
    } else {
      dataParams.push({ name: input.name, type: input.type });
      dataValues.push(opts.args[input.name]);
    }
  }

  const topics = encodeEventTopics({
    abi: opts.abi,
    eventName: opts.eventName,
    args: indexedArgs,
  } as Parameters<typeof encodeEventTopics>[0]) as [Hex, ...Hex[]];

  const data =
    dataParams.length > 0 ? encodeAbiParameters(dataParams, dataValues) : ("0x" as Hex);

  return {
    address: opts.address,
    topics,
    data,
    blockNumber: opts.blockNumber,
    transactionHash: opts.txHash,
    logIndex: opts.logIndex,
    transactionIndex: 0,
    blockHash: keccak256(toBytes(opts.blockNumber.toString())),
    removed: false,
  } as unknown as Log;
}

const OWNER: Address = getAddress("0xdeadbeef00000000000000000000000000000a01");
const AGENT_ID: Hex = ("0x" + "0a".repeat(32)) as Hex;
const RECEIPT_ID: Hex = ("0x" + "0b".repeat(32)) as Hex;
const INTENT_HASH: Hex = ("0x" + "0c".repeat(32)) as Hex;
const TOKEN: Address = getAddress("0x0000000000000000000000000000000000000abc");
const TARGET: Address = getAddress("0x0000000000000000000000000000000000000def");
const EXECUTOR_ADDR: Address = getAddress("0x0000000000000000000000000000000000000003");
const ARBITER_ADDR: Address = getAddress("0x0000000000000000000000000000000000000005");
const INTENT_REG_ADDR: Address = getAddress("0x0000000000000000000000000000000000000002");
const AGENT_REG_ADDR: Address = getAddress("0x0000000000000000000000000000000000000004");

afterAll(() => {
  closeDb();
});

describe("Indexer decoder — synthetic logs against my ABI fragments", () => {
  const blockTs = (_bn: bigint) => Promise.resolve(1_700_000_000n);
  const ctx = { blockTimestamp: blockTs };

  it("decodes ActionReceipt and writes a typed receipt row", async () => {
    const log = makeLog({
      abi: guardedExecutorEvents,
      eventName: "ActionReceipt",
      args: {
        receiptId: RECEIPT_ID,
        owner: OWNER,
        agentId: AGENT_ID,
        intentHash: INTENT_HASH,
        target: TARGET,
        token: TOKEN,
        amount: 15_000_000n,
        callDataHash: RAW_ZERO_HASH,
        contextDigest: ("0x" + "ab".repeat(32)) as Hex,
        nonce: 7n,
        timestamp: 1_700_000_000n,
      },
      address: EXECUTOR_ADDR,
      blockNumber: 1234n,
      txHash: ("0x" + "11".repeat(32)) as Hex,
      logIndex: 0,
    });

    const handled = await handleLog(log, ctx);
    expect(handled).toBe(true);

    const row = getReceipt(RECEIPT_ID);
    expect(row).not.toBeNull();
    expect(row!.amount).toBe(15_000_000n);
    expect(row!.nonce).toBe(7n);
    expect(row!.owner.toLowerCase()).toBe(OWNER.toLowerCase());
    expect(row!.intentHash.toLowerCase()).toBe(INTENT_HASH.toLowerCase());
  });

  it("decodes ChallengeFiled + ChallengeResolved and updates challenge status", async () => {
    const filed = makeLog({
      abi: challengeArbiterEvents,
      eventName: "ChallengeFiled",
      args: {
        challengeId: 99n,
        receiptId: RECEIPT_ID,
        challenger: OWNER,
      },
      address: ARBITER_ADDR,
      blockNumber: 1300n,
      txHash: ("0x" + "22".repeat(32)) as Hex,
      logIndex: 0,
    });
    expect(await handleLog(filed, ctx)).toBe(true);

    const resolved = makeLog({
      abi: challengeArbiterEvents,
      eventName: "ChallengeResolved",
      args: {
        challengeId: 99n,
        uphold: true,
        payout: 15_000_000n,
      },
      address: ARBITER_ADDR,
      blockNumber: 1301n,
      txHash: ("0x" + "33".repeat(32)) as Hex,
      logIndex: 0,
    });
    expect(await handleLog(resolved, ctx)).toBe(true);

    const c = getChallenge("99");
    expect(c).not.toBeNull();
    expect(c!.status).toBe("UPHELD");
    expect(c!.payout).toBe(15_000_000n);
  });

  it("decodes IntentCommitted and writes the intent row", async () => {
    const log = makeLog({
      abi: intentRegistryEvents,
      eventName: "IntentCommitted",
      args: {
        owner: OWNER,
        intentHash: INTENT_HASH,
        manifestURI: "ipfs://manifest-x",
      },
      address: INTENT_REG_ADDR,
      blockNumber: 1400n,
      txHash: ("0x" + "44".repeat(32)) as Hex,
      logIndex: 0,
    });
    expect(await handleLog(log, ctx)).toBe(true);

    const intents = listIntentsByOwner(OWNER);
    expect(intents.find((i) => i.intentHash.toLowerCase() === INTENT_HASH.toLowerCase())).toBeDefined();
  });

  it("decodes IntentRevoked with the corrected 2-field signature", async () => {
    const log = makeLog({
      abi: intentRegistryEvents,
      eventName: "IntentRevoked",
      args: { owner: OWNER, intentHash: INTENT_HASH },
      address: INTENT_REG_ADDR,
      blockNumber: 1401n,
      txHash: ("0x" + "55".repeat(32)) as Hex,
      logIndex: 0,
    });
    expect(await handleLog(log, ctx)).toBe(true);
  });

  it("decodes AgentRegistered + AgentStaked", async () => {
    const reg = makeLog({
      abi: agentRegistryEvents,
      eventName: "AgentRegistered",
      args: {
        agentId: AGENT_ID,
        operator: OWNER,
        metadataURI: "ipfs://agent-meta",
      },
      address: AGENT_REG_ADDR,
      blockNumber: 1500n,
      txHash: ("0x" + "66".repeat(32)) as Hex,
      logIndex: 0,
    });
    expect(await handleLog(reg, ctx)).toBe(true);

    const staked = makeLog({
      abi: agentRegistryEvents,
      eventName: "AgentStaked",
      args: {
        agentId: AGENT_ID,
        amount: 50_000_000n,
        newStake: 50_000_000n,
      },
      address: AGENT_REG_ADDR,
      blockNumber: 1501n,
      txHash: ("0x" + "77".repeat(32)) as Hex,
      logIndex: 0,
    });
    expect(await handleLog(staked, ctx)).toBe(true);
  });

  it("returns false for an unrelated log it cannot decode", async () => {
    const garbage: Log = {
      address: EXECUTOR_ADDR,
      topics: [("0x" + "ee".repeat(32)) as Hex],
      data: "0x" as Hex,
      blockNumber: 100n,
      transactionHash: ("0x" + "ee".repeat(32)) as Hex,
      logIndex: 0,
      transactionIndex: 0,
      blockHash: RAW_ZERO_HASH,
      removed: false,
    } as unknown as Log;
    const handled = await handleLog(garbage, { blockTimestamp: blockTs });
    expect(handled).toBe(false);
  });
});

describe("IndexerPoller cursor advances + resumes", () => {
  const FakeClient = (head: bigint, logs: Log[] = []): PublicClient => {
    return {
      getBlockNumber: async () => head,
      getLogs: async () => logs,
      getBlock: async () => ({ timestamp: 1_700_000_000n }),
    } as unknown as PublicClient;
  };

  function fakeDeployment() {
    return {
      chainId: 84532,
      contracts: {
        IntentRegistry: INTENT_REG_ADDR,
        AgentRegistry: AGENT_REG_ADDR,
        GuardedExecutor: EXECUTOR_ADDR,
        ChallengeArbiter: ARBITER_ADDR,
        StakeVault: "0x0000000000000000000000000000000000000006" as Address,
        USDC: "0x0000000000000000000000000000000000000abc" as Address,
      },
      traceAckSigner: "0x0000000000000000000000000000000000000000" as Address,
      reviewerSigner: "0x0000000000000000000000000000000000000000" as Address,
      constants: {
        chainId: 84532,
        maxSpendPerTx: "10000000",
        maxSpendPerDay: "50000000",
        agentStake: "50000000",
        challengeBond: "1000000",
        challengeWindowSec: 259_200,
      },
    };
  }

  it("advances META_LAST_INDEXED_BLOCK after catchUp()", async () => {
    const env = (await import("../src/config/env.js")).loadEnv();
    const poller = new IndexerPoller(env, fakeDeployment(), FakeClient(2_000n));
    await poller.catchUp();
    const last = getMeta(META_LAST_INDEXED_BLOCK);
    expect(last).not.toBeNull();
    expect(BigInt(last!)).toBeGreaterThanOrEqual(2_000n);
  });

  it("resumes from the cursor on a second catchUp (does not regress)", async () => {
    const env = (await import("../src/config/env.js")).loadEnv();
    const before = BigInt(getMeta(META_LAST_INDEXED_BLOCK) ?? "0");
    const poller2 = new IndexerPoller(env, fakeDeployment(), FakeClient(before + 5n));
    await poller2.catchUp();
    const after = BigInt(getMeta(META_LAST_INDEXED_BLOCK)!);
    expect(after).toBeGreaterThanOrEqual(before);
    expect(after).toBeGreaterThanOrEqual(before + 5n);
  });
});
