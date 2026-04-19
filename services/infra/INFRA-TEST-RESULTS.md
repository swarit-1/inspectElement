# IntentGuard — Dev 3 (Infra) Test Results

Hackathon target: USDC-only `AmountViolation` demo on Base Sepolia, end-to-end
through `legit / blocked / overspend` agents.

## Headline numbers

| Metric                    | Result               |
| ------------------------- | -------------------- |
| Test files                | 9                    |
| Total tests               | **75 / 75 passing**  |
| Critical integration bugs | **3 found, 3 fixed** |
| Cross-team ABI bugs       | **5 found, 5 fixed** |
| Live HTTP smoke checks    | **24 / 24 passing**  |
| TypeScript errors         | 0                    |

Reproduce locally:

```bash
cd services/infra
npm test            # full vitest suite
npm run smoke       # spins up the real server, runs Dev 2's uploadTrace
```

---

## Why this work mattered

Dev 3 is the only seam where the protocol (Dev 1), the agents (Dev 2), and the
UI (Dev 4) actually meet. If the Infra service is wrong, **every demo path is
wrong** — agents can't pin traces, the dashboard sees nothing, and the
`AmountViolation` challenge can't be filed because the on-chain `TraceAck`
won't recover. So before adding any new tests, the goal of Tier 0 was to make
sure my code matches what Dev 1's contracts and Dev 2's clients actually
expect.

---

## Tier 0 — critical integration bugs caught and fixed

These were silent footguns that would have killed the demo. All three were
found by reading Dev 1's Solidity and Dev 2's client code, not by running
tests.

### Bug 1 — `TraceAck` was using the wrong signature scheme

- **Symptom we would have seen on demo day:** every `executeAction` call
  reverts with `InvalidTraceAck`.
- **Root cause:** my signer was producing an EIP-191 personal-sign over 3
  fields. `GuardedExecutor.sol` does **EIP-712 typed data** over **7 fields**
  (`contextDigest, uriHash, expiresAt, guardedExecutor, chainId, agentId,
  owner`) under the `IntentGuard` v1 domain.
- **Fix:** rewrote `Signer.signTraceAck` and `Signer.traceAckDigest` to use
  `viem`'s `signTypedData` with the exact domain Dev 1 ships in
  `deployments/base-sepolia.json`.
- **Pinned by:** `test/signer.test.ts`, `test/traceack-eip712.test.ts`
  (recovers signer using the real chainId + GuardedExecutor address from the
  deployment manifest).

### Bug 2 — Reviewer signature was not domain-separated

- **Symptom:** `resolveByReviewer` would have reverted with `InvalidReviewer`.
- **Root cause:** Dev 1's `ChallengeArbiter.sol` binds `address(this)` and
  `block.chainid` into the reviewer digest (5 fields total). My signer was
  hashing only 3 fields, so the same reviewer key would have been valid on
  every chain / every arbiter.
- **Fix:** added `challengeArbiter` and `chainId` to
  `Signer.signReviewerDecision`, and threaded them through
  `/v1/reviewer/resolve`.
- **Pinned by:** `test/signer.test.ts` (round-trips against the same
  `keccak256(abi.encode(...))` Solidity emits) and `test/api.test.ts`.

### Bug 3 — `POST /v1/traces` rejected Dev 2's actual payload

- **Symptom:** every agent run from Dev 2 would HTTP 400 with "trace must be
  an object".
