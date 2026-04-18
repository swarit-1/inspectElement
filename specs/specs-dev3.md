# Dev 3 — Verifier & Infra Engineer (Off-chain Services, Indexer, Reviewer)

> Owns everything off-chain that makes receipts and challenges usable: manifest pinning, trace pinning + signing, event indexing, read-model APIs, challenge-prep pipeline, and the reviewer-key stub. **Your `TraceAck` signer is on the critical path for Dev 1 and Dev 2 — publish the signer pubkey by hour 6.**

---

## 1. Scope

### In scope
- `POST /v1/manifests` (IF-01): pin canonical manifest JSON → return `{ manifestURI, intentHash }`.
- `POST /v1/traces` (IF-04): pin trace JSON, sign `TraceAck`, return signature.
- Service key management: `TraceAck` signer (ECDSA secp256k1, same as EVM).
- Persistent storage: manifests, traces, indexed receipts, indexed challenges.
- Base Sepolia log indexer for IF-06 events (direct `viem` log polling, not a hosted subgraph).
- Read-model API (IF-09): feed, receipt detail, challenge detail.
- Challenge-prep API (IF-07): turn a `receiptId` into calldata for `fileAmountViolation`.
- Reviewer signer stub + endpoint for IF-11 (not used in live demo).
- Replay-engine scaffold: load a stored trace bundle by `contextDigest`.
- Ops README: env vars, signer key handling, reindex/reset.

### Out of scope
- Contract logic (Dev 1).
- LLM prompting, agents, x402 (Dev 2).
- UI / challenge-button UX (Dev 4).

---

## 2. Service architecture

Single Node/TS service (or two small ones) backed by Postgres or SQLite. Deploy to Railway/Fly/ngrok — whatever gives a public HTTPS URL the frontend can hit.

```
services/infra/
├── api/                 # Express/Fastify HTTP routes (IF-01, IF-04, IF-07, IF-09, IF-11)
├── indexer/             # viem log poller → DB writes
├── signer/              # TraceAck + reviewer signing, key management
├── store/               # DB access (manifests, traces, receipts, challenges)
└── replay/              # Scaffold: load trace by contextDigest
```

Storage: IPFS for manifest + trace JSON (Pinata/web3.storage). Fallback to signed ngrok-backed URL if IPFS is flaky (see §8).

---

## 3. Deliverables

### 3.1 Manifest pinning (**exposes IF-01**)
```
POST /v1/manifests
Body: { owner, token, maxSpendPerTx, maxSpendPerDay, allowedCounterparties, expiry, nonce }
Response 200: { manifestURI: "ipfs://…", intentHash: "0x…" }
```
- Canonicalize the manifest: sorted keys, UTF-8, numeric strings for `uint256`. Same rules as Dev 2's trace canonicalization — **align with Dev 2's serializer**.
- `intentHash = keccak256(canonicalManifestJson)`.
- Pin to IPFS; store `{ intentHash → manifestJson, manifestURI }` in DB for fast replay.

### 3.2 Trace pinning + `TraceAck` signing (**exposes IF-04**)
```
POST /v1/traces
Body: { agentId, owner, contextDigest, trace }
Response 200: { traceURI, contextDigest, uriHash, expiresAt, signature }
```
- Validate: `contextDigest === keccak256(canonical(trace))` — **use Dev 2's canonical serializer**; reject on mismatch.
- Pin trace to IPFS; compute `uriHash = keccak256(bytes(traceURI))`.
- Sign `TraceAck` over `keccak256(abi.encode(contextDigest, uriHash, expiresAt))` using the service's secp256k1 key. Match whatever EIP-191 / EIP-712 scheme Dev 1's `GuardedExecutor` verifies — **coordinate exact hash scheme with Dev 1 by hour 8**.
- `expiresAt = block.timestamp + 10 minutes` (freeze with Dev 1).
- Publish signer pubkey to Dev 1 by hour 6 so he can bake into `GuardedExecutor` constructor.

