# Dev 4 — Full-Stack / Product Engineer (Frontend, Demo Orchestration, Onboarding)

> Owns the user-facing dashboard that drives the live demo: wallet onboarding, intent builder, typed-data signing, intent commit, agent delegation, activity feed, blocked-attempt display, challenge filing, challenge status, reviewer route, and the runbook. **You consume everyone else's interfaces — mock them all until hour 12, then wire live one service at a time.**

---

## 1. Scope

### In scope
- Next.js + wagmi + viem + Tailwind (or similar modern stack — freeze by hour 2).
- Wallet onboarding: Privy by default; Coinbase Embedded only if already configured by hour 2.
- Smart account deployment/install screen showing whether `GuardedExecutor` is active for the user.
- Intent builder UI prefilled with demo constants (see §2).
- Manifest sign + pin + `commitIntent` flow.
- Agent delegation UI calling `setAgentDelegate`.
- Activity feed: legit receipt, blocked attempt, overspend receipt, challenge resolution.
- Challenge CTA: ask infra for calldata → USDC approve → send `fileAmountViolation`.
- Separate challenge status/detail view.
- Demo control panel wired to Dev 2's IF-10 (one button per scenario).
- `/review` route for Dev 3's reviewer stub.
- Demo-day runbook + reset/reseed script.

### Out of scope
- Contract logic (Dev 1).
- Trace storage internals, indexer, TraceAck signing (Dev 3).
- LLM prompts, x402, agent orchestration (Dev 2).

---

## 2. Demo constants (prefilled, frozen)

