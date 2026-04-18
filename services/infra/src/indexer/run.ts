import { IndexerPoller } from "./poller.js";
import { logger } from "../utils/logger.js";

async function main(): Promise<void> {
  const poller = await IndexerPoller.fromEnv();
  poller.start();

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Indexer shutting down");
    poller.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((e) => {
  logger.fatal({ err: e instanceof Error ? e.message : String(e) }, "Indexer failed to start");
  process.exit(1);
});
