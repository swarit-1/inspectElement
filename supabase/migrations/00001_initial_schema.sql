-- IntentGuard initial schema for Supabase (PostgreSQL)
--
-- Design notes:
-- - Addresses and bytes32 values are stored as lowercase 0x-prefixed hex TEXT
--   for easy joins and case-insensitive lookups.
-- - uint256 values are stored as TEXT (base-10 strings) to avoid JS number
--   precision loss; comparisons happen in JS as bigints.
-- - created_at columns track when the row was indexed/inserted off-chain (unix epoch seconds).
-- - block_number / tx_hash / log_index track on-chain provenance and make
--   idempotent reindexing safe (UNIQUE constraints below).

-- ============================================================================
-- Core tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manifests (
  intent_hash               TEXT PRIMARY KEY,
  manifest_uri              TEXT NOT NULL,
  manifest_json             TEXT NOT NULL,
  owner                     TEXT NOT NULL,
  token                     TEXT NOT NULL,
  max_spend_per_tx          TEXT NOT NULL,
  max_spend_per_day         TEXT NOT NULL,
  expiry                    BIGINT NOT NULL,
  nonce                     TEXT NOT NULL,
  allowed_counterparties_json TEXT NOT NULL,
  created_at                BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_manifests_owner ON manifests(owner);

CREATE TABLE IF NOT EXISTS traces (
  context_digest TEXT PRIMARY KEY,
  trace_uri      TEXT NOT NULL,
  uri_hash       TEXT NOT NULL,
  agent_id       TEXT,
  owner          TEXT,
  trace_json     TEXT NOT NULL,
  expires_at     BIGINT NOT NULL,
  signer         TEXT NOT NULL,
  signature      TEXT NOT NULL,
  created_at     BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_traces_owner ON traces(owner);
CREATE INDEX IF NOT EXISTS idx_traces_agent ON traces(agent_id);

CREATE TABLE IF NOT EXISTS receipts (
  receipt_id     TEXT PRIMARY KEY,
  owner          TEXT NOT NULL,
  agent_id       TEXT NOT NULL,
  intent_hash    TEXT NOT NULL,
  target         TEXT NOT NULL,
  token          TEXT NOT NULL,
  amount         TEXT NOT NULL,
  call_data_hash TEXT NOT NULL,
  context_digest TEXT NOT NULL,
  nonce          TEXT NOT NULL,
  ts             BIGINT NOT NULL,
  trace_uri      TEXT,
  block_number   BIGINT NOT NULL,
  tx_hash        TEXT NOT NULL,
  log_index      INTEGER NOT NULL,
  created_at     BIGINT NOT NULL,
  UNIQUE(tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_receipts_owner ON receipts(owner);
CREATE INDEX IF NOT EXISTS idx_receipts_agent ON receipts(agent_id);
CREATE INDEX IF NOT EXISTS idx_receipts_intent ON receipts(intent_hash);
CREATE INDEX IF NOT EXISTS idx_receipts_block ON receipts(block_number);

CREATE TABLE IF NOT EXISTS challenges (
  challenge_id   TEXT PRIMARY KEY,
  receipt_id     TEXT NOT NULL,
  challenger     TEXT NOT NULL,
  status         TEXT NOT NULL,
  payout         TEXT,
  filed_block    BIGINT NOT NULL,
  filed_tx       TEXT NOT NULL,
  filed_at       BIGINT NOT NULL,
  resolved_block BIGINT,
  resolved_tx    TEXT,
  resolved_at    BIGINT
);
CREATE INDEX IF NOT EXISTS idx_challenges_receipt ON challenges(receipt_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON challenges(challenger);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);

CREATE TABLE IF NOT EXISTS intents (
  intent_hash  TEXT PRIMARY KEY,
  owner        TEXT NOT NULL,
  manifest_uri TEXT NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  block_number BIGINT NOT NULL,
  tx_hash      TEXT NOT NULL,
  log_index    INTEGER NOT NULL,
  created_at   BIGINT NOT NULL,
  UNIQUE(tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_intents_owner_active ON intents(owner, active);

CREATE TABLE IF NOT EXISTS agents (
  agent_id     TEXT PRIMARY KEY,
  operator     TEXT NOT NULL,
  metadata_uri TEXT NOT NULL,
  total_stake  TEXT NOT NULL DEFAULT '0',
  block_number BIGINT NOT NULL,
  tx_hash      TEXT NOT NULL,
  created_at   BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS delegates (
  owner        TEXT NOT NULL,
  agent_id     TEXT NOT NULL,
  delegate     TEXT NOT NULL,
  approved     BOOLEAN NOT NULL,
  block_number BIGINT NOT NULL,
  tx_hash      TEXT NOT NULL,
  log_index    INTEGER NOT NULL,
  created_at   BIGINT NOT NULL,
  PRIMARY KEY (owner, agent_id, delegate, log_index, tx_hash)
);
CREATE INDEX IF NOT EXISTS idx_delegates_owner ON delegates(owner, agent_id);

CREATE TABLE IF NOT EXISTS blocked_attempts (
  id           BIGSERIAL PRIMARY KEY,
  scenario_id  TEXT,
  owner        TEXT,
  agent_id     TEXT,
  target       TEXT,
  token        TEXT,
  amount       TEXT,
  reason_code  TEXT NOT NULL,
  reason_label TEXT,
  source       TEXT NOT NULL,
  created_at   BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_blocked_owner ON blocked_attempts(owner);
CREATE INDEX IF NOT EXISTS idx_blocked_created ON blocked_attempts(created_at);

-- ============================================================================
-- Auth & tenancy tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS partners (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  scopes       JSONB NOT NULL DEFAULT '["read"]'::jsonb,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partners_api_key ON partners(api_key_hash);

CREATE TABLE IF NOT EXISTS auth_nonces (
  nonce      TEXT PRIMARY KEY,
  address    TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_nonces_address ON auth_nonces(address);
CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires ON auth_nonces(expires_at);

CREATE TABLE IF NOT EXISTS user_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address     TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_address ON user_sessions(address);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegates ENABLE ROW LEVEL SECURITY;

-- Service role (used by backend) can do everything
CREATE POLICY service_all ON receipts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY service_all ON challenges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY service_all ON intents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY service_all ON blocked_attempts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY service_all ON manifests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY service_all ON traces FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY service_all ON agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY service_all ON delegates FOR ALL USING (true) WITH CHECK (true);
