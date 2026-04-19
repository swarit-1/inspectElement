import { Router } from "express";
import { z } from "zod";
import { asyncHandler, badRequest } from "./errors.js";

/**
 * POST /v1/execute
 *
 * Runtime-facing execution API. Accepts trace-backed execution requests
 * from integrating partners/runtimes rather than requiring the demo buttons.
 *
 * This endpoint:
 *   1. Validates the execution request
 *   2. Returns a preflight result (decision + reasonCode)
 *   3. If accepted, provides execution metadata
 *
 * For the MVP, this endpoint validates and accepts the request shape
 * but does not actually call executeWithGuard on-chain (that requires
 * the delegate key which the partner runtime holds). Instead, it returns
 * preflight status so the partner knows whether to proceed.
 *
 * Body: { owner, agentId, target, token, amount, data, trace }
 * 200: { status, preflight: { decision, reasonCode }, receiptId? }
 * 400: validation error
 */

const TraceSchema = z.object({
  schemaVersion: z.string(),
  agentId: z.string(),
  owner: z.string(),
  intentHash: z.string(),
  session: z.object({
    id: z.string(),
    startedAt: z.number(),
    model: z.string(),
    temperature: z.number(),
  }),
  prompts: z.array(
    z.object({
      role: z.enum(["user", "system", "assistant"]),
      content: z.string(),
      timestamp: z.number(),
    }),
  ),
  toolCalls: z.array(z.unknown()),
  observations: z.array(z.unknown()),
  proposedAction: z.object({
    target: z.string(),
    token: z.string(),
    amount: z.string(),
    callData: z.string(),
    rationale: z.string(),
  }),
  nonce: z.number(),
});

const ExecuteBody = z.object({
  owner: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  agentId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  target: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  token: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  amount: z.string().regex(/^\d+$/),
  data: z.string().regex(/^0x[0-9a-fA-F]*$/),
  trace: TraceSchema,
});

export function createExecuteRouter(): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const parsed = ExecuteBody.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("invalid execution request", parsed.error.flatten());
      }

      const { owner, agentId, target, token, amount, trace } = parsed.data;

      // Validate trace consistency with request
      const traceTargetMatch =
        trace.proposedAction.target.toLowerCase() === target.toLowerCase();
      const traceAmountMatch = trace.proposedAction.amount === amount;
      const traceTokenMatch =
        trace.proposedAction.token.toLowerCase() === token.toLowerCase();

      const reasonCode = !traceTargetMatch
        ? "TRACE_TARGET_MISMATCH"
        : !traceAmountMatch
          ? "TRACE_AMOUNT_MISMATCH"
          : !traceTokenMatch
            ? "TRACE_TOKEN_MISMATCH"
            : null;

      const decision = reasonCode ? "RED" : "GREEN";
      const status = reasonCode ? "rejected" : "accepted";

      res.json({
        status,
        preflight: {
          decision,
          reasonCode: reasonCode ?? "NONE",
        },
        owner,
        agentId,
        target,
        token,
        amount,
        traceDigest: null, // Would be computed from uploaded trace
        timestamp: Math.floor(Date.now() / 1000),
      });
    }),
  );

  return router;
}
