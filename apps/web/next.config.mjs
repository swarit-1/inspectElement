import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Monorepo root (intentguard) — avoids Turbopack picking a parent dir when multiple lockfiles exist. */
const monorepoRoot = path.join(__dirname, "..", "..");

/**
 * Load `.env*` into `process.env` before Next/Turbopack inlines `NEXT_PUBLIC_*`.
 * - Repo root: single shared `.env.local` for the monorepo
 * - `apps/web`: local overrides (wins over root for duplicate keys)
 *
 * With `turbopack.root` pointing at the monorepo root, relying on only one load can still
 * leave client bundles without `NEXT_PUBLIC_PRIVY_APP_ID`; dual load + `env` below fixes that.
 */
loadEnvConfig(monorepoRoot);
loadEnvConfig(__dirname);

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: monorepoRoot,
  },
  /**
   * Ensures the Privy App ID is inlined into client chunks even when the value only exists
   * in a parent-directory `.env.local` (Turbopack + monorepo root edge case).
   */
  env: {
    NEXT_PUBLIC_PRIVY_APP_ID: privyAppId,
  },
  async redirects() {
    return [
      { source: "/demo", destination: "/theater", permanent: false },
    ];
  },
};

export default nextConfig;
