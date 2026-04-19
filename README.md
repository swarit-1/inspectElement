# IntentGuard

**Programmable guardrails for autonomous agents — enforced onchain, audited in seconds, challengeable by anyone.**

IntentGuard is a trust layer for the agentic economy. A user commits a signed **intent** (what an agent can spend, where, and for how long), delegates execution to an agent operator, and every action passes through a guarded path that verifies policy, emits a receipt, and exposes a clean appeal when things go wrong.

Built on **Base Sepolia**, settled in **USDC**.

---

## Why this exists

Autonomous agents that move money need more than vibes and a good system prompt. They need:

- **Expressive, user-owned policy** — per-tx caps, per-day caps, counterparty allowlists, expiries.
- **Verifiable execution** — every onchain action is bound to a signed decision trace you can replay later.
- **Economic skin in the game** — operators stake, overspend gets slashed, anyone can challenge.
- **A paper trail** — receipts and traces that an auditor can reconstruct deterministically.

The result is a system where the agent can move fast, the user can sleep well, and the auditor can answer "what happened and why" without guessing.

---

## Quick start

```bash
npm install
npm run compile
npm run deploy:base-sepolia
npm run bootstrap
npm run demo
cd apps/web && npm run dev
```

Dashboard boots at `http://localhost:3000`. From there: connect a wallet, commit an intent, delegate an agent, and run the demo scenarios.

---

## Status

Hackathon MVP. Interfaces are frozen, the demo is reproducible, and the happy path — commit an intent, stake an agent, run a scenario, file a challenge, watch USDC move — works end to end. Everything past that is roadmap.