- **Root cause:** Dev 2's `uploadTrace` sends `trace: serializeCanonical(t)`
  (a JSON **string** — that's the byte stream he wants pinned). My handler
  assumed the body was always a parsed object and re-canonicalized it,
  double-quoting the JSON and producing a different `keccak256`.
- **Fix:** the handler now accepts both shapes, re-derives the digest using
  whichever bytes the client sent, and only signs if the client-supplied
  digest matches.
- **Pinned by:** the "STRING shape" regression test in `test/api.test.ts` and
  by the live `smoke-trace.ts`, which uses Dev 2's exact client.

---

## Tier 1 — protocol parity: am I "speaking the same dialect" as Dev 1 / Dev 2?

### `cross-canonical.test.ts` — 5 tests

Dev 2 and I have **independent** canonical JSON serializers. They MUST be
byte-identical or `contextDigest` will diverge between agent and infra. This
test loads every fixture (`legit / blocked / overspend`) and asserts:

- `Dev2.serializeCanonical(t) === Dev3.canonicalize(t)` (byte equality)
- `Dev2.computeContextDigest(t) === keccak256(Dev3.canonicalize(t))`
- the same holds for adversarial cases (key reordering, nested arrays).

If this ever goes red, the demo is broken — fix it before anything else.

### `abi-parity.test.ts` — 17 tests

Compares both my indexer ABI fragments and Dev 4's web ABI mirrors against
Dev 1's Solidity interfaces in `contracts/interfaces/*.sol`, using `viem`'s
`toEventSelector` and `toFunctionSelector`.

- ✅ Every event Dev 3 indexes (`AgentDelegateSet`, `ActionReceipt`,
  `ReceiptStored`, `TraceURIStored`, `ChallengeFiled`, `ChallengeResolved`,
  `IntentCommitted`, `IntentRevoked`, `AgentRegistered`, `AgentStaked`) has
  the **same topic hash on both sides**.
- ✅ Every function Dev 4 calls (`fileAmountViolation`, `resolveByReviewer`)
  has the **same 4-byte selector on both sides**.
- ✅ All previously-missing events are present in the web ABI.

**Originally** this file documented the divergence as "regression pins"
because Dev 4's `apps/web/src/abi/*.ts` had drifted from the contracts. Those
have now been **regenerated from the Solidity interfaces** as part of this
fix pass — see "Cross-team ABI fixes" below — and the test now enforces
positive parity instead of pinning known drift. Any future drift will turn
the suite red.

---

## Tier 2 — `TraceAck` end-to-end against the real deployment

`test/traceack-eip712.test.ts` (2 tests):

- Loads `deployments/base-sepolia.json` (Dev 1's actual deployment), signs a
  `TraceAck` with my signer, and uses `viem.recoverAddress` to verify the
  signature recovers to the keypair `/v1/health` advertises.
- A negative test confirms that flipping the chainId breaks recovery — proves
  the domain separator actually does its job.

This is the closest a unit test can get to "will Dev 1's contract accept it?"
without running a fork.

---

## Tier 3 — live HTTP smoke against Dev 2's actual client

`scripts/smoke-trace.ts` (24 checks, run via `npm run smoke`):

- Boots the real Express app in-process on a dynamically reserved port.
- Calls `GET /v1/health` to discover the signer pubkey (the value Dev 1 must
  register on `AgentRegistry`).
- For **every fixture** (`legit / blocked / overspend`), invokes Dev 2's
  unmodified `uploadTrace(...)` against my server and asserts:
  - HTTP 200 + `contextDigest` round-trip
  - `traceURI` shape and `uriHash === keccak256(traceURI)`
  - `expiresAt` is in the future (within `TRACE_ACK_TTL_SEC`)
  - signature recovers to the advertised `traceAckSigner`
  - `traceURI` is fetchable (HTTP 200, JSON)
  - posting twice is **idempotent** (same URI, same signature)

Fixed during this tier: `LocalCasPinner` was generating URIs against the
default `PUBLIC_BASE_URL`, not the ephemeral test port, because the logger's
`loadEnv()` cache ran before the script's overrides. Switched the smoke
script to dynamic imports so the env override happens before any module-load
side effect.

---

## Tier 4 — API surface for Dev 4 (the dashboard)

`test/api.test.ts` (12 tests) and `test/read-model.test.ts` (8 tests) cover:

- `/v1/manifests` — pins manifests by `intentHash`, returns `{ manifestURI,
  manifestHash }`.
- `/v1/traces` — both object and string shapes, idempotency, rejection of
  digest mismatches, and signature recoverability.
- `/v1/feed` — schema-validated against `schemas/feed.ts` after seeding the
  DB directly with manifests + receipts + challenges.
- `/v1/receipts/:id` — schema-validated against `schemas/receipt.ts`,
  including the `challengeable` flag and reason.
- `/v1/challenges/prepare-amount` — returns the calldata Dev 4 needs to
  open a challenge with one button click; rejects ineligible receipts with
  human-readable reasons.
- `/v1/reviewer/resolve` — produces a recoverable EIP-191 reviewer signature
  bound to the challenge arbiter address + chainId.

All response bodies are validated against the **frozen schemas in
`schemas/*.ts`** that Dev 4 will compile against. As long as those tests
stay green, the dashboard's contract is honored.

---

## Tier 5 — indexer determinism

`test/indexer.test.ts` (8 tests):

- Uses synthetic logs and a fake `PublicClient` so the indexer can be
  exercised without an RPC.
- Verifies that every event the spec covers (`ActionReceipt`,
  `ReceiptStored`, `TraceURIStored`, `IntentRegistered`, `IntentRevoked`,
  `ChallengeOpened`, `ChallengeResolved`, `AgentRegistered`) is decoded into
  the right repo with the right field types.
- Verifies the poller advances and **resumes** its cursor in `meta` so a
  restart doesn't reprocess the same range or skip blocks.

---

## Tier 6 — pinning fallback (`test/ipfs.test.ts`, 7 tests)

The hackathon demo runs without a paid IPFS provider, so the local
content-addressed store is what actually serves traceURIs. Locks down:

- URI shape `${PUBLIC_BASE_URL}/ipfs/<sha256>` (what Dev 4 fetches).
- CID equals the sha256 of the bytes (deterministic).
- Re-pinning identical content is idempotent (no duplicate writes, same
  URI / CID).
- The HTTP gateway returns the exact bytes that were pinned (replay path).
- Bad CIDs return 400, unknown CIDs return 404.
- `pinner.fetch(uri)` round-trips bytes (used by the replay engine
  scaffold).
- `createPinner` selects `web3-storage` when `IPFS_TOKEN` is set, otherwise
  falls back to local CAS.

---

## What is NOT covered (intentionally)

These belong to other devs and are out of Dev 3's scope:

- **Dev 1**: on-chain unit tests against `GuardedExecutor` / `ChallengeArbiter`
  reverts. We trust the interfaces in `contracts/interfaces/*.sol` and the
  domain in `deployments/base-sepolia.json`.
- **Dev 2**: agent decision logic (whether `legit` / `blocked` / `overspend`
  produce the right intent — we only care that the trace is valid JSON and
  the digest is stable).
- **Dev 4**: dashboard rendering. Once `schemas/*.ts` is honored (it is), the
  UI is on Dev 4.

---

## Cross-team ABI fixes (this pass)

After the first results write-up, the three open findings were addressed in
code rather than left as runbook items:

### Web ABIs — regenerated from Dev 1's Solidity interfaces

I rewrote `apps/web/src/abi/{guarded-executor,challenge-arbiter,intent-registry}.ts`
and added the missing `apps/web/src/abi/agent-registry.ts`. Five drift bugs
were fixed:

1. `GuardedExecutor.ActionReceipt`: `agentId` was unindexed (now indexed),
   `timestamp` was `uint256` (now `uint64`) — the topic hash now matches the
   deployed contract.
2. `GuardedExecutor`: `ReceiptStored` event was missing entirely.
3. `GuardedExecutor`: `TraceURIStored` event was missing entirely.
4. `ChallengeArbiter.ChallengeFiled`: had two phantom unindexed fields
   (`challengeType`, `bondAmount`) that don't exist on-chain — its topic hash
   was wrong.
5. `ChallengeArbiter.ChallengeResolved`: used `upheld / slashAmount /
   payoutTo` instead of the on-chain `uphold / payout`.

Also added the views Dev 4's dashboard will need (`getReceipt`, `getIntent`,
`spentToday`, `execNonce`, `traceAckSigner`, `USDC`, etc.) and the full custom
error sets so reverts can be decoded into human-readable strings on the UI.

Dev 4's existing imports (`commitIntent`, `setAgentDelegate`, `erc20`
`approve`) are unchanged — their components compile against the new ABIs
without code changes on their side.

