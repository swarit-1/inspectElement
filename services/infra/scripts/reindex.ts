import { resetDb } from "../src/store/db.js";
import { IndexerPoller } from "../src/indexer/poller.js";
import { logger } from "../src/utils/logger.js";

/**
 * Truncate all indexed tables and replay every event from the deployment's
 * starting block to chain head. Manifests + traces + blocked attempts are
 * preserved (they are off-chain artifacts owned by infra, not the chain).
 *
 *   npm run reindex
 */
async function main(): Promise<void> {
  logger.warn("Reindex starting: indexed tables will be truncated");
  // Selective truncate: keep manifests/traces/blocked, drop indexed views.
  const { getDb } = await import("../src/store/db.js");
  const db = getDb();
  db.transaction(() => {
    db.exec("DELETE FROM receipts;");
    db.exec("DELETE FROM challenges;");
    db.exec("DELETE FROM intents;");
    db.exec("DELETE FROM agents;");
    db.exec("DELETE FROM delegates;");
    db.exec("DELETE FROM meta WHERE key = 'indexer.last_block';");
  })();

  const poller = await IndexerPoller.fromEnv();
  await poller.reindexFromGenesis();
  logger.info("Reindex complete");
  process.exit(0);
}

main().catch((e) => {
  logger.fatal({ err: e instanceof Error ? e.message : String(e) }, "Reindex failed");
  // Fall through to keep `resetDb` available in case the user wants a full nuke.
  void resetDb;
  process.exit(1);
});
