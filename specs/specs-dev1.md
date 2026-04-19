# Dev 1 — Protocol Engineer (Solidity / On-chain)

> Canonical owner of all Solidity contracts, Base Sepolia deployment artifacts, and the ABI/address bundle that is the source of truth for every other dev. **You are unblocked from hour 0 and everyone else is blocked on you.** Ship interface signatures and ABIs by hour 4, not hour 12.

---

## 1. Scope

### In scope
- All Solidity contracts: `IntentRegistry`, `AgentRegistry`, `GuardedExecutor`, `ChallengeArbiter`, `StakeVault`.
- Custom errors, on-chain `ReceiptSummary` storage, reason codes.
- Hardhat tests + Hardhat Ignition deployment modules for Base Sepolia.
- `deployments/base-sepolia.json` (addresses + constructor args).
- ABI export bundle consumed by Dev 2, 3, 4.
- Contract README with constants, reason codes, call order.

### Out of scope
- Off-chain trace/manifest pinning (Dev 3).
- LLM runtime, x402 agent (Dev 2).
- Any frontend UX (Dev 4).
- Subgraph/indexer (Dev 3).

---

## 2. Demo constants (hard-coded, frozen)

| Item                       | Value                                                 |
| -------------------------- | ----------------------------------------------------- |
| Chain                      | Base Sepolia                                          |
| Token                      | `USDC_ADDRESS` (env, but single address, USDC only)   |
| Intent per-tx cap          | `10_000_000` (10 USDC) — **slash-only**, not hard-blocked |
| Intent per-day cap         | `50_000_000` (50 USDC) — hard-blocked                 |
| Allowlisted counterparties | 3 addresses                                           |
| Agent stake                | `50_000_000` (50 USDC)                                |
| Challenge bond             | `1_000_000` (1 USDC)                                  |
| Bronze challenge window    | 72 hours                                              |
| Protocol fee               | 0                                                     |
| Day bucket                 | `block.timestamp / 1 days` (UTC day, not rolling 24h) |

---

## 3. Deliverables

### 3.1 `IntentRegistry.sol`
- `commitIntent(bytes32 intentHash, IntentConfig cfg, string manifestURI)`
- `revokeIntent()` → sets `activeIntentHash[owner] = bytes32(0)` but **keeps `intentByHash` historical**.
- `getActiveIntentHash(address owner) returns (bytes32)`
- `intentByHash(bytes32) returns (IntentConfig, string manifestURI)` — public mapping getter.
- Events: `IntentCommitted(owner, intentHash, manifestURI)`, `IntentRevoked(owner)`.
- Cap `allowedCounterparties.length <= 8`; demo uses 3.

### 3.2 `AgentRegistry.sol`
- `registerAgent(bytes32 agentId, address operator, string metadataURI)`
- `stake(bytes32 agentId, uint256 amount)` — pulls USDC from operator via `StakeVault`.
- `getAgent(bytes32 agentId) returns (address operator, uint256 stake, uint8 tier, int256 reputation)`
- Tier derivation: Bronze if `stake >= 50e6`, else `None`. Only Bronze matters.
- `challengeWindow(bytes32 agentId) returns (uint64)` → returns `72 hours` for Bronze.
- Events: `AgentRegistered(agentId, operator, metadataURI)`, `AgentStaked(agentId, amount, newStake)`.

### 3.3 `GuardedExecutor.sol`
- `setAgentDelegate(bytes32 agentId, address delegate, bool approved)` — user-only.
- `preflightCheck(ExecutionRequest req) returns (GuardDecision decision, bytes32 reasonCode)` — **view**, no revert.
- `executeWithGuard(ExecutionRequest req) returns (bytes32 receiptId)` — hard-checks in order:
  1. delegate key is approved for `owner + agentId`
  2. `token == USDC_ADDRESS`
  3. `target ∈ allowedCounterparties`
  4. `block.timestamp < expiry`
  5. `spentToday + amount <= maxSpendPerDay`
  6. `TraceAck.signature` valid AND `expiresAt > block.timestamp` AND `uriHash == keccak256(bytes(traceURI))` AND `contextDigest` matches.
- Reverts with `GuardRejected(bytes32 reasonCode)` on any failure.
- **Do NOT hard-block `maxSpendPerTx`** — recorded in receipt for slash-only enforcement.
- On success: write `ReceiptSummary` to storage keyed by `receiptId`, then emit `ActionReceipt`, `ReceiptStored`, `TraceURIStored`.
- Call `IERC20(USDC).transferFrom(owner, target, amount)` OR call into smart account to execute — pick one, document it.
- `GuardDecision` enum: `{ GREEN, YELLOW, RED }` — only `GREEN` and `RED` are used in flow; `YELLOW` reserved.

