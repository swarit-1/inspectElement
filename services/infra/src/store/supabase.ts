import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";

let cached: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client using the service-role key.
 * The service-role key bypasses RLS, which is required for the backend
 * indexer and API operations that read/write across all owners.
 */
export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const env = loadEnv();

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when DATABASE_PROVIDER=supabase",
    );
  }

  cached = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  logger.info({ url: env.SUPABASE_URL }, "Supabase client initialized");
  return cached;
}

/**
 * Returns a Supabase client using the anon key for frontend-facing operations.
 * This client respects RLS policies.
 */
export function getSupabaseAnon(): SupabaseClient {
  const env = loadEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
