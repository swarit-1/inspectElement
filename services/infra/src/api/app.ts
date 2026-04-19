import cors from "cors";
import express, { type Express } from "express";
import { pinoHttp } from "pino-http";
import { loadEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import type { ScreeningProvider } from "../screening/types.js";
import { createAuthRouter } from "./auth.js";
import { createChallengePrepareRouter } from "./challenges-prepare.js";
import { errorMiddleware } from "./errors.js";
import { createExecuteRouter } from "./execute.js";
import { createFeedRouter } from "./feed.js";
import { createHealthRouter } from "./health.js";
import { createLiveFeedRouter, createFeedEventBus, type FeedEventBus } from "./live-feed.js";
import { createLocalCasRouter } from "./local-cas.js";
import { createManifestsRouter } from "./manifests.js";
import { createReplayRouter } from "./replay.js";
import { createReviewerRouter } from "./reviewer.js";
import { createScreenRouter } from "./screen.js";
import { createSummaryRouter } from "./summary.js";
import { createTracesRouter } from "./traces.js";

export interface AppOptions {
  screeningProvider?: ScreeningProvider;
  feedEventBus?: FeedEventBus;
}

export function createApp(options: AppOptions = {}): Express {
  const env = loadEnv();
  const app = express();
  const feedBus = options.feedEventBus ?? createFeedEventBus();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(","),
      methods: ["GET", "POST", "OPTIONS"],
    }),
  );
  app.use(pinoHttp({ logger }));

  // Optional auth on all routes — sets req.auth if valid credentials present
  app.use(optionalAuth());

  // Public routes (no auth required)
  app.use("/v1/health", createHealthRouter());
  app.use("/v1/auth", createAuthRouter());

  // API routes (auth optional for backward compat, will be required in production)
  app.use("/v1/manifests", createManifestsRouter());
  app.use("/v1/traces", createTracesRouter());
  app.use("/v1", createFeedRouter());
  app.use("/v1/challenges", createChallengePrepareRouter());
  app.use("/v1/reviewer", createReviewerRouter());
  app.use("/v1/replay", createReplayRouter());
  app.use("/ipfs", createLocalCasRouter());

  // Execution API — partner/runtime-facing (requires auth)
  app.use("/v1/execute", requireAuth("partner", "service"), createExecuteRouter());

  // Live feed — SSE for real-time updates (requires auth)
  app.use("/v1/feed", requireAuth("user", "partner"), createLiveFeedRouter(feedBus));

  // Advisory screening & summaries (Gemini-powered, never authoritative)
  if (options.screeningProvider) {
    app.use("/v1/screen", createScreenRouter(options.screeningProvider));
    app.use("/v1", createSummaryRouter(options.screeningProvider));
  } else {
    // Return 501 when screening is not configured so callers know the feature
    // is disabled rather than receiving a misleading 404
    app.use("/v1/screen", (_req, res) => {
      res.status(501).json({ error: "feature_disabled", message: "Screening provider not configured" });
    });
  }

  app.use((req, res) => {
    res.status(404).json({ error: "not_found", path: req.path });
  });

  app.use(errorMiddleware);
  return app;
}