| Field                       | Value                                                 |
| --------------------------- | ----------------------------------------------------- |
| Chain                       | Base Sepolia (84532)                                  |
| Token                       | USDC (from `deployments/base-sepolia.json`)           |
| Intent per-tx cap           | 10 USDC                                               |
| Intent per-day cap          | 50 USDC                                               |
| Allowlisted counterparties  | 3 addresses (from env / Dev 2's merchant + fixtures)  |
| Expiry                      | `now + 7 days`                                        |
| Nonce                       | fresh each intent                                     |
| Agent stake (display only)  | 50 USDC                                               |
| Challenge bond              | 1 USDC                                                |

---

## 3. Deliverables

### 3.1 Wallet onboarding
- Privy integration → embedded EOA for the user.
- Install/deploy smart account on Base Sepolia with `GuardedExecutor` as its executor module.
- UI state: "not deployed" → "deploying" → "deployed, guard active".
- **Fallback:** if Privy+4337 setup burns too many hours, wire a pre-funded demo EOA + minimal smart account using Dev 1's simple smart account fork.

### 3.2 Intent builder
- Form prefilled with demo constants; editable fields: counterparty addresses, expiry.
- "Preview" panel showing canonical manifest JSON.
- "Sign & Commit" flow:
  1. POST canonical manifest to Dev 3's `/v1/manifests` (IF-01) → `{ manifestURI, intentHash }`.
  2. Call `IntentRegistry.commitIntent(intentHash, cfg, manifestURI)` via wagmi `writeContract`.
  3. Wait for receipt; show success + intentHash.
- **Canonicalization note:** the JSON you POST to Dev 3 must be *the same bytes* Dev 3 hashes to produce `intentHash`. Align serializer with Dev 3 by hour 8. Default: Dev 3 canonicalizes server-side and returns `intentHash`; you just POST the form data.

### 3.3 Agent delegation
- Dropdown / input for `agentId` (default = value printed by Dev 2's bootstrap).
- Input for delegate address (default = value printed by Dev 2's bootstrap).
- Call `GuardedExecutor.setAgentDelegate(agentId, delegate, true)`.

### 3.4 Activity feed
- Poll `GET /v1/feed?owner=<user>` every 3s (Dev 3).
- Render rows for:
  - legit receipt → "✓ 2 USDC → merchant (abc…)"
  - blocked attempt → "🛑 20 USDC to attacker (abc…) blocked — COUNTERPARTY_NOT_ALLOWED"
  - overspend receipt → "⚠ 15 USDC → merchant (abc…) — exceeds 10 USDC cap — [File challenge]"
  - challenge resolution → "✓ Challenge UPHELD — 15 USDC returned"
- Detail pane opens `/receipt/:id` via `GET /v1/receipts/:id` (shows `contextDigest`, `traceURI`, linkout).

### 3.5 Challenge flow
On overspend receipt, "File AmountViolation" button:
1. `POST /v1/challenges/prepare-amount` with `{ receiptId, challenger }`.
2. If `!eligible` → show reason, disable.
3. `USDC.approve(ChallengeArbiter, bondAmount)` if allowance < bond (wagmi `writeContract`).
4. `ChallengeArbiter.fileAmountViolation(receiptId)` (wagmi; use returned `to`/`data` from IF-07 if available).
5. Poll `GET /v1/challenges/:challengeId` until status = `UPHELD`.
6. Show payout success banner.

**Two-tx approval is fragile live.** Pre-approve the challenge bond during onboarding (approve max, or approve `bondAmount` right after intent commit) as the default. Fallback: Dev 3's watchdog relay — coordinate by hour 20.

### 3.6 Demo control panel
Route: `/demo`. Three big buttons:
- "Run legit payment" → `POST /demo/run-legit` → poll `/demo/status`.
- "Run blocked attack" → `POST /demo/run-blocked` → poll `/demo/status`.
- "Run overspend attack" → `POST /demo/run-overspend` → poll `/demo/status`.

Each button shows spinner → result card (txHash or reasonCode) pulled from `/demo/status`.

### 3.7 `/review` route
Minimal page:
- List of filed challenges from `GET /v1/feed?type=challenge`.
- "Uphold" / "Reject" buttons call Dev 3's reviewer endpoint (not live in demo; keep the UI clickable).

### 3.8 Runbook + reset
- `RUNBOOK.md`: one page, step-by-step for demo day.
- `scripts/reset.ts`: clears local caches, creates fresh agent delegate, prints fresh `agentId`, reseeds the intent with current demo addresses.

---

## 4. Interface contracts (all **consumed**)

| ID    | Source | Surface |
| ----- | ------ | ------- |
| IF-01 | Dev 3  | `POST /v1/manifests` |
| IF-02 | Dev 1  | `commitIntent`, `revokeIntent`, `setAgentDelegate` |
| IF-07 | Dev 3  | `POST /v1/challenges/prepare-amount` |
| IF-08 | Dev 1  | `fileAmountViolation(bytes32 receiptId)` |
| IF-09 | Dev 3  | `GET /v1/feed`, `GET /v1/receipts/:id`, `GET /v1/challenges/:id` |
| IF-10 | Dev 2  | `/demo/run-legit`, `/demo/run-blocked`, `/demo/run-overspend`, `/demo/status` |

---

## 5. Dependencies on other devs

### Inbound (you are blocked on)
- **Dev 1:** ABIs + `deployments/base-sepolia.json` (hour 12). Until then, mock contract calls locally.
- **Dev 3:** `/v1/manifests`, `/v1/feed`, `/v1/challenges/prepare-amount` (hour 24). Until then, mock with fixtures.
- **Dev 2:** `/demo/*` (hour 24). Until then, buttons fire local mocks with canned status.

### Outbound (others blocked on you)
- Nobody is blocked on you. This is a pure consumer.

### Cross-cutting
- **Manifest canonicalization:** default to Dev 3 canonicalizing server-side; you POST form data, receive `intentHash`. Do NOT compute `intentHash` client-side unless Dev 3 specifically publishes the canonical-JSON rule and an npm helper.
- **Blocked feed entries:** default — Dev 3 merges blocked entries server-side from Dev 2's `/demo/status`. If Dev 3 can't, you merge client-side: keep a local "recent blocked" list populated from `/demo/status` and splice into the feed view.

---

## 6. Milestones

| Hour  | Exit criteria                                                                                                                                                         |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–4   | Stack bootstrapped (Next.js, wagmi, Privy). Screens scaffolded with mocked data: onboarding, intent builder, feed, demo panel.                                       |
| 4–12  | Wallet onboarding works against a test EOA. Intent builder form validation works. Feed renders against fixture data. Typed-data preview works.                        |
| 12–28 | User can commit a live intent on Base Sepolia. User can delegate the agent key. Feed reads live data from Dev 3. Demo panel calls Dev 2's `/demo/*`.                |
| 28–40 | **Full demo 1–7 runs from a fresh browser session** in under 5 minutes. Runbook short enough that any teammate can drive it. Pre-approval of challenge bond works. |

---

## 7. Shared artifacts you own

- `apps/web/**` (Next.js app)
- `apps/web/src/abi/` — **read-only copy** of Dev 1's ABIs (do NOT edit originals).
- `scripts/reset.ts`
- `RUNBOOK.md`

---

## 8. Risks & fallbacks

| Risk                                  | Fallback                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Embedded wallet SDK setup is slow     | Default to Privy; if blocked, use a pre-funded demo wallet with the same UI flow. Pre-deploy the user's smart account.   |
| Too many clicks in the live demo      | Demo control panel with one button per scenario and a fixed sequence. Runbook lists every click.                         |
| Two-tx challenge flow confuses users  | Pre-approve the challenge bond during onboarding. Fallback: Dev 3's watchdog relay behind the same button.               |
| Dev 3's APIs not ready                | Keep a feature flag `NEXT_PUBLIC_USE_MOCKS=true`; serve all IF-01/07/09 from local fixtures until live.                  |
| Dev 2's `/demo/*` not ready           | Demo panel buttons dispatch to a local mock that returns canned status with realistic timings.                           |

---

## 9. Do NOT do

- Do NOT implement `YELLOW` approval flow (stretch only).
- Do NOT implement push notifications, mobile, trace diff viewer (stretch only).
- Do NOT parse trace JSON client-side beyond surfacing `contextDigest` and `traceURI`.
- Do NOT hardcode contract addresses — read from `deployments/base-sepolia.json`.
- Do NOT build an admin/analytics dashboard — demo flow only.
- Do NOT add new API routes that Dev 3 doesn't already expose. If you need one, ask.
