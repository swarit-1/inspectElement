import { Router } from "express";
import type { Address, Hex } from "viem";
import { z } from "zod";
import type {
  FeedBlockedEntry,
  FeedChallengeEntry,
  FeedEntry,
  FeedIntentEntry,
  FeedReceiptEntry,
} from "../../../../schemas/feed.js";
import type { ChallengeDetail } from "../../../../schemas/challenge.js";
import type { ReceiptDetail } from "../../../../schemas/receipt.js";
import { loadDeployments, loadEnv } from "../config/env.js";
import { listBlockedByOwner } from "../store/blocked.js";
import {
  findChallengeByReceipt,
  getChallenge,
  listChallengesByOwner,
} from "../store/challenges.js";
import { listIntentsByOwner } from "../store/intents.js";
import { getReceipt, listReceiptsByOwner } from "../store/receipts.js";
import { getManifestByHash } from "../store/manifests.js";
import { asyncHandler, badRequest, notFound } from "./errors.js";

/**
 * IF-09 — Read-model.
 *
 *   GET /v1/feed?owner=0x…       → newest-first list of receipts/challenges/intents/blocked
 *   GET /v1/receipts/:receiptId  → receipt detail with challengeable flag + window
 *   GET /v1/challenges/:id       → challenge detail
 */

const FeedQuery = z.object({
  owner: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  limit: z.coerce.number().int().min(1).max(500).default(100).optional(),
});

const ReceiptParams = z.object({
  receiptId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

const ChallengeParams = z.object({
  challengeId: z.string().regex(/^\d+$/),
});

export function createFeedRouter(): Router {
  const router = Router();
  const env = loadEnv();
  const deployment = loadDeployments(env);
  const challengeWindowSec = deployment?.constants?.challengeWindowSec ?? 72 * 60 * 60;

  router.get(
    "/feed",
    asyncHandler(async (req, res) => {
      const parsed = FeedQuery.safeParse(req.query);
      if (!parsed.success) {
        throw badRequest("invalid feed query", parsed.error.flatten());
      }
      const owner = parsed.data.owner.toLowerCase() as Address;
      const limit = parsed.data.limit ?? 100;

      const [receipts, challenges, intents, blocked] = await Promise.all([
        listReceiptsByOwner(owner, limit),
        listChallengesByOwner(owner, limit),
        listIntentsByOwner(owner, limit),
        listBlockedByOwner(owner, limit),
      ]);

      const entries: FeedEntry[] = [];

      for (const r of receipts) {
        const challenge = await findChallengeByReceipt(r.receiptId);
        const filed = challenge?.status === "FILED" || challenge?.status === "UPHELD";
        const windowEndsAt = r.ts + challengeWindowSec;
        const overspendInfo = await getOverspendInfo(r.intentHash, r.amount);
        const overspendable =
          overspendInfo.overspend && !filed && windowEndsAt > nowSec();
        const entry: FeedReceiptEntry = {
          type: "receipt",
          id: `receipt:${r.receiptId}`,
          timestamp: r.ts,
          receiptId: r.receiptId,
          owner: r.owner,
          agentId: r.agentId,
          intentHash: r.intentHash,
          target: r.target,
          token: r.token,
          amount: r.amount.toString(10),
          contextDigest: r.contextDigest,
          traceURI: r.traceUri,
          txHash: r.txHash,
          blockNumber: r.blockNumber,
          challengeable: overspendable,
          challengeWindowEndsAt: windowEndsAt,
        };
        entries.push(entry);
      }

      for (const c of challenges) {
        const entry: FeedChallengeEntry = {
          type: "challenge",
          id: `challenge:${c.challengeId}`,
          timestamp: c.resolvedAt ?? c.filedAt,
          challengeId: c.challengeId,
          receiptId: c.receiptId,
          status: c.status,
          payout: c.payout != null ? c.payout.toString(10) : null,
          challenger: c.challenger,
          filedAt: c.filedAt,
          resolvedAt: c.resolvedAt,
        };
        entries.push(entry);
      }

      for (const i of intents) {
        const entry: FeedIntentEntry = {
          type: "intent",
          id: `intent:${i.intentHash}`,
          timestamp: i.createdAt,
          intentHash: i.intentHash,
          owner: i.owner,
          manifestURI: i.manifestUri,
          active: i.active,
          txHash: i.txHash,
        };
        entries.push(entry);
      }

      for (const b of blocked) {
        const entry: FeedBlockedEntry = {
          type: "blocked",
          id: `blocked:${b.id}`,
          timestamp: b.createdAt,
          scenarioId: b.scenarioId,
          reasonCode: b.reasonCode,
          reasonLabel: b.reasonLabel,
          owner: b.owner,
          agentId: b.agentId,
          target: b.target,
          token: b.token,
          amount: b.amount != null ? b.amount.toString(10) : null,
        };
        entries.push(entry);
      }

      entries.sort((a, b) => b.timestamp - a.timestamp);
      res.json(entries.slice(0, limit));
    }),
  );

  router.get(
    "/receipts/:receiptId",
    asyncHandler(async (req, res) => {
      const parsed = ReceiptParams.safeParse(req.params);
      if (!parsed.success) throw badRequest("invalid receiptId");
      const r = await getReceipt(parsed.data.receiptId as Hex);
      if (!r) throw notFound("receipt not found");

      const challenge = await findChallengeByReceipt(r.receiptId);
      const filed = !!challenge && challenge.status !== "REJECTED";
      const windowEndsAt = r.ts + challengeWindowSec;
      const { overspend } = await getOverspendInfo(r.intentHash, r.amount);

      const detail: ReceiptDetail = {
        receiptId: r.receiptId,
        owner: r.owner,
        agentId: r.agentId,
        intentHash: r.intentHash,
        target: r.target,
        token: r.token,
        amount: r.amount.toString(10),
        contextDigest: r.contextDigest,
        traceURI: r.traceUri,
        callDataHash: r.callDataHash,
        nonce: r.nonce.toString(10),
        timestamp: r.ts,
        blockNumber: r.blockNumber,
        txHash: r.txHash,
        challengeable: overspend && !filed && windowEndsAt > nowSec(),
        challengeWindowEndsAt: windowEndsAt,
        challengeFiled: filed,
      };
      res.json(detail);
    }),
  );

  router.get(
    "/challenges/:challengeId",
    asyncHandler(async (req, res) => {
      const parsed = ChallengeParams.safeParse(req.params);
      if (!parsed.success) throw badRequest("invalid challengeId");
      const c = await getChallenge(parsed.data.challengeId);
      if (!c) throw notFound("challenge not found");
      const detail: ChallengeDetail = {
        challengeId: c.challengeId,
        receiptId: c.receiptId,
        status: c.status,
        filedAt: c.filedAt,
        resolvedAt: c.resolvedAt,
        payout: c.payout != null ? c.payout.toString(10) : null,
        challenger: c.challenger,
        filedTx: c.filedTx,
        resolvedTx: c.resolvedTx,
      };
      res.json(detail);
    }),
  );

  return router;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

async function getOverspendInfo(intentHash: Hex, amount: bigint): Promise<{ overspend: boolean; cap: bigint | null }> {
  const manifest = await getManifestByHash(intentHash);
  if (!manifest) return { overspend: false, cap: null };
  return { overspend: amount > manifest.maxSpendPerTx, cap: manifest.maxSpendPerTx };
}
