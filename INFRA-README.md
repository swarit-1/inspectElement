# IntentGuard Infra (Verifier & Indexer)

Off-chain services that make IntentGuard receipts and challenges usable:

- **IF-01** `POST /v1/manifests` — canonicalize + pin manifest JSON, return `intentHash`.
- **IF-04** `POST /v1/traces` — canonicalize + pin trace JSON, sign `TraceAck`.
- **IF-06** Base Sepolia event indexer (direct viem polling, no subgraph).
- **IF-07** `POST /v1/challenges/prepare-amount` — calldata builder for `fileAmountViolation`.
- **IF-09** Read-model: `GET /v1/feed`, `GET /v1/receipts/:id`, `GET /v1/challenges/:id`.
- **IF-11** `POST /v1/reviewer/resolve` — reviewer-key stub (not in live demo).
- Replay scaffold: `GET /v1/replay/:contextDigest` returns the stored trace.

Single Node/TS process backed by SQLite. Boot it once and you have all of the above.

---

## Quick start

```bash
cd services/infra
cp .env.example .env.local
npm install
npm run keygen >> .env.local        # paste TRACE_ACK_PRIVATE_KEY + REVIEWER_PRIVATE_KEY
npm run dev                         # API + indexer + demo-status poller
```

Health check:

```bash
curl http://localhost:8787/v1/health | jq
# {
#   "ok": true,
#   "service": "intentguard-infra",
#   "chainId": 84532,
#   "traceAckSigner": "0x…",            <-- publish this to Dev 1 by hour 6
#   "reviewerSigner": "0x…",
#   "contracts": { ... } | null,
#   "lastIndexedBlock": "…",
#   "traceAckTtlSeconds": 600
# }
```

---

## Environment variables

| Var | Required | Default | Notes |
| --- | --- | --- | --- |
| `RPC_URL` | yes | `https://sepolia.base.org` | Base Sepolia RPC. |
| `CHAIN_ID` | yes | `84532` | Base Sepolia. |
| `PORT` / `HOST` | no | `8787` / `0.0.0.0` | Express listener. |
| `CORS_ORIGIN` | no | `*` | Comma-separated allowlist or `*`. |
| `DATABASE_URL` | no | `./data/infra.db` | SQLite file path or `:memory:`. |
| `TRACE_ACK_PRIVATE_KEY` | **yes** | — | secp256k1 32-byte hex. **Do not commit.** |
| `REVIEWER_PRIVATE_KEY` | no | — | Required only for the reviewer stub endpoint. |
| `IPFS_TOKEN` | no | — | web3.storage / Pinata bearer token. Falls back to local CAS. |
| `IPFS_API_URL` | no | `https://api.web3.storage` | Override for self-hosted pinning. |
| `PUBLIC_BASE_URL` | no | `http://localhost:8787` | Prefix used by the local CAS gateway URLs. |
| `TRACE_ACK_TTL_SECONDS` | no | `600` | Locked with Dev 1 at 10 minutes. |
| `DEPLOYMENTS_PATH` | no | repo `deployments/base-sepolia.json` | Override for staging configs. |
| `INDEXER_POLL_MS` | no | `2500` | Get-logs poll interval. |
| `INDEXER_BATCH_BLOCKS` | no | `2000` | Upper-bound block range per `getLogs` call. |
| `INDEXER_START_BLOCK` | no | — | Force the indexer to backfill from this height. |
| `INDEXER_DISABLED` | no | `false` | Skip the in-process indexer (run `npm run indexer` separately). |
| `REVIEWER_BROADCAST` | no | `false` | If `true`, the reviewer endpoint also broadcasts the tx. |
| `DEMO_STATUS_URL` | no | — | If set, infra polls Dev 2's `/demo/status` and merges blocked entries into the feed (server-side merge default). |
| `DEMO_STATUS_POLL_MS` | no | `3000` | Poll interval for the above. |
| `LOG_LEVEL` | no | `info` | pino level. |

### Signer keys

Generate fresh keys with:

```bash
npm run keygen
```

Add the output to `.env.local`. **Never commit the keys.** The pubkey portion (printed under `# Public addresses`) is what you give Dev 1 so they can bake it into `GuardedExecutor`'s constructor — or call `setTraceAckSigner(address)` after deploy. You can also discover it at runtime via `GET /v1/health`.

