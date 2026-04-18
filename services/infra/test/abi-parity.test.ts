import { describe, expect, it } from "vitest";
import { toEventSelector, toFunctionSelector, type AbiEvent, type AbiFunction } from "viem";
import {
  agentRegistryEvents,
  challengeArbiterEvents,
  challengeArbiterFunctions,
  guardedExecutorEvents,
  intentRegistryEvents,
} from "../src/abi/index.js";
import { guardedExecutorAbi } from "../../../apps/web/src/abi/guarded-executor.js";
import { intentRegistryAbi } from "../../../apps/web/src/abi/intent-registry.js";
import { challengeArbiterAbi } from "../../../apps/web/src/abi/challenge-arbiter.js";
import { agentRegistryAbi } from "../../../apps/web/src/abi/agent-registry.js";

/**
 * Tier 1b — ABI parity.
 *
 * `services/infra/src/abi/index.ts` (Dev 3, indexer) and `apps/web/src/abi/`
 * (Dev 4, dashboard) must both stay in lockstep with Dev 1's Solidity
 * interfaces in `contracts/interfaces/*.sol`. The on-chain topic hash for an
 * event is `keccak256(name + types)`, so any drift here = silently dropped
 * events on the dashboard or in the indexer.
 *
 * What this file enforces:
 *   1. Every event Dev 3 indexes has the SAME topic hash on both sides.
 *   2. Every function Dev 4 calls has the SAME 4-byte selector on both sides.
 *   3. Events that exist in the Solidity interface are present in BOTH ABIs
 *      (no missing events on the web side, which used to silently drop
 *      `ReceiptStored` and `TraceURIStored`).
 *
 * If you change a contract event, this test will go red until both ABI
 * mirrors are updated. That's by design.
 */

type AbiItem = { type: string };

function eventByName(abi: readonly AbiItem[], name: string): AbiEvent | null {
  return (abi.find((x) => x.type === "event" && (x as AbiEvent).name === name) ?? null) as
    | AbiEvent
    | null;
}
function functionByName(abi: readonly AbiItem[], name: string): AbiFunction | null {
  return (abi.find((x) => x.type === "function" && (x as AbiFunction).name === name) ?? null) as
    | AbiFunction
    | null;
}

function expectSameTopic(
  side: string,
  mineAbi: readonly AbiItem[],
  webAbi: readonly AbiItem[],
  name: string,
): void {
  const mine = eventByName(mineAbi, name);
  const web = eventByName(webAbi, name);
  expect(mine, `[${side}] my ABI is missing event ${name}`).not.toBeNull();
  expect(web, `[${side}] web ABI is missing event ${name}`).not.toBeNull();
  expect(toEventSelector(mine!), `[${side}] topic hash drift for ${name}`).toBe(
    toEventSelector(web!),
  );
}

function expectSameSelector(
  side: string,
  mineAbi: readonly AbiItem[],
  webAbi: readonly AbiItem[],
  name: string,
): void {
  const mine = functionByName(mineAbi, name);
  const web = functionByName(webAbi, name);
  expect(mine, `[${side}] my ABI is missing function ${name}`).not.toBeNull();
  expect(web, `[${side}] web ABI is missing function ${name}`).not.toBeNull();
  expect(toFunctionSelector(mine!), `[${side}] selector drift for ${name}`).toBe(
    toFunctionSelector(web!),
  );
}

describe("ABI parity — Dev 3 indexer ABIs vs Dev 4 web ABIs", () => {
  describe("GuardedExecutor events", () => {
    for (const name of [
      "AgentDelegateSet",
      "ActionReceipt",
      "ReceiptStored",
      "TraceURIStored",
    ]) {
      it(`${name} has the same topic hash on both sides`, () => {
        expectSameTopic("GuardedExecutor", guardedExecutorEvents, guardedExecutorAbi, name);
      });
    }
  });

  describe("ChallengeArbiter events", () => {
    for (const name of ["ChallengeFiled", "ChallengeResolved"]) {
      it(`${name} has the same topic hash on both sides`, () => {
        expectSameTopic("ChallengeArbiter", challengeArbiterEvents, challengeArbiterAbi, name);
      });
    }
  });

  describe("IntentRegistry events", () => {
    for (const name of ["IntentCommitted", "IntentRevoked"]) {
      it(`${name} has the same topic hash on both sides`, () => {
        expectSameTopic("IntentRegistry", intentRegistryEvents, intentRegistryAbi, name);
      });
    }
  });

  describe("AgentRegistry events", () => {
    for (const name of ["AgentRegistered", "AgentStaked"]) {
      it(`${name} has the same topic hash on both sides`, () => {
        expectSameTopic("AgentRegistry", agentRegistryEvents, agentRegistryAbi, name);
      });
    }
  });

  describe("ChallengeArbiter functions Dev 4 calls", () => {
    for (const name of ["fileAmountViolation", "resolveByReviewer"]) {
      it(`${name} selector matches`, () => {
        expectSameSelector(
          "ChallengeArbiter",
          challengeArbiterFunctions,
          challengeArbiterAbi,
          name,
        );
      });
    }
  });
});

describe("Web ABI completeness — events the dashboard needs", () => {
  it("guardedExecutorAbi exposes ActionReceipt + ReceiptStored + TraceURIStored", () => {
    expect(eventByName(guardedExecutorAbi, "ActionReceipt")).not.toBeNull();
    expect(eventByName(guardedExecutorAbi, "ReceiptStored")).not.toBeNull();
    expect(eventByName(guardedExecutorAbi, "TraceURIStored")).not.toBeNull();
  });

  it("agentRegistryAbi exists and exposes AgentRegistered + AgentStaked", () => {
    expect(eventByName(agentRegistryAbi, "AgentRegistered")).not.toBeNull();
    expect(eventByName(agentRegistryAbi, "AgentStaked")).not.toBeNull();
  });

  it("guardedExecutorAbi.ActionReceipt has agentId indexed and timestamp uint64", () => {
    const ev = eventByName(guardedExecutorAbi, "ActionReceipt")!;
    const agentId = ev.inputs.find((i) => i.name === "agentId")!;
    const timestamp = ev.inputs.find((i) => i.name === "timestamp")!;
    expect(agentId.indexed).toBe(true);
    expect(timestamp.type).toBe("uint64");
  });

  it("challengeArbiterAbi.ChallengeFiled has exactly the 3 fields the contract emits", () => {
    const ev = eventByName(challengeArbiterAbi, "ChallengeFiled")!;
    expect(ev.inputs.map((i) => i.name)).toEqual(["challengeId", "receiptId", "challenger"]);
  });

  it("challengeArbiterAbi.ChallengeResolved uses uphold/payout (not upheld/slashAmount/payoutTo)", () => {
    const ev = eventByName(challengeArbiterAbi, "ChallengeResolved")!;
    expect(ev.inputs.map((i) => i.name)).toEqual(["challengeId", "uphold", "payout"]);
  });
});
