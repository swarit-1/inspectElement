import { Router } from "express";
import { keccak256, stringToBytes, type Hex } from "viem";
import { z } from "zod";
import { canonicalize, type CanonicalValue } from "../canonical/json.js";
import { loadEnv } from "../config/env.js";
import { screenTrace, getModelName } from "../gemini/client.js";
import { getManifestByHash } from "../store/manifests.js";
import { insertExecution, updateExecution, getExecution } from "../store/executions.js";
import { logger } from "../utils/logger.js";
import { asyncHandler, badRequest, notFound } from "./errors.js";
import { emitEvent, type SSEEvent } from "./sse.js";

/**
 * Real execution API — replaces demo-only scenario endpoints as the
 * primary integration surface for partner runtimes.
 *
 *   POST /v1/executions/preflight — validate without executing
 *   POST /v1/executions           — submit execution request
 *   GET  /v1/executions/:id       — check execution status
 */

const PreflightBody = z.object({
  owner: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  agentId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  proposedAction: z.string().min(1),
  trace: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]),
  target: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  token: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  amount: z.string().optional(),
  intentHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
});

const ExecutionBody = PreflightBody;

const ExecutionParams = z.object({
  id: z.string().uuid(),
});

export function createExecutionsRouter(): Router {
  const router = Router();

  // ── POST /v1/executions/preflight ──
  router.post(
    "/preflight",
    asyncHandler(async (req, res) => {
      const parsed = PreflightBody.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("invalid preflight request", parsed.error.flatten());
      }

      const { owner, agentId, proposedAction, trace, target, token, amount, intentHash } = parsed.data;

      // Compute context digest
      const canonicalJson = toCanonicalJson(trace);
      const contextDigest = keccak256(stringToBytes(canonicalJson));

      // Run deterministic checks
      const checks = await runDeterministicChecks({
        owner,
        agentId,
        target,
        token,
        amount,
        intentHash,
      });

      // Run Gemini advisory screen
      const screen = await screenTrace({
        trace,
        proposedAction,
        owner,
        agentId,
      });

      const env = loadEnv();
      const hardModeBlock =
        env.GEMINI_SCREEN_HARD_MODE && screen.injectionScore >= env.GEMINI_SCREEN_HARD_THRESHOLD;

      const blocked = !checks.passed || hardModeBlock;
      const blockReasons = [
        ...checks.reasons,
        ...(hardModeBlock ? [`gemini_hard_mode: score ${screen.injectionScore} >= ${env.GEMINI_SCREEN_HARD_THRESHOLD}`] : []),
      ];

      res.json({
        status: blocked ? "blocked" : "allowed",
        contextDigest,
        deterministicChecks: {
          passed: checks.passed,
          reasons: checks.reasons,
        },
        advisoryScreen: {
          ...screen,
          model: getModelName(),
          advisoryOnly: !hardModeBlock,
        },
        blockReasons: blocked ? blockReasons : [],
      });
    }),
  );

  // ── POST /v1/executions ──
  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const parsed = ExecutionBody.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("invalid execution request", parsed.error.flatten());
      }

      const { owner, agentId, proposedAction, trace, target, token, amount, intentHash } = parsed.data;

      const canonicalJson = toCanonicalJson(trace);
      const contextDigest = keccak256(stringToBytes(canonicalJson)) as Hex;

      // Create execution record
      const execution = await insertExecution({
        owner: owner as `0x${string}`,
        agentId: agentId as Hex,
        proposedAction,
        traceJson: canonicalJson,
        contextDigest,
      });

      // Run deterministic checks
      const checks = await runDeterministicChecks({
        owner,
        agentId,
        target,
        token,
        amount,
        intentHash,
      });

      if (!checks.passed) {
        await updateExecution(execution.id, {
          status: "blocked",
          blockReason: checks.reasons.join("; "),
        });

        const blockedEvent: SSEEvent = {
          type: "attempt.blocked",
          data: {
            executionId: execution.id,
            owner,
            agentId,
            reasons: checks.reasons,
            timestamp: Math.floor(Date.now() / 1000),
          },
        };
        emitEvent(blockedEvent);

        res.json({
          executionId: execution.id,
          status: "blocked",
          blockReasons: checks.reasons,
          contextDigest,
        });
        return;
      }

      // Run advisory screen
      const screen = await screenTrace({
        trace,
        proposedAction,
        owner,
        agentId,
      });

      const env = loadEnv();
      const hardModeBlock =
        env.GEMINI_SCREEN_HARD_MODE && screen.injectionScore >= env.GEMINI_SCREEN_HARD_THRESHOLD;

      if (hardModeBlock) {
        const reason = `gemini_hard_mode: score ${screen.injectionScore} >= ${env.GEMINI_SCREEN_HARD_THRESHOLD}`;
        await updateExecution(execution.id, {
          status: "blocked",
          blockReason: reason,
        });

        const blockedEvent: SSEEvent = {
          type: "attempt.blocked",
          data: {
            executionId: execution.id,
            owner,
            agentId,
            reasons: [reason],
            timestamp: Math.floor(Date.now() / 1000),
          },
        };
        emitEvent(blockedEvent);

        res.json({
          executionId: execution.id,
          status: "blocked",
          blockReasons: [reason],
          contextDigest,
          advisoryScreen: {
            ...screen,
            model: getModelName(),
            advisoryOnly: false,
          },
        });
        return;
      }

      // Mark as allowed (actual on-chain execution happens client-side)
      await updateExecution(execution.id, {
        status: "allowed",
        resultJson: JSON.stringify({
          advisoryScreen: { ...screen, model: getModelName() },
        }),
      });

      logger.info(
        { executionId: execution.id, owner, agentId, contextDigest },
        "Execution allowed",
      );

      res.json({
        executionId: execution.id,
        status: "allowed",
        contextDigest,
        advisoryScreen: {
          ...screen,
          model: getModelName(),
          advisoryOnly: true,
        },
      });
    }),
  );

  // ── GET /v1/executions/:id ──
  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const parsed = ExecutionParams.safeParse(req.params);
      if (!parsed.success) throw badRequest("invalid execution id");

      const execution = await getExecution(parsed.data.id);
      if (!execution) throw notFound("execution not found");

      res.json({
        executionId: execution.id,
        owner: execution.owner,
        agentId: execution.agentId,
        status: execution.status,
        proposedAction: execution.proposedAction,
        contextDigest: execution.contextDigest,
        blockReason: execution.blockReason,
        receiptId: execution.receiptId,
        txHash: execution.txHash,
        createdAt: execution.createdAt,
        updatedAt: execution.updatedAt,
      });
    }),
  );

  return router;
}