### 3.3 Event indexer (**consumes IF-06**)
- Use `viem` `publicClient.watchContractEvent` or `getLogs` polling every 2–3s.
- Decode events from Dev 1's ABIs: `ActionReceipt`, `ReceiptStored`, `TraceURIStored`, `ChallengeFiled`, `ChallengeResolved`.
- Also index `IntentCommitted`, `IntentRevoked`, `AgentDelegateSet`, `AgentRegistered`, `AgentStaked` for context.
- Write to DB tables: `receipts`, `challenges`, `intents`, `agents`, `delegates`.
- Reindex-from-scratch command: `npm run reindex` (truncates + replays from genesis block of deployment).

### 3.4 Read-model API (**exposes IF-09**)
```
GET /v1/feed?owner=0x…
→ [{ type: "receipt" | "challenge" | "intent" | "blocked", ...summary, timestamp }]
   (newest first; includes legit, overspend, and blocked entries)

GET /v1/receipts/:receiptId
→ { receiptId, owner, agentId, intentHash, target, token, amount, contextDigest, traceURI, callDataHash, timestamp, challengeable: boolean, challengeWindowEndsAt }

GET /v1/challenges/:challengeId
→ { challengeId, receiptId, status: "FILED" | "UPHELD" | "REJECTED", filedAt, resolvedAt, payout, challenger }
```

**Blocked attempts in feed:** poll Dev 2's `/demo/status` each time a blocked scenario runs, and insert a `blocked` entry into the feed with the `reasonCode`. Alternatively, Dev 4 merges blocked entries client-side — **coordinate this with Dev 4 by hour 20**, default to server-side merge.

### 3.5 Challenge-preparation API (**exposes IF-07**)
```
POST /v1/challenges/prepare-amount
Body: { receiptId, challenger }
Response: { eligible, reason, bondAmount, to, data, value, chainId }
```
- Load receipt; load intent config by `intentHash`.
- Eligibility checks:
  - receipt exists
  - `challengeWindowEndsAt > now`
  - `receipt.amount > intent.maxSpendPerTx`
  - no existing filed challenge for this receipt
- On eligible: encode `fileAmountViolation(bytes32 receiptId)` selector + args; return `to = ChallengeArbiter`, `data`, `value = 0`, `bondAmount = 1_000_000`, `chainId = 84532`.
- Frontend then runs USDC approval + sends the tx.

### 3.6 Reviewer signer stub (**exposes IF-11 wrapper**)
- `POST /v1/reviewer/resolve { challengeId, uphold, slashAmount }` → signs and posts `resolveByReviewer(...)` via backend wallet.
- Not in live demo flow; must exist as a `/review` target.

### 3.7 Replay-engine scaffold
- `GET /v1/replay/:contextDigest` → returns the stored trace JSON.
- No live semantic judging — just retrieval for the future reviewer console.

### 3.8 Ops
- `INFRA-README.md` with:
  - env vars (`RPC_URL`, `TRACE_ACK_PRIVATE_KEY`, `REVIEWER_PRIVATE_KEY`, `IPFS_TOKEN`, `DATABASE_URL`, contract addresses).
  - signer key handling (never commit keys; use `.env.local`).
  - `npm run reindex` and `npm run reset` instructions.

---

## 4. Interface contracts

| ID    | Direction           | Surface |
| ----- | ------------------- | ------- |
| IF-01 | Exposes → Dev 4     | `POST /v1/manifests` |
| IF-04 | Exposes → Dev 2     | `POST /v1/traces` |
| IF-06 | Consumes (Dev 1)    | `ActionReceipt`, `ReceiptStored`, `TraceURIStored`, `ChallengeFiled`, `ChallengeResolved` |
| IF-07 | Exposes → Dev 4     | `POST /v1/challenges/prepare-amount` |
| IF-09 | Exposes → Dev 4     | `GET /v1/feed`, `GET /v1/receipts/:id`, `GET /v1/challenges/:id` |
| IF-11 | Produces (for Dev 1)| `resolveByReviewer(uint256, bool, uint256, bytes)` — via backend wallet |

