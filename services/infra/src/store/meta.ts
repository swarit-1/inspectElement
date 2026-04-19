import { db, getDb, getProvider } from "./db.js";

export async function getMeta(key: string): Promise<string | null> {
  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const row = sqliteDb.prepare(`SELECT value FROM meta WHERE key = ?`).get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  const { data } = await db()
    .from("meta")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    sqliteDb
      .prepare(
        `INSERT INTO meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value);
    return;
  }

  await db()
    .from("meta")
    .upsert({ key, value }, { onConflict: "key" });
}

export const META_LAST_INDEXED_BLOCK = "indexer.last_block";
