import { loadEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { getSupabase } from "./supabase.js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Database provider abstraction.
 *
 * In production (DATABASE_PROVIDER=supabase), all store modules use the
 * Supabase client. The legacy SQLite path is retained for local dev when
 * DATABASE_PROVIDER=sqlite.
 */

let provider: "sqlite" | "supabase" | null = null;

export function getProvider(): "sqlite" | "supabase" {
  if (provider) return provider;
  const env = loadEnv();
  provider = env.DATABASE_PROVIDER;
  return provider;
}

// ---------------------------------------------------------------------------
// Supabase path
// ---------------------------------------------------------------------------

export function db(): SupabaseClient {
  return getSupabase();
}

// ---------------------------------------------------------------------------
// SQLite path (legacy, local dev only)
// ---------------------------------------------------------------------------

// Use `any` for the SQLite database type to avoid tight coupling to better-sqlite3
// when Supabase is the active provider. better-sqlite3 is only loaded dynamically.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedSqlite: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDb(): any {
  if (cachedSqlite) return cachedSqlite;

  // Dynamic import avoids requiring better-sqlite3 when using Supabase
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const Database = require("better-sqlite3");
  const { dirname, isAbsolute, resolve } = require("node:path");
  const { mkdirSync } = require("node:fs");
  const { SCHEMA_SQL } = require("./schema.js");

  const env = loadEnv();
  const input = env.DATABASE_URL;
  const path =
    input === ":memory:" ? input : isAbsolute(input) ? input : resolve(process.cwd(), input);
  mkdirSync(dirname(path), { recursive: true });

  const sqliteDb = new Database(path);
  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.pragma("foreign_keys = ON");
  sqliteDb.pragma("synchronous = NORMAL");
  sqliteDb.exec(SCHEMA_SQL);
  cachedSqlite = sqliteDb;
  logger.info({ path }, "SQLite store initialized (legacy mode)");
  return cachedSqlite;
}

export function closeDb(): void {
  if (cachedSqlite) {
    cachedSqlite.close();
    cachedSqlite = null;
  }
}

export function initDb(): void {
  const p = getProvider();
  if (p === "supabase") {
    db(); // initialize Supabase client
    logger.info("Database provider: Supabase");
  } else {
    getDb(); // initialize SQLite
    logger.info("Database provider: SQLite (legacy)");
  }
}

export async function resetDb(): Promise<void> {
  const p = getProvider();
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

  if (p === "supabase") {
    const supabase = db();
    for (const t of tables) {
      await supabase.from(t).delete().neq("1", "0"); // delete all rows
    }
  } else {
    const sqliteDb = getDb();
    const tx = sqliteDb.transaction(() => {
      for (const t of tables) sqliteDb.exec(`DELETE FROM ${t};`);
    });
    tx();
  }
  logger.warn("Database reset: all tables truncated");
}
