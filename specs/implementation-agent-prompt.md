# IntentGuard Remaining Work — Implementation Prompt

## Objective

Implement the **missing product features only**. Do not rebuild what already exists.

Build on top of the current live Base Sepolia demo, current contracts, current web app, and current Supabase-backed infra.

## Existing systems you must preserve

These already exist and should be reused:

- intent commit flow
- delegate authorization flow
- owner USDC approval flow
- live guarded execution
- receipt storage and challenge/slash flow
- trace upload and `TraceAck`
- feed, receipt, replay, and challenge-prep APIs
- Supabase auth and storage already present in infra
- current demo scenario flow

Do **not** rewrite these unless a small compatibility change is required.

## What to build

### Priority 1. Gemini screening API

Add a new infra endpoint:

- `POST /v1/screen`

Purpose:

- score a trace for prompt injection or manipulation risk
- return advisory structured output

Output:

- `injectionScore`
- `severity`
- `signals`
- `explanation`
- `recommendedAction`
- `model`
- `advisoryOnly`

Rules:

- Gemini runs server-side only
- use structured JSON output
- validate responses with Zod
- if Gemini fails, return a safe fallback
- do not block execution by default

Optional:

- add `GEMINI_SCREEN_HARD_MODE=true` as an opt-in runtime gate

### Priority 2. Gemini summaries

Add advisory summary endpoints for stored evidence:

- `GET /v1/receipts/:receiptId/summary`
- `GET /v1/challenges/:challengeId/summary`

Purpose:

- produce short human-readable summaries from trace + receipt + challenge evidence

Rules:

- cache results in the existing Supabase model
- summaries are advisory only
- summaries never affect on-chain outcomes

### Priority 3. Real execution API

Keep the demo scenario endpoints, but add a real integration surface:

- `POST /v1/executions/preflight`
- `POST /v1/executions`
- `GET /v1/executions/:id`

Purpose:

- let a caller submit a trace-backed action without using `/demo/run-*`

Rules:

- reuse existing runtime and trace code where possible
- normalize responses into `allowed`, `blocked`, `executed`, or `failed`

### Priority 4. Live updates

Add lightweight live delivery for important events.

Recommended:

- SSE first

Events:

- `receipt.created`
- `attempt.blocked`
- `challenge.filed`
- `challenge.resolved`
- `summary.ready`

### Priority 5. UI surfaces

Update the frontend to show the new features clearly:

- advisory Gemini panel in the demo flow
- Gemini summary card on receipt detail
- Gemini summary card on review/challenge detail
- simple partner/runtime console for the real execution API

### Priority 6. Role-aware polish

Use the existing auth model and add narrow role-aware gates for:

- owner
- challenger
- reviewer
- partner_admin

Keep this simple. Do not build a full enterprise permissions system.

## Non-goals

Do not spend time on:

- replacing Supabase
- rebuilding the wallet flow
- migrating the whole product to ERC-4337 this sprint
- paymaster integration as part of this task
- new on-chain challenge types
- making Gemini authoritative

## Technical guidance

- use the official Google GenAI SDK
- keep Gemini behind a small infra module
- use Zod-validated response schemas
- log model, prompt version, and latency
- never send secrets or private keys to Gemini

Suggested new modules:

- `services/infra/src/gemini/client.ts`
- `services/infra/src/gemini/schemas.ts`
- `services/infra/src/gemini/screen.ts`
- `services/infra/src/gemini/summarize.ts`
- `services/infra/src/api/screen.ts`

## Acceptance criteria

### Gemini screen

- `POST /v1/screen` works
- blocked and overspend traces score differently
- failures degrade gracefully

### Gemini summaries

- receipt and challenge summaries render in the UI
- cached summaries reload correctly

### Real execution API

- callers can use an execution path without `/demo/run-*`
- existing demo scenario flow still works

### Live updates

- the UI updates live for at least one real event class

### Product clarity

- the UI clearly labels:
  - deterministic decision
  - Gemini advisory analysis
  - evidence
  - recourse

## Delivery order

Implement in this order:

1. Gemini infra client and schemas
2. `/v1/screen`
3. receipt/challenge summary endpoints
4. frontend advisory panels
5. real execution API
6. SSE live updates
7. role-aware polish
8. docs and tests

## Final note

This work should make IntentGuard feel like a stronger product **without replacing the working core**.

The target is:

- keep the live deterministic system
- add Gemini as an advisory intelligence layer
- add a real integration surface
- make the UI explain the product clearly