### 3.4 `ChallengeArbiter.sol`
- `fileAmountViolation(bytes32 receiptId) returns (uint256 challengeId)` in one tx:
  1. pull 1 USDC bond from `msg.sender`
  2. load `ReceiptSummary` by `receiptId`; revert if missing
  3. load `IntentConfig` by `receipt.intentHash`
  4. require `block.timestamp <= receipt.timestamp + AgentRegistry.challengeWindow(receipt.agentId)`
  5. require `receipt.amount > intent.maxSpendPerTx` — else revert `NotOverspend`
  6. call `StakeVault.slash(receipt.agentId, receipt.owner, min(stake, receipt.amount))`
  7. refund bond to challenger
  8. emit `ChallengeFiled(challengeId, receiptId, challenger)` and `ChallengeResolved(challengeId, uphold=true, payout)`
- `resolveByReviewer(uint256 challengeId, bool uphold, uint256 slashAmount, bytes reviewerSig)` — interface + signer-check stub only; not used in live demo.
- Reviewer signer address is constructor param, changeable by owner.

### 3.5 `StakeVault.sol`
- `deposit(bytes32 agentId, uint256 amount)` — called by `AgentRegistry.stake`.
- `slash(bytes32 agentId, address to, uint256 amount)` — **only callable by `ChallengeArbiter`**.
- `stakeOf(bytes32 agentId) returns (uint256)`.
- Partial slash: `actual = min(stake, amount)`. No insurance pool, no fee.

### 3.6 Reason codes (bytes32 constants, frozen)
```
COUNTERPARTY_NOT_ALLOWED
TOKEN_NOT_USDC
INTENT_EXPIRED
DAY_CAP_EXCEEDED
DELEGATE_NOT_APPROVED
TRACE_ACK_INVALID
TRACE_ACK_EXPIRED
NO_ACTIVE_INTENT
```
Export as `bytes32(keccak256("COUNTERPARTY_NOT_ALLOWED"))` etc. Publish in README.

### 3.7 Shared structs (must match PRD §3.5 exactly)
```solidity
struct IntentConfig {
    address owner;
    address token;          // USDC only
    uint256 maxSpendPerTx;
    uint256 maxSpendPerDay;
    address[] allowedCounterparties;
    uint64 expiry;
    uint256 nonce;
}
struct TraceAck {
    bytes32 contextDigest;
    bytes32 uriHash;
    uint64 expiresAt;
    bytes signature;
}
struct ExecutionRequest {
    address owner;
    bytes32 agentId;
    address target;
    address token;
    uint256 amount;
    bytes data;
    string traceURI;
    TraceAck traceAck;
}
struct ReceiptSummary {
    address owner;
    bytes32 agentId;
    bytes32 intentHash;
    address target;
    address token;
    uint256 amount;
    bytes32 callDataHash;
    bytes32 contextDigest;
    uint256 nonce;
    uint64  timestamp;
}
```

### 3.8 Events (frozen signatures)
```solidity
event ActionReceipt(bytes32 indexed receiptId, address indexed owner, bytes32 indexed agentId, bytes32 intentHash, address target, address token, uint256 amount, bytes32 callDataHash, bytes32 contextDigest, uint256 nonce, uint64 timestamp);
event ReceiptStored(bytes32 indexed receiptId, address indexed owner, bytes32 indexed intentHash);
event TraceURIStored(bytes32 indexed receiptId, string traceURI);
event ChallengeFiled(uint256 indexed challengeId, bytes32 indexed receiptId, address indexed challenger);
event ChallengeResolved(uint256 indexed challengeId, bool uphold, uint256 payout);
```

### 3.9 Tests (Hardhat)
- Unit: intent commit/revoke; agent register/stake; delegate set/unset.
- Integration: legit allowlisted 2 USDC payment → receipt emitted.
- Integration: blocked attacker target → `preflightCheck` returns `(RED, COUNTERPARTY_NOT_ALLOWED)`; `executeWithGuard` reverts with same code.
- Integration: overspend 15 USDC to allowlisted → succeeds, receipt stored, then `fileAmountViolation` slashes 15 USDC to owner.
- Edge: `TraceAck` expired → revert; wrong signer → revert; `uriHash` mismatch → revert.

### 3.10 Deployment artifacts (**critical for other devs**)
Write to `deployments/base-sepolia.json`:
```json
{
  "chainId": 84532,
  "contracts": {
    "IntentRegistry":    "0x…",
    "AgentRegistry":     "0x…",
    "GuardedExecutor":   "0x…",
    "ChallengeArbiter":  "0x…",
    "StakeVault":        "0x…",
    "USDC":              "0x…"
  },
  "traceAckSigner": "0x…",
  "reviewerSigner": "0x…",
  "constants": { "chainId": 84532, "maxSpendPerTx": "10000000", "maxSpendPerDay": "50000000", "agentStake": "50000000", "challengeBond": "1000000", "challengeWindowSec": 259200 }
}
```
Write ABIs to `abi/*.json` (one file per contract). **Commit these to repo root.**

