# Dev 2 — Agent Runtime Engineer (Agent SDK, Trace Capture, Demo Agents)

> Owns the runtime between the LLM loop and the wallet: `DecisionTrace v1` serialization, `contextDigest`, trace upload, `TraceAck` handling, `ExecutionRequest` construction, and the three scripted demo agents (legit / blocked / overspend). **You own the trace schema — freeze it by hour 12 or the dispute story breaks.**

---

## 1. Scope

### In scope
- `DecisionTrace v1` JSON schema + canonical serializer.
- `contextDigest = keccak256(canonicalTraceJson)` helper (reproducible across runs and languages).
- Trace upload client → Dev 3's `POST /v1/traces` (IF-04).
- Guarded-execution client → Dev 1's `GuardedExecutor` (IF-05).
- Agent bootstrap: derive delegate key → register `agentId` → stake 50 USDC.
- Three demo agents: legit (2 USDC), blocked (20 USDC to attacker), overspend (15 USDC to allowlisted).
- Mock x402 merchant (fallback for flaky third-party).
- Demo control API (IF-10) consumed by Dev 4.
- JSON fixtures per scenario.

### Out of scope
- Contract logic (Dev 1).
- Event indexing, manifest pinning, read model (Dev 3).
- Any UI (Dev 4).

---

## 2. `DecisionTrace v1` schema (**freeze by hour 12**)

This is the single most important artifact you own. Dev 3 pins it; Dev 1's guard verifies the digest via `TraceAck`. Once frozen, changing any field invalidates all prior receipts.

```json
{
  "schemaVersion": "1.0.0",
  "agentId": "0x…32bytes",
  "owner":   "0x…",
  "intentHash": "0x…32bytes",
  "session": { "id": "uuid", "startedAt": 1700000000, "model": "claude-…", "temperature": 0 },
  "prompts": [ { "role": "user" | "system" | "assistant", "content": "…", "timestamp": 1700000000 } ],
  "toolCalls": [ { "name": "…", "input": {…}, "output": {…}, "timestamp": 1700000000 } ],
  "observations": [ { "source": "…", "content": "…", "timestamp": 1700000000 } ],
  "proposedAction": {
    "target": "0x…",
    "token":  "0x…",  // USDC
    "amount": "15000000",
    "callData": "0x…",
    "rationale": "…"
  },
  "nonce": 0
}
```

### Canonical serialization rules (critical for deterministic digests)
- UTF-8, no BOM.
- Keys alphabetically sorted at every depth.
- No whitespace outside string values.
- Numbers: integers only for amounts/timestamps (encode as JSON strings for `uint256`).
- Missing optional fields → emit with explicit `null`.
- Arrays preserve insertion order (do NOT sort).
- Line endings stripped from string values? **No — preserve raw content.**

Publish: `@intentguard/trace-schema` as a small package (or a single `trace.ts` + `trace.py` helper). Dev 3 imports it.

---

## 3. Deliverables

### 3.1 Trace library
- `serializeCanonical(trace): string` — deterministic JSON.
- `computeContextDigest(trace): bytes32` — `keccak256(serializeCanonical(trace))`.
- Unit tests: 100 random traces serialize identically across two runs.

### 3.2 Trace upload client (consumes IF-04)
- `uploadTrace(trace) → { traceURI, contextDigest, uriHash, expiresAt, signature }`.
- POSTs to Dev 3's `/v1/traces`; returns `TraceAck` struct fields ready to embed in `ExecutionRequest`.
- Validates that returned `contextDigest` matches locally computed one; aborts if mismatch.

### 3.3 Guarded execution client (consumes IF-05)
- `preflight(execReq) → { decision, reasonCode }`
- `execute(execReq) → receiptId | throws GuardRejected(reasonCode)`
- Uses viem/ethers + ABI from Dev 1's `abi/` bundle.
- Reads contract addresses from `deployments/base-sepolia.json`.

