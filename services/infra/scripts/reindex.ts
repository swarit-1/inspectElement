import { getProvider } from "../src/store/db.js";
import { setMeta, META_LAST_INDEXED_BLOCK } from "../src/store/meta.js";
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

  const provider = getProvider();
  if (provider === "sqlite") {
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
  } else {
    const { db } = await import("../src/store/db.js");
    const supabase = db();
    for (const table of ["receipts", "challenges", "intents", "agents", "delegates"]) {
      await supabase.from(table).delete().neq("1", "0");
    }
    await setMeta(META_LAST_INDEXED_BLOCK, "0");
  }

  const poller = await IndexerPoller.fromEnv();
  await poller.reindexFromGenesis();
  logger.info("Reindex complete");
  process.exit(0);
}

main().catch((e) => {
  logger.fatal({ err: e instanceof Error ? e.message : String(e) }, "Reindex failed");
  process.exit(1);
});