---

## 4. Interface contracts (you produce)

| ID    | Consumers        | Surface |
| ----- | ---------------- | ------- |
| IF-02 | Dev 4            | `commitIntent`, `revokeIntent`, `setAgentDelegate`, events |
| IF-03 | Dev 2            | `registerAgent`, `stake`, `getAgent`, events |
| IF-05 | Dev 2            | `preflightCheck`, `executeWithGuard`, `GuardRejected` |
| IF-06 | Dev 3            | `ActionReceipt`, `ReceiptStored`, `TraceURIStored`, `ChallengeFiled`, `ChallengeResolved` |
| IF-08 | Dev 4            | `fileAmountViolation(bytes32 receiptId)` |
| IF-11 | Dev 3            | `resolveByReviewer(uint256, bool, uint256, bytes)` |

---

## 5. Dependencies on other devs

### Inbound (things you need from others)
- **Dev 3 `TraceAck` signer address** — needed by hour 8 so `GuardedExecutor` constructor can set it. **Mitigation:** deploy with a placeholder address you control, then `setTraceAckSigner(address)` owner function. Publish the signer pubkey swap requirement in contract README.

### Outbound (things others need from you — **publish by hour 4**)
- Frozen Solidity structs (`IntentConfig`, `ExecutionRequest`, `TraceAck`, `ReceiptSummary`).
- Frozen event signatures.
- Frozen reason codes.
- Frozen function selectors for IF-02, IF-03, IF-05, IF-08, IF-11.

**Until hour 4, publish interface-only stubs (`interfaces/*.sol`) that every dev can import.** Implementation can come later; selectors must not change.

---

## 6. Milestones

| Hour  | Exit criteria                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0–4   | `interfaces/*.sol` + reason-codes + ABI stubs published to repo root. Dev 2/3/4 unblocked.                                                                   |
| 4–12  | All structs, errors, events **frozen**. Local hardhat tests pass for intent commit, agent register/stake, one successful guarded execution (unit-level).    |
| 12–28 | Contracts deployed to Base Sepolia. `deployments/base-sepolia.json` committed. Runtime calls `preflightCheck` + `executeWithGuard` live. End-to-end overspend + `fileAmountViolation` + slash works on live contracts.                                                                                                                  |
| 28–40 | Demo steps 4–7 all pass on deployed addresses with no redeploy. ABIs and addresses frozen for Dev 4 wallet tx builder.                                       |

---

## 7. Shared artifacts you own

- `contracts/**/*.sol`
- `interfaces/*.sol`
- `abi/*.json` (exported by hardhat build)
- `deployments/base-sepolia.json`
- `CONTRACTS-README.md` (reason codes, call order, upgrade path)

---

## 8. Risks & fallbacks

| Risk                                                 | Fallback                                                                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| ERC-4337 module wiring takes too long                | Fork minimal `SimpleAccount`-style smart account with hardwired `GuardedExecutor` hook; same external interface.           |
| Arbitrary calldata parsing is unsafe                 | Require explicit `token` + `amount` in `ExecutionRequest`; `data` is opaque bytes passed through to target.                |
| Deterministic dispute needs historical data          | Store `IntentConfig` and `ReceiptSummary` on-chain keyed by hash/receiptId. Never rely on events for contract-side reads. |

---

## 9. Approval-gated protocol add-ons

Only take the items below after explicit team approval. Each one changes frozen reason codes, ABI expectations, deployment artifacts, or the live demo narrative.

1. Stablecoin depeg circuit breaker
   Add a price-feed-backed hard check in `GuardedExecutor` that rejects with `STABLECOIN_DEPEGGED` when USDC/USD falls below the agreed threshold.
   Preferred demo path: deploy a small `MockPriceFeed` so the team can flip the condition on stage without relying on a real depeg.
   Required follow-through: new reason code, new tests, ABI refresh, deployment artifact refresh, and UI reason-label support.
2. Global counterparty blacklist registry
   Add an optional on-chain `BlacklistRegistry` consulted by `preflightCheck` and `executeWithGuard`.
   Reject with `COUNTERPARTY_BLACKLISTED`, but document and freeze the check order once chosen so downstream consumers know which reason wins.
   Required follow-through: new contract surface, new reason code, indexer/UI support, and coordination with Dev 3 on how blacklist entries are seeded and displayed.

---

## 10. Do NOT do

- Do NOT implement `YELLOW` flow. Enum value only.
- Do NOT add `CounterpartyViolation` challenge type.
- Do NOT add weekly caps, geofencing, blacklists, action bitfields, TEE, zkML, AVS, multi-verifier.
- Do NOT break struct or event signatures after hour 4 — everyone else will break.