// ── Helpers ──

function toCanonicalJson(trace: unknown): string {
  if (typeof trace === "string") return trace;
  try {
    return canonicalize(trace as CanonicalValue);
  } catch (e) {
    throw badRequest(`trace is not canonicalizable: ${(e as Error).message}`);
  }
}

interface DeterministicCheckResult {
  passed: boolean;
  reasons: string[];
}

async function runDeterministicChecks(input: {
  owner: string;
  agentId: string;
  target?: string;
  token?: string;
  amount?: string;
  intentHash?: string;
}): Promise<DeterministicCheckResult> {
  const reasons: string[] = [];

  if (!input.intentHash) {
    return { passed: true, reasons: [] };
  }

  const manifest = await getManifestByHash(input.intentHash as Hex);
  if (!manifest) {
    return { passed: true, reasons: [] };
  }

  // Check amount cap
  if (input.amount) {
    const amount = BigInt(input.amount);
    if (amount > manifest.maxSpendPerTx) {
      reasons.push(
        `AMOUNT_EXCEEDS_CAP: ${amount.toString()} > ${manifest.maxSpendPerTx.toString()} maxSpendPerTx`,
      );
    }
  }

  // Check counterparty allowlist
  if (input.target && manifest.allowedCounterparties.length > 0) {
    const targetLower = input.target.toLowerCase();
    const allowed = manifest.allowedCounterparties.some(
      (cp) => cp.toLowerCase() === targetLower,
    );
    if (!allowed) {
      reasons.push(`COUNTERPARTY_NOT_ALLOWED: ${input.target} is not in the allowlist`);
    }
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (Number(manifest.expiry) < now) {
    reasons.push(`INTENT_EXPIRED: intent expired at ${manifest.expiry.toString()}`);
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}
