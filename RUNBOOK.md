# IntentGuard — Demo runbook

This is the operator checklist for a **fresh browser session** on **Base Sepolia (84532)**. Total target time: under five minutes once infra, contracts, and agents are running.

## 0. Prereqs

- **Contracts:** `deployments/base-sepolia.json` filled by Dev 1 (addresses + constants). The web app now reads this repo-root manifest directly; `NEXT_PUBLIC_*` contract overrides still win when set.
- **Infra (Dev 3):** trace signing + indexer + REST API (default `http://localhost:8787`). Set `NEXT_PUBLIC_INFRA_API_URL` if different.
- **Demo control (Dev 2):** `npm run demo` from the repo root (default `http://localhost:7402`). Set `NEXT_PUBLIC_RUNTIME_API_URL` if different.
- **Agent env:** operator key, RPC, trace URL — see `agents/shared.ts` and project `.env` examples.
- **Web:** `cd apps/web && npm run dev`. Set `NEXT_PUBLIC_USE_MOCKS=false` for live APIs.

## 1. Start services (terminal order)

1. Infra API + indexer (per Dev 3 ops README).
2. `npm run demo` — demo-control for IF-10.
3. `cd apps/web && npm run dev` — dashboard.

## 2. Dashboard flow (happy path)

1. Open the app root URL → **Connect wallet** (injected/MetaMask on Base Sepolia).
2. **Deploy / Guard** — use the onboarding card until it shows GuardedExecutor **deployed** (or your team’s pre-deployed smart account path).
3. **Intent** — confirm demo caps (10 / 50 USDC), edit allowlist + expiry if needed → **Sign & Commit** (IF-01 pin + IF-02 `commitIntent`).
4. **Delegate** — paste `agentId` and delegate address from `npm run bootstrap` / `scripts/reset.ts` output → **Approve Delegate** (`setAgentDelegate`).
5. **Demo panel** (`/demo`) — run **Legit** → then **Blocked** → then **Overspend** (IF-10). Confirm feed updates (IF-09) and blocked reason where applicable.
6. **Overspend receipt** — open receipt detail → **File AmountViolation** (IF-07 prep + USDC approve + tx). Optionally pre-approve the bond earlier to save a step live.
7. Confirm **challenge** row appears and resolves **UPHELD** with payout visible (IF-09 + on-chain).

## 3. Reviewer stub (`/review`)

- Lists **challenge** rows from the feed for the connected owner.
- **Uphold / Reject** calls `POST /v1/reviewer/resolve` (non-authoritative for the MVP deterministic slash).

## 4. Reset / reseed

- From repo root: `npx tsx scripts/reset.ts` (prints fresh `agentId` / delegate hints and counterparties).
- From app package: `npx tsx apps/web/scripts/reset.ts` (lighter client-oriented output).

## 5. Troubleshooting

| Symptom | Check |
|--------|--------|
| Feed empty | Infra indexer running; owner address matches connected wallet; `NEXT_PUBLIC_USE_MOCKS=false`. |
| Demo buttons hang | Demo-control port (`7402`) matches `NEXT_PUBLIC_RUNTIME_API_URL`. |
| Challenge prep fails | `deployments` loaded on infra; manifest indexed for intent hash. |
| `next build` config error | Use `next.config.mjs` (not `.ts`) for this toolchain. |

## 6. Env quick reference

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_USE_MOCKS` | `false` for live IF-01/07/09/10 (default in dev is mocks unless set). |
| `NEXT_PUBLIC_INFRA_API_URL` | Dev 3 API base. |
| `NEXT_PUBLIC_RUNTIME_API_URL` | Dev 2 demo-control (default `http://localhost:7402`). |
| `NEXT_PUBLIC_DEFAULT_AGENT_ID` / `NEXT_PUBLIC_DEFAULT_DELEGATE` | Prefill delegation form. |
| `NEXT_PUBLIC_*_ADDRESS` | Optional overrides for each contract. |
