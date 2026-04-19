/**
 * Side-effect module: loads .env files into process.env for any entry point
 * that is launched with tsx (which does not auto-load dotenv).
 *
 * Import at the very top of an entry file, BEFORE any module that reads
 * process.env at import time:
 *
 *   import "../scripts/load-env.js";
 *
 * Later files do NOT override earlier ones (override: false), and
 * pre-existing process.env values always win, so shell-level env and
 * service-local overrides remain authoritative.
 */

import { config as loadDotenv } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");

for (const file of [
  path.join(REPO_ROOT, ".env.local"),
  path.join(REPO_ROOT, ".env"),
]) {
  loadDotenv({ path: file, override: false });
}