---

## NPM scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | `tsx watch` against `src/server.ts` (API + indexer + demo poller). |
| `npm run start` | Run the compiled JS (`dist/server.js`). |
| `npm run build` | TypeScript → `dist/`. |
| `npm run indexer` | Standalone indexer (use with `INDEXER_DISABLED=true` on the API node). |
| `npm run reindex` | Truncate **indexed** tables (receipts / challenges / intents / agents / delegates / `meta`) and replay from the deployment start block. Manifests, traces, and blocked entries are preserved. |
| `npm run reset` | Truncate **every** table including manifests/traces (full nuke). |
| `npm run keygen` | Generate fresh signer keys; print env vars + public addresses. |
| `npm run test` | Vitest run. |
| `npm run typecheck` | `tsc --noEmit`. |

---

## Storage layout

SQLite tables (`src/store/schema.ts`):

| Table | Purpose |
| --- | --- |
| `manifests` | Canonical manifest JSON + `intentHash` index (off-chain). |
| `traces` | Canonical trace JSON + `contextDigest` index + signed `TraceAck`. |
| `receipts` | Indexed `ActionReceipt` (one row per `receiptId`). |
| `challenges` | Indexed `ChallengeFiled` / `ChallengeResolved`. |
| `intents` | Indexed `IntentCommitted` / `IntentRevoked`. |
| `agents` / `delegates` | Indexed agent registry + delegation events. |
| `blocked_attempts` | Server-side merge of Dev 2's blocked scenarios. |
| `meta` | Indexer cursor + misc key/value state. |

Local IPFS fallback writes content-addressed bytes to `data/cas/<sha256>` and serves them at `${PUBLIC_BASE_URL}/ipfs/<sha256>` (handled by `api/local-cas.ts`). When `IPFS_TOKEN` is set, real IPFS URIs (`ipfs://…`) are returned instead.

---

## TraceAck signature scheme (locked with Dev 1)

```
digest    = keccak256(abi.encode(bytes32 contextDigest, bytes32 uriHash, uint64 expiresAt))
signature = personal_sign(digest)         // EIP-191
```

Dev 1's `GuardedExecutor` reconstructs the same `digest` and verifies with `ECDSA.recover(toEthSignedMessageHash(digest), sig) == traceAckSigner`. See `test/signer.test.ts` for the cross-verification fixture.

---

## Reindex / reset runbook

| Goal | Command |
| --- | --- |
| Re-pull every event from chain (after schema change or missed blocks). | `npm run reindex` |
| Wipe **all** off-chain state (manifests, traces, blocked, indexed) and start fresh. | `npm run reset && npm run reindex` |
| Re-pin a missing manifest / trace. | Re-POST to the original endpoint — both routes are idempotent on `intentHash` / `contextDigest`. |
| Switch deployments. | Update `DEPLOYMENTS_PATH` (or replace `deployments/base-sepolia.json`) and `npm run reindex`. |

---

## Interface contract checklist (do NOT add new ones)

- IF-01: `POST /v1/manifests` (Dev 4)
- IF-04: `POST /v1/traces` (Dev 2)
- IF-06: indexed events from Dev 1's ABIs (we do not modify those ABIs)
- IF-07: `POST /v1/challenges/prepare-amount` (Dev 4)
- IF-09: `GET /v1/feed`, `GET /v1/receipts/:id`, `GET /v1/challenges/:id` (Dev 4)
- IF-11: `POST /v1/reviewer/resolve` → `resolveByReviewer(...)` (Dev 1, via backend wallet)

If a new boundary is genuinely demo-critical, raise it in the cross-cutting channel before adding a route — Dev 4 has a freeze on consumed surfaces past hour 12.

---

## Dependencies on other devs

- **Dev 1**: deployed addresses (`deployments/base-sepolia.json`), frozen ABIs, locked TraceAck signature scheme.
- **Dev 2**: canonical trace serializer rules (we mirror them in `src/canonical/json.ts`), `DecisionTrace v1` schema, optional `DEMO_STATUS_URL` for blocked-feed merge.
- **Dev 4**: schema versions in `schemas/feed.ts`, `schemas/receipt.ts`, `schemas/challenge.ts` are frozen. Do not request new fields without coordinating.