### 3.4 Agent bootstrap
`scripts/bootstrap-agent.ts`:
1. Load operator EOA from `OPERATOR_PRIVATE_KEY`.
2. Derive `agentId = keccak256(operator || salt)`.
3. `AgentRegistry.registerAgent(agentId, operator, metadataURI)`.
4. `USDC.approve(StakeVault, 50e6)` → `AgentRegistry.stake(agentId, 50e6)`.
5. Print `agentId`, txHashes, stake amount.

### 3.5 Three demo agents
Each agent is a small scripted LLM loop (can be hard-coded for demo) that ends in an `executeWithGuard` call.

| Agent      | Target                | Token | Amount | Expected outcome                                         |
| ---------- | --------------------- | ----- | ------ | -------------------------------------------------------- |
| legit      | allowlisted merchant  | USDC  | 2 USDC | `GREEN`; receipt emitted; txHash returned                |
| blocked    | attacker (non-allow)  | USDC  | 20 USDC| `preflightCheck → (RED, COUNTERPARTY_NOT_ALLOWED)`; execute NOT called |
| overspend  | allowlisted merchant  | USDC  | 15 USDC| `GREEN` (guard does not enforce `maxSpendPerTx`); receipt emitted |

**For `blocked`:** call `preflightCheck` only, record reasonCode, expose via `/demo/status`. Do not call `executeWithGuard` (it would revert with no log).

### 3.6 Mock x402 merchant
- Minimal HTTP server returning `402 Payment Required` with `{ receiver, token, amount }`.
- Only used if public x402 is flaky. Same payment-required shape either way.

### 3.7 Demo control API (**exposes IF-10**)
HTTP server, e.g. `:7402`:

| Method | Path                | Body         | Response                                             |
| ------ | ------------------- | ------------ | ---------------------------------------------------- |
| POST   | `/demo/run-legit`    | `{}`         | `{ status: "running", scenarioId }`                  |
| POST   | `/demo/run-blocked`  | `{}`         | `{ status: "running", scenarioId }`                  |
| POST   | `/demo/run-overspend`| `{}`         | `{ status: "running", scenarioId }`                  |
| GET    | `/demo/status`       |              | `{ last: { scenarioId, outcome, txHash?, reasonCode?, receiptId?, error? } }` |

`outcome ∈ { "success", "blocked", "failed" }`. Dev 4 polls `/demo/status`.

### 3.8 JSON fixtures
One fixture per scenario at `fixtures/{legit,blocked,overspend}.json` with fixed prompts, tool outputs, expected target/amount. Used to make traces reproducible.

### 3.9 Approval-gated judge enhancements
The items below are feasible, but they cross Dev 1 / Dev 3 / Dev 4 boundaries. Do not implement them without explicit approval because they either change the runtime's live execution behavior or require new interface commitments.

1. Hard-mode Gemini screener
   Consume Dev 3's optional `POST /v1/screen` and, if `injectionScore > threshold`, abort before calling `executeWithGuard`.
   Advisory mode is preferred by default. Hard mode should report a clear local outcome such as `blocked` + `INJECTION_DETECTED` via `/demo/status`.
   Requires: team agreement on threshold, Dev 3 screener availability, and Dev 4 UI support.
2. Depeg scenario support
   If Dev 1 adds a depeg guard or `MockPriceFeed`, expose a fourth scripted scenario such as `/demo/run-depeg` or reuse `/demo/run-legit` against the toggled feed state.
   Runtime should treat the depeg block exactly like other deterministic preflight failures and surface the live reason code.
   Requires: protocol approval from Dev 1 because it changes guard reason codes and deployment artifacts.
3. Risk-overlay enrichment
   Runtime may consume off-chain risk metadata such as counterparty risk score, blacklist hints, or behavioral anomaly flags and expose them through `/demo/status` for the dashboard.
   This is display-only unless the team explicitly approves using it to alter execution decisions.
   Requires: Dev 3 read-model support and Dev 4 rendering support. Do not mutate `DecisionTrace v1` to add this late.

---