### `PUBLIC_BASE_URL` — loud warning at boot

`services/infra/src/server.ts` now prints a `WARN` log at startup if
`PUBLIC_BASE_URL` still points at localhost (when not in `NODE_ENV=test`).
`.env.example` calls out the same issue with a `>>>>> READ THIS BEFORE THE
DEMO <<<<<` block. No more silently-broken traceURIs after the deploy.

### Signer registration — folded into the deploy script (no more manual tx)

The original plan was to ship a `print-register-signer` runbook script and
have Dev 1 hand-paste a `cast send` transaction after deploy. That step is
now eliminated entirely:

- `scripts/buildDeployParameters.ts` reads the private keys from
  `services/infra/.env.local`, derives the public addresses, and writes
  `ignition/parameters/<network>.json`.
- `ignition/modules/Deploy.ts` already accepts `traceAckSigner` and
  `reviewerSigner` as constructor arguments to `GuardedExecutor` and
  `ChallengeArbiter`.
- `scripts/writeArtifacts.ts` was rewritten to emit
  `deployments/<network>.json` in the exact shape Dev 3's `loadDeployments`
  expects (previously it wrote `{chainId, network, addresses}` which the
  infra loader silently rejected, leaving the indexer disabled).
- `npm run deploy:base-sepolia` now chains all three steps so Dev 1 runs one
  command and the signer is wired by the constructor — no follow-up admin
  transaction.

