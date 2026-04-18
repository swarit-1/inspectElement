#!/usr/bin/env bash
# IntentGuard end-to-end local verification.
# Runs against a local Hardhat node (chainId 31337). No testnet keys needed.
# Does NOT modify source. Reports which layer breaks.
#
# Usage:  bash scripts/e2e-local.sh
#         bash scripts/e2e-local.sh --skip-tests    # skip baseline unit tests
#         bash scripts/e2e-local.sh --keep-running  # don't tear down node/infra at end

set -u
set -o pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

LOG_DIR="$REPO_ROOT/.e2e-logs"
mkdir -p "$LOG_DIR"

HARDHAT_LOG="$LOG_DIR/hardhat-node.log"
INFRA_LOG="$LOG_DIR/infra.log"
HARDHAT_PID=""
INFRA_PID=""

SKIP_TESTS=0
KEEP_RUNNING=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests)   SKIP_TESTS=1 ;;
    --keep-running) KEEP_RUNNING=1 ;;
    -h|--help)
      sed -n '2,9p' "$0"; exit 0 ;;
  esac
done

# --- pretty output -----------------------------------------------------------
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; BLUE=$'\033[0;34m'; NC=$'\033[0m'
step()  { echo "${BLUE}==> $*${NC}"; }
ok()    { echo "${GREEN}  ✓ $*${NC}"; }
warn()  { echo "${YELLOW}  ! $*${NC}"; }
fail()  { echo "${RED}  ✗ $*${NC}"; }

FINDINGS=()
record() { FINDINGS+=("$1"); }

