# IntentGuard Remaining Features — Agentic Implementation Prompt

## Goal

Implement the highest-value remaining features needed to move IntentGuard from a convincing demo into a stronger, judge-ready, integration-oriented product, while preserving the existing live Base Sepolia demo flow.

Supabase is already implemented enough for this sprint. Do not spend time redesigning storage around MongoDB Atlas. Build on the current Supabase-backed infra and auth model unless a tiny compatibility shim is required.

## Your Role

You are a senior staff-level engineer working inside the existing IntentGuard monorepo. You are responsible for designing, implementing, testing, and documenting the remaining product-critical features end to end. You should make code changes directly, keep the product demoable at all times, and avoid speculative rewrites.

You must preserve the existing deterministic security model:

- on-chain money movement and challenge outcomes remain authoritative
- Gemini is advisory unless explicitly gated by configuration
- no Gemini output may directly change slash outcomes
- existing live demo scenarios must continue to work

## Repo Reality You Must Respect

The current repo already has:

- real Base Sepolia contracts for intent commit, guarded execution, receipts, and amount-violation challenge/slash
- a live infra service for manifests, traces, feed, replay, challenge prep, and reviewer stub
- a live demo-control service that exposes three scenario endpoints
- a web app with onboarding, rules, approval, delegate authorization, feed, receipt, challenge CTA, and demo console
- Supabase-backed auth/storage paths already in progress or implemented

The current repo does **not** yet have:

- a live Gemini screening route in infra
- a live Gemini reviewer / receipt summary feature
- a real execution API that replaces demo-only scenario endpoints
- webhooks or SSE for receipts / blocked attempts / challenge updates
- a finished role-aware ops / reviewer / partner-facing product surface
- a real smart-account-based execution path for browser writes

Do not pretend these exist. Add them.

## Primary Deliverables

### 1. Gemini advisory screener

Implement a new infra route:

- `POST /v1/screen`

Input:

- `trace`
- `contextDigest`
- `owner`
- `agentId`
- `proposedAction`
- optional `intentConfig`

Output shape:

- `injectionScore: number` in `0..1`
- `severity: "low" | "medium" | "high" | "critical"`
- `signals: string[]`
- `explanation: string`
- `recommendedAction: "allow" | "review" | "block"`
- `model: string`
- `advisoryOnly: true`

Implementation rules:

- call Gemini server-side only
- use the official Google GenAI SDK and structured JSON output
- validate all Gemini responses with Zod before returning them
- return deterministic fallback behavior if Gemini is unavailable
- never block execution by default

Add an optional env-gated hard mode:

- `GEMINI_SCREEN_HARD_MODE=true`
- if enabled and score exceeds threshold, runtime may abort before execution
- hard mode must be opt-in and clearly logged

### 2. Gemini incident summaries

Implement advisory Gemini summaries for:

- receipt detail
- challenge detail
- reviewer view

Suggested routes:

- `GET /v1/receipts/:receiptId/summary`
- `GET /v1/challenges/:challengeId/summary`

Output shape:

- `headline`
- `summaryBullets: string[]`
- `riskAssessment`
- `whyItWasAllowedOrBlocked`
- `recommendedReviewerFocus: string[]`
- `advisoryOnly: true`
- `model`

Requirements:

- generate summaries from stored evidence only
- never mutate the receipt or challenge itself
- cache summaries in Supabase so repeated loads are fast and stable
- surface a clear disclaimer in the UI that Gemini is assistive only

### 3. Replace demo-only execution as the primary integration surface

Add a real runtime-facing execution API while preserving the demo endpoints.

Minimum new surfaces:

- `POST /v1/executions/preflight`
- `POST /v1/executions`
- `GET /v1/executions/:id`

The new execution path should:

- accept a caller-supplied trace and proposed action
- upload the trace through the existing infra path
- build an `ExecutionRequest`
- run preflight
- return a normalized result:
  - `allowed`
  - `blocked`
  - `executed`
  - `failed`

The scenario buttons may internally keep using the existing runtime helpers, but the product should now have a real API another team could integrate with.

### 4. Live updates

Add one lightweight push mechanism:

- either SSE
- or webhook delivery

Recommended:

- SSE first for the web app
- webhooks second if time allows

Minimum events:

- `receipt.created`
- `attempt.blocked`
- `challenge.filed`
- `challenge.resolved`
- `summary.ready`

Do not redesign the entire feed schema. Keep transport improvements thin.

### 5. Product UI upgrades

Update the frontend so it visibly tells the stronger story:

- add a Gemini advisory panel to the demo console for blocked and overspend scenarios
- add a Gemini summary card on receipt detail
- add a Gemini summary card on review / challenge detail
- expose the new real execution API in a partner-facing or operator-facing console page, even if basic
- keep current demo flow intact

The UI should make the architecture understandable:

- deterministic guardrails
- evidence capture
- Gemini explanation
- recourse

### 6. Role-aware product framing

Use the existing Supabase-auth setup and add enough role-awareness for product credibility.

Minimum roles:

- owner
- challenger
- reviewer
- partner_admin

Minimum behavior:

- reviewer-only actions are gated
- owner-only views are scoped to owner-linked wallets or project membership
- public demo pages do not expose privileged reviewer operations

Do not overbuild enterprise RBAC. Keep it narrow and demonstrable.

## Explicit Non-Goals For This Sprint

Do not spend this sprint on:

- replacing Supabase with MongoDB
- fully migrating browser writes to ERC-4337 smart accounts
- rebuilding the whole app around paymasters
- adding new on-chain challenge types
- making Gemini authoritative for payment decisions
- inventing a new evidence schema that breaks the current trace / receipt model

## Product Constraints

- Base Sepolia remains the active network
- USDC remains the payment asset
- existing demo scenarios must remain runnable
- no breaking changes to current successful demo path
- keep the contracts and challenge math authoritative
- preserve current feed, receipt, and challenge behavior unless improving clarity

## Implementation Guidance

### Gemini integration guidance

- use the official `@google/genai` JavaScript SDK
- use structured JSON output, not free-form prose parsing
- centralize the Gemini client behind a small infra service module
- wrap every model response in schema validation + fallback handling
- log prompt version, model name, and latency
- redact secrets and never send unnecessary wallet secrets or private keys to Gemini

### Suggested Gemini prompts

For screening:

- classify whether a trace suggests prompt injection, social engineering, urgency manipulation, authority spoofing, amount inflation, counterparty substitution, or tool-output mismatch
- score risk conservatively
- explain what textual or behavioral signals caused the score
- recommend `allow`, `review`, or `block`

For summaries:

- summarize the evidence in plain English for judges, reviewers, and risk teams
- explain why the deterministic system allowed or blocked the action
- explain what recourse is available
- never make policy decisions

### Suggested architecture additions

- `services/infra/src/gemini/client.ts`
- `services/infra/src/gemini/schemas.ts`
- `services/infra/src/gemini/screen.ts`
- `services/infra/src/gemini/summarize.ts`
- `services/infra/src/api/screen.ts`
- cached summary / screening tables or documents in the current Supabase model
- frontend panels under existing receipt / review / demo surfaces

## Acceptance Criteria

### Gemini screener

- `POST /v1/screen` exists and returns validated structured output
- blocked and overspend demo traces produce meaningfully different scores
- failures degrade gracefully

### Gemini summaries

- receipt and challenge pages can render an advisory summary
- summary generation does not alter existing on-chain flows
- summaries are cached and reload cleanly

### Real execution API

- a caller can submit a preflight and execution request without using `/demo/run-*`
- results are normalized and documented
- demo scenarios still function

### Live updates

- the dashboard updates without manual refresh for at least one event type

### Product clarity

- the UI clearly distinguishes:
  - deterministic enforcement
  - advisory AI analysis
  - evidence
  - recourse

## Testing Requirements

Add tests for:

- Gemini response schema validation
- graceful fallback when Gemini is unavailable
- `POST /v1/screen`
- summary endpoints
- execution API happy path
- execution API blocked path
- role-gated reviewer actions
- SSE or webhook event emission

If network-dependent Gemini tests are fragile, isolate them behind integration-test flags and keep deterministic unit tests for schema / transport behavior.

## Documentation Requirements

Update docs so another engineer can run and demo the system:

- env vars for Gemini
- how to enable advisory vs hard mode
- how to call the new execution API
- how to explain Gemini’s role to judges
- what remains deterministic and on-chain

## Prioritization Order

Implement in this order unless blocked:

1. Gemini infra client + schemas
2. `/v1/screen`
3. receipt / challenge summary endpoints
4. frontend advisory panels
5. real execution API
6. SSE or webhooks
7. role-aware polish and docs

## Final Output Expectations

When finished, provide:

- a concise summary of what changed
- what is now demoable
- what is still intentionally deferred
- exact env vars required
- exact URLs / UI pages to show judges

Your job is not to perfect the architecture in theory. Your job is to produce the strongest credible version of IntentGuard that:

- still works live
- is easier to understand
- is more integration-ready
- clearly qualifies for the Gemini prize track