---

## 5. Dependencies on other devs

### Inbound (you are blocked on)
- **Dev 1:**
  - Frozen event signatures (hour 4) → needed for indexer decoder.
  - Deployed contract addresses (hour 12) → needed to start live indexing.
  - Exact hash scheme for `TraceAck` signature (hour 8) → your signer must match his verifier.
- **Dev 2:**
  - Canonical trace serialization rules (hour 8) → you must canonicalize identically to compute/verify `contextDigest`.
  - `DecisionTrace v1` schema frozen (hour 12).

### Outbound (others blocked on you)
- **Dev 1:** your `TraceAck` signer pubkey by hour 6 (he needs it in `GuardedExecutor` constructor; if late, use the placeholder + `setTraceAckSigner` pattern).
- **Dev 2:** working `POST /v1/traces` by hour 14 — before then, Dev 2 uses a local stub.
- **Dev 4:** working `POST /v1/manifests`, `GET /v1/feed`, `POST /v1/challenges/prepare-amount` by hour 24.

### Cross-cutting coordination
- **Manifest canonicalization must match Dev 4's signing** — Dev 4 signs a hash of the manifest (typed-data or raw). Agree on the canonical JSON format by hour 8 so `intentHash` is identical on both sides.
- **Blocked feed entries:** decide with Dev 4 by hour 20 whether server-side merge (you poll Dev 2) or client-side merge (Dev 4 merges). Default: server-side.

---

## 6. Milestones

| Hour  | Exit criteria                                                                                                                                                   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–6   | Signer keypair generated; pubkey published. `POST /v1/manifests` returns stable `intentHash` on repeated input. Schema of `/v1/feed` response frozen.            |
| 6–12  | Local indexer decodes Dev 1's ABIs against a hardhat fixture. `POST /v1/traces` returns a valid signed `TraceAck` that Dev 1's local guard accepts.             |
| 12–28 | Indexer reads live Base Sepolia `ActionReceipt` events. `/v1/feed` returns at least one real receipt. `/v1/challenges/prepare-amount` returns working calldata. |
| 28–40 | Demo steps 4, 6, 7 supported: legit receipt in feed, overspend receipt in feed, upheld challenge in feed/detail after on-chain resolution. Reindex/reset works without manual DB edits. |

---

## 7. Shared artifacts you own

- `services/infra/**`
- `abi/` consumer only — do NOT modify (Dev 1 owns).
- `schemas/feed.ts`, `schemas/receipt.ts`, `schemas/challenge.ts` — response shapes.
- `INFRA-README.md`

---

## 8. Risks & fallbacks

| Risk                                 | Fallback                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| IPFS pinning unreliable              | Serve trace/manifest JSON from signed ngrok-backed URL; keep same `traceURI` + `TraceAck` shape. Walrus is stretch only.   |
| Event indexing lags                  | Direct `viem` log polling every 2s; write to local Postgres. No subgraph.                                                  |
| User challenge flow needs two txs    | Implement a funded watchdog-relay endpoint behind the same IF-07 response (`to` = relay proxy). Coordinate with Dev 4.     |
| `TraceAck` signature scheme mismatch | Lock EIP-191 personal-sign of `keccak256(abi.encode(contextDigest, uriHash, expiresAt))` by hour 8 with Dev 1; write a cross-verify test. |

---

## 9. Do NOT do

- Do NOT dual-write to Walrus unless stretch hours are available — IPFS first.
- Do NOT build a subgraph — direct log polling only.
- Do NOT invent new event shapes or add fields to Dev 1's events — consume the ABIs as-published.
- Do NOT live-run the semantic replay path in the demo — scaffold only.
- Do NOT commit signer keys.
