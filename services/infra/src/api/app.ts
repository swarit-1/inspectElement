import cors from "cors";
import express, { type Express } from "express";
import { pinoHttp } from "pino-http";
import { loadEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { optionalAuth } from "../middleware/auth.js";
import { createAuthRouter } from "./auth.js";
import { createChallengePrepareRouter } from "./challenges-prepare.js";
import { errorMiddleware } from "./errors.js";
import { createFeedRouter } from "./feed.js";
import { createHealthRouter } from "./health.js";
import { createLocalCasRouter } from "./local-cas.js";
import { createManifestsRouter } from "./manifests.js";
import { createReplayRouter } from "./replay.js";
import { createReviewerRouter } from "./reviewer.js";
import { createTracesRouter } from "./traces.js";

export function createApp(): Express {
  const env = loadEnv();
  const app = express();

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

  app.use((req, res) => {
    res.status(404).json({ error: "not_found", path: req.path });
  });

  app.use(errorMiddleware);
  return app;
}
