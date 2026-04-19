# IntentGuard Agent Runtime (Dev 2)

**Canonical spec:** [`specs/specs-dev2.md`](specs/specs-dev2.md) — scope, interfaces (IF-03/04/05/10), milestones, and shared artifacts for this workstream.

## Overview

The runtime layer between the LLM loop and the wallet. Handles:
- `DecisionTrace v1` canonical serialization and `contextDigest` computation
- Trace upload to Dev 3's service (with local stub fallback)
- Guarded execution via Dev 1's `GuardedExecutor` contract
- Three demo agents: legit, blocked, overspend
- Demo control API (IF-10) consumed by Dev 4's dashboard
- Cross-language handoff helpers in TypeScript and Python for Dev 3 parity checks

The demo flow assumes a real owner/delegate split:
- `OWNER_PRIVATE_KEY` is the end-user account whose intent and USDC allowance are enforced on-chain.
- `OPERATOR_PRIVATE_KEY` is the delegate/operator account that registers the agent, stakes, and submits guarded executions.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your operator and owner private keys

# Run tests (trace serialization determinism)
npm test

# Python parity helper (optional)
python3 packages/trace/python/trace.py canonical < trace.json
python3 packages/trace/python/trace.py digest < trace.json

# Start the local trace stub (if Dev 3's service isn't ready)
TRACE_STUB_SIGNER_KEY=0x... npx tsx packages/trace/src/trace-stub-server.ts

# Bootstrap the demo runtime (register + stake + commit intent + delegate/USDC approvals)
npm run bootstrap

# Start the demo control API (for Dev 4)
npm run demo

# Start the mock x402 merchant (if needed)
npm run mock-x402
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPERATOR_PRIVATE_KEY` | Yes | — | Operator EOA private key (0x-prefixed hex) |
| `OWNER_PRIVATE_KEY` | Yes* | — | Demo owner private key. Required for shared/testnet flows; defaults to a local Hardhat account only on `CHAIN_ID=31337`. |
| `RPC_URL` | No | `https://sepolia.base.org` | Canonical runtime RPC endpoint |
| `BASE_SEPOLIA_RPC_URL` | No | `https://sepolia.base.org` | Backward-compatible alias; runtime falls back to this if `RPC_URL` is unset |
| `TRACE_SERVICE_URL` | No | `http://localhost:7403` | Dev 3's trace service or local stub |
| `TRACE_STUB_SIGNER_KEY` | No | hardhat #0 | Private key for local trace stub signer |
| `AGENT_SALT` | No | `intentguard-demo-agent-v1` | Salt for deriving agentId |
| `AGENT_METADATA_URI` | No | `ipfs://stub/agent-metadata` | Metadata URI used by `npm run bootstrap` |
| `DEMO_PORT` | No | `7402` | Demo control API port |
| `MOCK_X402_PORT` | No | `7404` | Mock x402 merchant port |

## Architecture

```
packages/trace/src/
  types.ts         — DecisionTrace v1 schema (FROZEN)
  serialize.ts     — Canonical JSON serializer
  digest.ts        — keccak256 contextDigest computation
  validation.ts    — schema/runtime validation helpers
  config.ts        — Deployment config reader
  abi.ts           — Contract ABI stubs
  trace-client.ts  — Trace upload client (IF-04)
  guard-client.ts  — Guarded execution client (IF-05)
  trace-stub.ts    — Local trace service stub

packages/trace/python/
  trace.py         — Python canonicalization + digest parity helper

agents/
  shared.ts        — Common agent utilities
  legit.ts         — 2 USDC to allowlisted merchant
  blocked.ts       — 20 USDC to attacker (preflight only)
  overspend.ts     — 15 USDC to allowlisted (slash-only)

services/
  demo-control/    — IF-10 API on :7402
  mock-x402/       — Fallback merchant on :7404

fixtures/
  legit.json       — Reproducible trace for legit scenario
  blocked.json     — Reproducible trace for blocked scenario
  overspend.json   — Reproducible trace for overspend scenario

scripts/
  bootstrap-agent.ts — Register agent, top up stake, commit owner intent, approve delegate + owner USDC
```

## Demo Control API (IF-10)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/demo/run-legit` | `{}` | `{ status: "running", scenarioId }` |
| POST | `/demo/run-blocked` | `{}` | `{ status: "running", scenarioId }` |
| POST | `/demo/run-overspend` | `{}` | `{ status: "running", scenarioId }` |
| GET | `/demo/status` | — | `{ last: { scenarioId, outcome, txHash?, reasonCode?, receiptId?, error? } }` |

`outcome ∈ { "success", "blocked", "failed" }`

Implementation note: `/demo/status` also includes additive `status` and `reasonCodeHex` fields for dashboard convenience. The spec-required fields remain stable.

## Dependencies on Other Devs

### Inbound (blocked on)
- **Dev 1**: `deployments/base-sepolia.json` with contract addresses and ABIs in `abi/`
- **Dev 3**: Working `POST /v1/traces` returning signed `TraceAck`

### Outbound (others blocked on)
- **Dev 3**: `DecisionTrace v1` schema (this package)
- **Dev 4**: `POST /demo/*` endpoints (this service)
- **Dev 1**: Canonical serialization spec for `contextDigest` verification

## Canonical Serialization Rules

- UTF-8, no BOM
- Keys alphabetically sorted at every depth
- No whitespace outside string values
- Runtime rejects non-integer numeric values during canonical serialization
- Missing optional fields → explicit `null`
- Arrays preserve insertion order
- Line endings preserved in string values