## 4. Interface contracts

| ID    | Direction | Surface |
| ----- | --------- | ------- |
| IF-03 | Consumes (Dev 1) | `registerAgent`, `stake`, `getAgent` |
| IF-04 | Consumes (Dev 3) | `POST /v1/traces` |
| IF-05 | Consumes (Dev 1) | `preflightCheck`, `executeWithGuard` |
| IF-10 | Exposes → Dev 4  | `/demo/run-legit`, `/demo/run-blocked`, `/demo/run-overspend`, `/demo/status` |

---

## 5. Dependencies on other devs

### Inbound (you are blocked on)
- **Dev 1:** frozen `ExecutionRequest` + `TraceAck` structs (hour 4); deployed `GuardedExecutor` + `AgentRegistry` addresses (hour 12); ABIs in `abi/`.
  - **Mitigation:** start on local hardhat with Dev 1's interface stubs by hour 4. Move to Base Sepolia when addresses are published.
- **Dev 3:** working `POST /v1/traces` returning `TraceAck` (hour 14).
  - **Mitigation:** write a local `/v1/traces` stub that signs with a dev key; Dev 1's guard must trust that signer in testnet. Swap to real Dev 3 service when live.

### Outbound (others blocked on you)
- **Dev 3:** the `DecisionTrace v1` schema (for trace storage) — **publish by hour 12**.
- **Dev 4:** `POST /demo/*` endpoints (hour 24) — until then, Dev 4 uses mocked status.
- **Dev 1:** `contextDigest` canonical-serialization spec — so his `TraceAck` verification matches yours. **Publish serializer rules by hour 8.**

---

## 6. Milestones

| Hour  | Exit criteria                                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–12  | `DecisionTrace v1` frozen; canonical serializer + `computeContextDigest` published with tests (same trace → same digest across 100 runs). 3 fixtures exist. Runtime builds a local `ExecutionRequest` successfully. |
| 12–28 | Live trace upload → Dev 3; valid `TraceAck` accepted by Dev 1's guard on Base Sepolia. One successful `executeWithGuard` transaction. Blocked attack returns live reason code via `preflightCheck`. Mock/real x402 flow wired. |
| 28–40 | Demo steps 4–6: one-click legit, blocked, overspend. `/demo/status` returns `txHash` or `reasonCode` for latest scenario. All 3 scenarios runnable in sequence from a fresh agent key if needed. |

---

## 7. Shared artifacts you own

- `packages/trace/` (schema + serializer + digest)
- `agents/{legit,blocked,overspend}.ts`
- `fixtures/{legit,blocked,overspend}.json`
- `services/demo-control/` (IF-10 server)
- `services/mock-x402/` (fallback merchant)
- `RUNTIME-README.md` (env vars, keys, run commands)

---

## 8. Risks & fallbacks

| Risk                                     | Fallback                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Trace serialization drifts between runs  | One canonical serializer, strict key ordering, explicit nulls. Test with 100 random traces.                                    |
| Third-party x402 service is flaky        | Local mock x402 merchant with same `payment-required` shape. Allowlist the mock merchant address in demo intent.              |
| 4337 bundler / UserOp stack unstable     | Send direct transactions through smart account owner or delegate path while preserving the same `ExecutionRequest` contract interface. |
| Dev 3's TraceAck signer not ready        | Run a local signer stub with a known pubkey; Dev 1 registers that pubkey in `GuardedExecutor`. Swap to Dev 3's signer once live. |

---

## 9. Do NOT do

- Do NOT change `DecisionTrace v1` after hour 12. Any schema drift invalidates `contextDigest`s and breaks Dev 1's guard + Dev 3's replay.
- Do NOT implement MCP adapter, DEX swap agent, or TEE attestation — stretch only.
- Do NOT run the blocked scenario via `executeWithGuard` — reverts emit no logs. Always `preflightCheck` + `/demo/status`.
- Do NOT hardcode addresses — read from `deployments/base-sepolia.json` (Dev 1's artifact).
