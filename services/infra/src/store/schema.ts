/**
 * SQLite schema for the IntentGuard infra service.
 *
 * Design notes:
 * - Addresses and bytes32 values are stored as lowercase 0x-prefixed hex strings
 *   for easy joins and case-insensitive lookups.
 * - uint256 values are stored as TEXT (base-10 strings) to avoid JS number
 *   precision loss; comparisons happen in JS as bigints.
 * - `created_at` columns track when the row was indexed/inserted off-chain.
 * - `block_number` / `tx_hash` / `log_index` track on-chain provenance and
 *   make idempotent reindexing safe (UNIQUE constraints below).
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manifests (
  intent_hash   TEXT PRIMARY KEY,        -- 0x… 32 bytes
  manifest_uri  TEXT NOT NULL,
  manifest_json TEXT NOT NULL,           -- canonical JSON, raw bytes UTF-8
  owner         TEXT NOT NULL,
  token         TEXT NOT NULL,
  max_spend_per_tx  TEXT NOT NULL,
  max_spend_per_day TEXT NOT NULL,
  expiry        INTEGER NOT NULL,
  nonce         TEXT NOT NULL,
  allowed_counterparties_json TEXT NOT NULL, -- JSON array of addresses
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_manifests_owner ON manifests(owner);

CREATE TABLE IF NOT EXISTS traces (
  context_digest TEXT PRIMARY KEY,       -- 0x… 32 bytes (= keccak256(canonical(trace)))
  trace_uri      TEXT NOT NULL,
  uri_hash       TEXT NOT NULL,
  agent_id       TEXT,
  owner          TEXT,
  trace_json     TEXT NOT NULL,
  expires_at     INTEGER NOT NULL,
  signer         TEXT NOT NULL,
  signature      TEXT NOT NULL,
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_traces_owner ON traces(owner);
CREATE INDEX IF NOT EXISTS idx_traces_agent ON traces(agent_id);

CREATE TABLE IF NOT EXISTS receipts (
  receipt_id     TEXT PRIMARY KEY,       -- 0x… 32 bytes
  owner          TEXT NOT NULL,
  agent_id       TEXT NOT NULL,
  intent_hash    TEXT NOT NULL,
  target         TEXT NOT NULL,
  token          TEXT NOT NULL,
  amount         TEXT NOT NULL,          -- uint256 as base-10 string
  call_data_hash TEXT NOT NULL,
  context_digest TEXT NOT NULL,
  nonce          TEXT NOT NULL,
  ts             INTEGER NOT NULL,       -- block-time (uint64)
  trace_uri      TEXT,                   -- filled in by TraceURIStored
  block_number   INTEGER NOT NULL,
  tx_hash        TEXT NOT NULL,
  log_index      INTEGER NOT NULL,
  created_at     INTEGER NOT NULL,
  UNIQUE(tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_receipts_owner ON receipts(owner);
CREATE INDEX IF NOT EXISTS idx_receipts_agent ON receipts(agent_id);
CREATE INDEX IF NOT EXISTS idx_receipts_intent ON receipts(intent_hash);
CREATE INDEX IF NOT EXISTS idx_receipts_block ON receipts(block_number);

CREATE TABLE IF NOT EXISTS challenges (
  challenge_id  TEXT PRIMARY KEY,        -- numeric uint as string
  receipt_id    TEXT NOT NULL,
  challenger    TEXT NOT NULL,
  status        TEXT NOT NULL,           -- FILED | UPHELD | REJECTED
  payout        TEXT,                    -- uint256 string when resolved
  filed_block   INTEGER NOT NULL,
  filed_tx      TEXT NOT NULL,
  filed_at      INTEGER NOT NULL,
  resolved_block INTEGER,
  resolved_tx    TEXT,
  resolved_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_challenges_receipt ON challenges(receipt_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON challenges(challenger);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);

CREATE TABLE IF NOT EXISTS intents (
  intent_hash    TEXT PRIMARY KEY,
  owner          TEXT NOT NULL,
  manifest_uri   TEXT NOT NULL,
  active         INTEGER NOT NULL DEFAULT 1, -- bool
  block_number   INTEGER NOT NULL,
  tx_hash        TEXT NOT NULL,
  log_index      INTEGER NOT NULL,
  created_at     INTEGER NOT NULL,
  UNIQUE(tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_intents_owner_active ON intents(owner, active);

CREATE TABLE IF NOT EXISTS agents (
  agent_id       TEXT PRIMARY KEY,
  operator       TEXT NOT NULL,
  metadata_uri   TEXT NOT NULL,
  total_stake    TEXT NOT NULL DEFAULT '0',
  block_number   INTEGER NOT NULL,
  tx_hash        TEXT NOT NULL,
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS delegates (
  owner          TEXT NOT NULL,
  agent_id       TEXT NOT NULL,
  delegate       TEXT NOT NULL,
  approved       INTEGER NOT NULL,           -- bool
  block_number   INTEGER NOT NULL,
  tx_hash        TEXT NOT NULL,
  log_index      INTEGER NOT NULL,
  created_at     INTEGER NOT NULL,
  PRIMARY KEY (owner, agent_id, delegate, log_index, tx_hash)
);
CREATE INDEX IF NOT EXISTS idx_delegates_owner ON delegates(owner, agent_id);

CREATE TABLE IF NOT EXISTS blocked_attempts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id    TEXT,
  owner          TEXT,
  agent_id       TEXT,
  target         TEXT,
  token          TEXT,
  amount         TEXT,
  reason_code    TEXT NOT NULL,
  reason_label   TEXT,
  source         TEXT NOT NULL,           -- 'demo-status' | 'manual'
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_blocked_owner ON blocked_attempts(owner);
CREATE INDEX IF NOT EXISTS idx_blocked_created ON blocked_attempts(created_at);

CREATE TABLE IF NOT EXISTS gemini_summaries (
  kind           TEXT NOT NULL,            -- 'receipt' | 'challenge'
  reference_id   TEXT NOT NULL,            -- receipt_id or challenge_id
  summary_json   TEXT NOT NULL,            -- full SummaryResponse as JSON
  created_at     INTEGER NOT NULL,
  PRIMARY KEY (kind, reference_id)
);

CREATE TABLE IF NOT EXISTS gemini_screenings (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  context_digest TEXT NOT NULL,
  owner          TEXT,
  agent_id       TEXT,
  injection_score REAL NOT NULL,
  severity       TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  response_json  TEXT NOT NULL,
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_screenings_digest ON gemini_screenings(context_digest);

CREATE TABLE IF NOT EXISTS executions (
  id             TEXT PRIMARY KEY,
  owner          TEXT NOT NULL,
  agent_id       TEXT NOT NULL,
  status         TEXT NOT NULL,            -- 'pending' | 'preflight' | 'allowed' | 'blocked' | 'executed' | 'failed'
  proposed_action TEXT NOT NULL,
  trace_json     TEXT,
  context_digest TEXT,
  result_json    TEXT,
  block_reason   TEXT,
  receipt_id     TEXT,
  tx_hash        TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_executions_owner ON executions(owner);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
`;
