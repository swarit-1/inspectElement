import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Vitest global setup: configure a hermetic env that uses a per-run SQLite
 * file under `.tmp/test-<pid>.db` and a deterministic-ish signer key.
 */
const tmpDir = resolve(process.cwd(), ".tmp");
mkdirSync(tmpDir, { recursive: true });

const dbPath = resolve(tmpDir, `test-${process.pid}-${Date.now()}.db`);
const traceAckKey = generatePrivateKey();
const reviewerKey = generatePrivateKey();

process.env.DATABASE_URL = dbPath;
process.env.TRACE_ACK_PRIVATE_KEY = traceAckKey;
process.env.REVIEWER_PRIVATE_KEY = reviewerKey;
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "silent";
process.env.PUBLIC_BASE_URL = "http://localhost:8787";
process.env.RPC_URL = "http://127.0.0.1:8545";

export const TEST_TRACE_ACK_ADDRESS = privateKeyToAccount(traceAckKey).address;
export const TEST_REVIEWER_ADDRESS = privateKeyToAccount(reviewerKey).address;
export const TEST_DB_PATH = dbPath;

process.on("exit", () => {
  try {
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-journal`, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
  } catch {
    // best effort
  }
});