# --- cleanup -----------------------------------------------------------------
cleanup() {
  local ec=$?
  if [[ $KEEP_RUNNING -eq 1 ]]; then
    echo
    step "Leaving processes running (--keep-running):"
    [[ -n "$HARDHAT_PID" ]] && echo "  hardhat node PID $HARDHAT_PID (log: $HARDHAT_LOG)"
    [[ -n "$INFRA_PID"   ]] && echo "  infra dev     PID $INFRA_PID   (log: $INFRA_LOG)"
    echo "  stop with: kill $HARDHAT_PID $INFRA_PID"
  else
    [[ -n "$INFRA_PID"   ]] && kill "$INFRA_PID"   2>/dev/null && ok "stopped infra ($INFRA_PID)"
    [[ -n "$HARDHAT_PID" ]] && kill "$HARDHAT_PID" 2>/dev/null && ok "stopped hardhat ($HARDHAT_PID)"
  fi
  echo
  echo "${BLUE}=============================================${NC}"
  echo "${BLUE}  IntentGuard E2E summary${NC}"
  echo "${BLUE}=============================================${NC}"
  if [[ ${#FINDINGS[@]} -eq 0 ]]; then
    ok "no issues recorded"
  else
    for f in "${FINDINGS[@]}"; do echo " - $f"; done
  fi
  echo
  echo "Logs: $LOG_DIR"
  exit $ec
}
trap cleanup EXIT INT TERM

# --- helpers -----------------------------------------------------------------
need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "missing required command: $1"
    record "prereq: $1 not installed"
    exit 1
  fi
}

wait_for_http() {
  local url="$1" label="$2" tries=40
  while ((tries-- > 0)); do
    if curl -fsS "$url" >/dev/null 2>&1; then return 0; fi
    sleep 0.5
  done
  return 1
}

wait_for_rpc() {
  local tries=40
  while ((tries-- > 0)); do
    if curl -fsS -X POST -H 'Content-Type: application/json' \
         --data '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' \
         http://127.0.0.1:8545 >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

# --- prereqs -----------------------------------------------------------------
step "Checking prerequisites"
need_cmd node
need_cmd npm
need_cmd npx
need_cmd curl
ok "node $(node -v), npm $(npm -v)"

if [[ ! -d node_modules ]]; then
  step "Installing dependencies (root)"
  npm install --silent || { fail "npm install failed"; record "root: npm install failed"; exit 1; }
fi

# --- 1. compile --------------------------------------------------------------
step "1. hardhat compile"
if npx hardhat compile > "$LOG_DIR/compile.log" 2>&1; then
  ok "contracts compiled"
else
  fail "compile failed — see $LOG_DIR/compile.log"
  record "contract: compile failed"
  exit 1
fi

# --- 2. baseline tests -------------------------------------------------------
if [[ $SKIP_TESTS -eq 0 ]]; then
  step "2a. hardhat test (contract suite)"
  if npx hardhat test > "$LOG_DIR/hardhat-test.log" 2>&1; then
    ok "contract tests passed ($(grep -Ec '^\s+✓' "$LOG_DIR/hardhat-test.log") cases)"
  else
    fail "contract tests failed — see $LOG_DIR/hardhat-test.log"
    record "contract: hardhat test failed"
  fi

  step "2b. infra vitest suite"
  if npm --workspace @intentguard/infra run test --silent > "$LOG_DIR/infra-test.log" 2>&1; then
    ok "infra tests passed"
  else
    fail "infra tests failed — see $LOG_DIR/infra-test.log"
    record "infra: vitest failed"
  fi
else
  warn "skipping unit tests (--skip-tests)"
fi

# --- 3. start hardhat node ---------------------------------------------------
step "3. starting local hardhat node (127.0.0.1:8545)"
nohup npx hardhat node > "$HARDHAT_LOG" 2>&1 &
HARDHAT_PID=$!
if wait_for_rpc; then
  ok "hardhat node up (pid $HARDHAT_PID)"
else
  fail "hardhat node never came up — see $HARDHAT_LOG"
  record "infra: hardhat node failed to boot"
  exit 1
fi

# --- 4. deploy ---------------------------------------------------------------
step "4. deploying contracts via Ignition (localhost)"
# Clear any stale local deployment state (hardhat node is fresh each run).
rm -rf ignition/deployments/chain-31337 2>/dev/null || true

# Derive the addresses corresponding to our signer PKs so the on-chain
# traceAckSigner actually matches what infra will sign with.
TRACE_ACK_KEY="0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dfd5a500b7"
TRACE_ACK_ADDR=$(npx tsx scripts/deriveAddress.ts "$TRACE_ACK_KEY" 2>/dev/null | tail -n1)
if [[ -z "$TRACE_ACK_ADDR" ]]; then
  fail "could not derive trace-ack address"
  record "script: deriveAddress.ts produced no output"
  exit 1
fi
ok "trace-ack signer will be $TRACE_ACK_ADDR"

# Write the deploy params to a temp file so we can pin traceAckSigner/reviewerSigner.
DEPLOY_PARAMS="$LOG_DIR/deploy-params.json"
cat > "$DEPLOY_PARAMS" <<EOF
{
  "IntentGuardDeployLocal": {
    "traceAckSigner": "$TRACE_ACK_ADDR",
    "reviewerSigner": "$TRACE_ACK_ADDR"
  }
}
EOF

if npx hardhat ignition deploy ignition/modules/DeployLocal.ts \
      --network localhost \
      --parameters "$DEPLOY_PARAMS" \
      > "$LOG_DIR/deploy.log" 2>&1; then
  ok "deployment complete"
else
  fail "deploy failed — see $LOG_DIR/deploy.log"
  record "contract: ignition deploy failed"
  exit 1
fi

# --- 5. write artifacts ------------------------------------------------------
step "5. writing deployments/localhost.json + abi/*.json"
if TRACE_ACK_SIGNER_ADDRESS="$TRACE_ACK_ADDR" REVIEWER_SIGNER_ADDRESS="$TRACE_ACK_ADDR" \
     npx tsx scripts/writeArtifacts.ts localhost 31337 > "$LOG_DIR/writeArtifacts.log" 2>&1; then
  if [[ -f deployments/localhost.json ]]; then
    ok "deployments/localhost.json written"
    echo "     $(node -e "const j=require('./deployments/localhost.json');console.log(Object.keys(j.addresses||j.contracts||{}).join(', '))")"
  else
    fail "writeArtifacts ran but deployments/localhost.json is missing"
    record "wiring: writeArtifacts did not produce localhost.json"
  fi
else
  fail "writeArtifacts failed — see $LOG_DIR/writeArtifacts.log"
  record "wiring: writeArtifacts.ts failed"
fi

# --- 6. infra env + start ----------------------------------------------------
step "6. configuring + starting infra service"
INFRA_ENV="services/infra/.env"

# Write a single clean .env (no stale duplicates from .env.example).
cat > "$INFRA_ENV" <<EOF
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
PORT=8787
HOST=0.0.0.0
CORS_ORIGIN=*
DATABASE_URL=:memory:
TRACE_ACK_PRIVATE_KEY=$TRACE_ACK_KEY
REVIEWER_PRIVATE_KEY=$TRACE_ACK_KEY
TRACE_ACK_TTL_SECONDS=600
DEPLOYMENTS_PATH=$REPO_ROOT/deployments/localhost.json
INDEXER_POLL_MS=2500
INDEXER_BATCH_BLOCKS=2000
LOG_LEVEL=info
EOF
ok "wrote $INFRA_ENV"

nohup npm --workspace @intentguard/infra run dev > "$INFRA_LOG" 2>&1 &
INFRA_PID=$!
if wait_for_http "http://127.0.0.1:8787/v1/health" "infra"; then
  ok "infra up (pid $INFRA_PID)"
  HEALTH=$(curl -fsS http://127.0.0.1:8787/v1/health || echo '{}')
  echo "     health: $HEALTH"
else
  fail "infra never came up — see $INFRA_LOG"
  record "infra: /v1/health never responded (likely deployment schema mismatch; see tail of $INFRA_LOG)"
fi

# --- 7. bootstrap + run agents ----------------------------------------------
step "7. bootstrap agent + run scenarios"
# Hardhat account #0 — pre-funded with 10000 ETH, deployer of the contracts.
OPERATOR_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
export RPC_URL=http://127.0.0.1:8545
export CHAIN_ID=31337
export TRACE_SERVICE_URL=http://127.0.0.1:8787
export DEPLOYMENTS_PATH="$REPO_ROOT/deployments/localhost.json"
export OPERATOR_PRIVATE_KEY="$OPERATOR_KEY"
OPERATOR_ADDR=$(npx tsx scripts/deriveAddress.ts "$OPERATOR_KEY" 2>/dev/null | tail -n1)

if [[ -f scripts/bootstrap-agent.ts ]]; then
  if npx tsx scripts/bootstrap-agent.ts > "$LOG_DIR/bootstrap.log" 2>&1; then
    ok "bootstrap-agent ok"
  else
    fail "bootstrap-agent failed — see $LOG_DIR/bootstrap.log"
    record "agent: bootstrap-agent.ts failed (see tail of $LOG_DIR/bootstrap.log)"
  fi
fi

for name in legit blocked overspend; do
  step "   running agent: $name"
  if npx tsx "agents/$name.ts" > "$LOG_DIR/agent-$name.log" 2>&1; then
    ok "agent $name ok"
  else
    fail "agent $name failed — see $LOG_DIR/agent-$name.log"
    record "agent: $name.ts failed (see tail of $LOG_DIR/agent-$name.log)"
  fi
done

# --- 8. assertions -----------------------------------------------------------
step "8. assertions via /v1/feed"
if curl -fsS "http://127.0.0.1:8787/v1/feed?owner=$OPERATOR_ADDR" > "$LOG_DIR/feed.json" 2>&1; then
  COUNT=$(node -e "const j=require('./.e2e-logs/feed.json');console.log(Array.isArray(j)?j.length:(j.entries||j.items||[]).length)" 2>/dev/null || echo "?")
  ok "/v1/feed returned $COUNT entries (see $LOG_DIR/feed.json)"
else
  fail "/v1/feed unreachable"
  record "infra: /v1/feed not responding"
fi

echo
ok "Done. Findings collected; see summary below."
