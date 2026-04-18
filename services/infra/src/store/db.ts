import Database, { type Database as Sqlite } from "better-sqlite3";
import { dirname, isAbsolute, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { loadEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { SCHEMA_SQL } from "./schema.js";

let cached: Sqlite | null = null;

export function getDb(): Sqlite {
  if (cached) return cached;
  const env = loadEnv();
  const path = resolveDbPath(env.DATABASE_URL);
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  db.exec(SCHEMA_SQL);
  cached = db;
  logger.info({ path }, "SQLite store initialized");
  return db;
}

export function closeDb(): void {
  if (cached) {
    cached.close();
    cached = null;
  }
}

export function resetDb(): void {
  const db = getDb();
  const tables = [
    "manifests",
    "traces",
    "receipts",
    "challenges",
    "intents",
    "agents",
    "delegates",
    "blocked_attempts",
    "meta",
  ];
  const tx = db.transaction(() => {
    for (const t of tables) db.exec(`DELETE FROM ${t};`);
  });
  tx();
  logger.warn("Database reset: all tables truncated");
}

function resolveDbPath(input: string): string {
  if (input === ":memory:") return input;
  if (isAbsolute(input)) return input;
  return resolve(process.cwd(), input);
}