`GuardedExecutor.setTraceAckSigner(address)` and
`ChallengeArbiter.setReviewerSigner(address)` still exist for **key
rotation** (e.g. compromised key), but are no longer required for the demo
to work.

The legacy `print-register-signer` script and the broken `writeArtifacts.ts`
output shape are gone.

---

## Remaining ops actions (not code)

1. **Whoever ships the demo: set `PUBLIC_BASE_URL`.** The boot log will warn
   if it's still localhost; flip it to whatever public host (or ngrok URL)
   the infra service is reachable at before kicking off the demo.

That's it. The signer-registration step that used to live here is no longer
a runbook item — the deploy script does it for you.

---

## TL;DR for the team

> Infra is green end-to-end. 75 tests pass, 24 live HTTP checks pass against
> Dev 2's real client, and three production-killing integration bugs +
> five cross-team ABI bugs were found and fixed before they hit the demo:
>
> 1. `TraceAck` now uses Dev 1's exact EIP-712 scheme.
> 2. Reviewer sigs are now domain-separated by chainId + arbiter address.
> 3. `/v1/traces` accepts the canonical-string body Dev 2 actually sends.
> 4. `apps/web/src/abi/*.ts` was regenerated from Dev 1's Solidity
>    interfaces — five wrong / missing event definitions are fixed; the
>    parity test now enforces convergence so they can't drift again.
> 5. Boot logs warn loudly if `PUBLIC_BASE_URL` is still localhost.
> 6. `npm run deploy:base-sepolia` now derives the signer addresses from
>    Dev 3's keys, passes them to the constructor, and writes
>    `deployments/base-sepolia.json` in the shape the infra service expects.
>    No more manual `setTraceAckSigner` tx after deploy.
>
> Outstanding ops actions: whoever deploys sets `PUBLIC_BASE_URL` to the
> public host. No code changes required.
