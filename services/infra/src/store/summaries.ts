import { db, getDb, getProvider } from "./db.js";
import type { SummaryResponse } from "../gemini/schemas.js";

export interface SummaryRow {
  id: string;
  kind: "receipt" | "challenge";
  referenceId: string;
  summary: SummaryResponse;
  createdAt: number;
}

/**
 * Get a cached summary by kind + reference ID.
 */
export async function getCachedSummary(
  kind: "receipt" | "challenge",
  referenceId: string,
): Promise<SummaryResponse | null> {
  const key = referenceId.toLowerCase();

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    const row = sqliteDb
      .prepare(`SELECT * FROM gemini_summaries WHERE kind = ? AND reference_id = ?`)
      .get(kind, key) as Record<string, unknown> | undefined;
    if (!row) return null;
    return JSON.parse(row.summary_json as string) as SummaryResponse;
  }

  const { data } = await db()
    .from("gemini_summaries")
    .select("*")
    .eq("kind", kind)
    .eq("reference_id", key)
    .single();

  if (!data) return null;
  return data.summary_json as unknown as SummaryResponse;
}

/**
 * Cache a summary.
 */
export async function cacheSummary(
  kind: "receipt" | "challenge",
  referenceId: string,
  summary: SummaryResponse,
): Promise<void> {
  const key = referenceId.toLowerCase();
  const createdAt = Math.floor(Date.now() / 1000);

  if (getProvider() === "sqlite") {
    const sqliteDb = getDb();
    sqliteDb
      .prepare(
        `INSERT INTO gemini_summaries (kind, reference_id, summary_json, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(kind, reference_id) DO UPDATE SET
           summary_json = excluded.summary_json,
           created_at = excluded.created_at`,
      )
      .run(kind, key, JSON.stringify(summary), createdAt);
    return;
  }

  await db()
    .from("gemini_summaries")
    .upsert(
      {
        kind,
        reference_id: key,
        summary_json: summary,
        created_at: createdAt,
      },
      { onConflict: "kind,reference_id" },
    );
}
