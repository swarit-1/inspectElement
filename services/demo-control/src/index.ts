/**
 * Demo Control API — exposes IF-10 for Dev 4's dashboard.
 *
 * HTTP server on :7402:
 *   POST /demo/run-legit     → { status: "running", scenarioId }
 *   POST /demo/run-blocked   → { status: "running", scenarioId }
 *   POST /demo/run-overspend → { status: "running", scenarioId }
 *   GET  /demo/status        → { last: { scenarioId, outcome, txHash?, reasonCode?, receiptId?, error? } }
 *
 * outcome ∈ { "success", "blocked", "failed" }
 */

import express from "express";
import { randomUUID } from "crypto";
import {
  loadAgentEnv,
  runExecuteFlow,
  runPreflightOnlyFlow,
  type ScenarioResult,
} from "../../../agents/shared.js";
import { resolveDemoPort } from "../../../packages/trace/src/index.js";

const PORT = resolveDemoPort();

interface DemoState {
  scenarioId: string;
  status: "running" | "completed" | "failed";
  result: ScenarioResult | null;
  startedAt: number;
}

let lastRun: DemoState | null = null;

function main() {
  const app = express();
  app.use(express.json());

  // Enable CORS for Dev 4's frontend
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  app.options("*", (_req, res) => {
    res.sendStatus(204);
  });

  /**
   * POST /demo/run-legit
   * Triggers the legitimate 2 USDC payment agent.
   */
  app.post("/demo/run-legit", async (_req, res) => {
    const scenarioId = randomUUID();
    lastRun = {
      scenarioId,
      status: "running",
      result: null,
      startedAt: Date.now(),
    };

    res.json({ status: "running", scenarioId });

    // Run asynchronously — status polled via GET /demo/status
    try {
      const env = loadAgentEnv();
      const result = await runExecuteFlow("legit", env);
      lastRun = { ...lastRun, status: "completed", result };
    } catch (err) {
      lastRun = {
        ...lastRun,
        status: "failed",
        result: {
          scenario: "legit",
          outcome: "failed",
          error: err instanceof Error ? err.message : String(err),
        },
      };
    }
  });

  /**
   * POST /demo/run-blocked
   * Triggers the blocked attack agent (preflight only).
   */
  app.post("/demo/run-blocked", async (_req, res) => {
    const scenarioId = randomUUID();
    lastRun = {
      scenarioId,
      status: "running",
      result: null,
      startedAt: Date.now(),
    };

    res.json({ status: "running", scenarioId });

    try {
      const env = loadAgentEnv();
      const result = await runPreflightOnlyFlow(env);
      lastRun = { ...lastRun, status: "completed", result };
    } catch (err) {
      lastRun = {
        ...lastRun,
        status: "failed",
        result: {
          scenario: "blocked",
          outcome: "failed",
          error: err instanceof Error ? err.message : String(err),
        },
      };
    }
  });

  /**
   * POST /demo/run-overspend
   * Triggers the overspend agent (15 USDC, slash-only).
   */
  app.post("/demo/run-overspend", async (_req, res) => {
    const scenarioId = randomUUID();
    lastRun = {
      scenarioId,
      status: "running",
      result: null,
      startedAt: Date.now(),
    };

    res.json({ status: "running", scenarioId });

    try {
      const env = loadAgentEnv();
      const result = await runExecuteFlow("overspend", env);
      lastRun = { ...lastRun, status: "completed", result };
    } catch (err) {
      lastRun = {
        ...lastRun,
        status: "failed",
        result: {
          scenario: "overspend",
          outcome: "failed",
          error: err instanceof Error ? err.message : String(err),
        },
      };
    }
  });

  /**
   * GET /demo/status
   * Returns the latest scenario outcome for the dashboard.
   */
  app.get("/demo/status", (_req, res) => {
    if (!lastRun) {
      res.json({ last: null });
      return;
    }

    res.json({
      last: {
        scenarioId: lastRun.scenarioId,
        status: lastRun.status,
        outcome: lastRun.result?.outcome ?? null,
        txHash: lastRun.result?.txHash ?? null,
        reasonCode: lastRun.result?.reasonCode ?? null,
        reasonCodeHex: lastRun.result?.reasonCodeHex ?? null,
        receiptId: lastRun.result?.receiptId ?? null,
        error: lastRun.result?.error ?? null,
      },
    });
  });

  /**
   * Health check
   */
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", lastRun: lastRun?.scenarioId ?? null });
  });

  app.listen(PORT, () => {
    console.log(`[demo-control] Listening on :${PORT}`);
    console.log("[demo-control] Endpoints:");
    console.log("  POST /demo/run-legit");
    console.log("  POST /demo/run-blocked");
    console.log("  POST /demo/run-overspend");
    console.log("  GET  /demo/status");
  });
}

main();
