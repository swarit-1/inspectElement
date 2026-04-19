import { resetDb } from "../src/store/db.js";
import { logger } from "../src/utils/logger.js";

/**
 * Truncate every table. The next indexer run will replay from `INDEXER_START_BLOCK`
 * (or the genesis-of-deployment fallback). Local content-addressed pin files
 * under `data/cas/` are left in place since they are content-addressed and
 * cheap to keep around.
 *
 *   npm run reset
 */
async function main(): Promise<void> {
  await resetDb();
  logger.info("DB reset complete; run `npm run reindex` to re-pull on-chain state");
}

main().catch((e) => {
  logger.fatal({ err: e instanceof Error ? e.message : String(e) }, "Reset failed");
  process.exit(1);
});
