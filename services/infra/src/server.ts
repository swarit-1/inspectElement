import { createApp } from "./api/app.js";
import { loadDeployments, loadEnv } from "./config/env.js";
import { DemoStatusPoller } from "./indexer/demo-status.js";
import { IndexerPoller } from "./indexer/poller.js";
import { Signer } from "./signer/index.js";
import { getDb } from "./store/db.js";
import { logger } from "./utils/logger.js";

/**
 * Single-process entrypoint: HTTP API + indexer + demo-status poller.
 *
 * For production-style deploys, run `npm run indexer` separately and use
 * `INDEXER_DISABLED=true` to skip the in-process poller.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  getDb();
  const signer = Signer.fromEnv();

  logger.info(
    {
      port: env.PORT,
      host: env.HOST,
      chainId: env.CHAIN_ID,
      traceAckSigner: signer.traceAck.address,
    },
    "Starting IntentGuard infra service",
  );

  const app = createApp();
  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info({ url: `http://${env.HOST}:${env.PORT}` }, "API listening");
  });

  let indexer: IndexerPoller | null = null;
  if (process.env.INDEXER_DISABLED !== "true") {
    const deployment = loadDeployments(env);
    if (!deployment) {
      logger.warn(
        "deployments/base-sepolia.json not found; indexer disabled until Dev 1 publishes addresses",
      );
    } else {
      indexer = new IndexerPoller(env, deployment);
      indexer.start();
    }
  }

  const demoPoller = DemoStatusPoller.fromEnv();
  if (demoPoller) demoPoller.start();

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down");
    indexer?.stop();
    demoPoller?.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((e) => {
  logger.fatal({ err: e instanceof Error ? e.message : String(e) }, "Server startup failed");
  process.exit(1);
});
