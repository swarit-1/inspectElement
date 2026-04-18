# IntentGuard Contracts — Dev 1 Source of Truth

**Owner:** Dev 1 (Protocol Engineer). **Frozen at hour 4.** Changes to interfaces, event signatures, reason-code preimages, or the EIP-712 type string require an explicit BLOCKED notice because Devs 2, 3, and 4 compile and index against this doc and the files under `contracts/interfaces/`.

---

## 1. Toolchain

| Tool | Version | Notes |
|---|---|---|
| Solidity | `0.8.24` (exact pin) | `evmVersion: "paris"` for Base Sepolia compat |
| Hardhat | `2.22.3` | |
| Hardhat Toolbox | `5.0.0` | |
| Hardhat Ignition (ethers) | `0.15.5` | |
| OpenZeppelin Contracts | `5.0.2` | `Ownable2Step`, `ReentrancyGuard`, `EIP712`, `ECDSA`, `SafeERC20`, `IERC20` |
| Node.js | `>=18.18 <21` | enforced via `package.json` engines |

```
npm install
npm run compile
npm run test
npm run deploy:base-sepolia   # requires .env: BASE_SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY, BASESCAN_API_KEY
```

## 2. Contract layout

```
contracts/
├── interfaces/
│   ├── IGuardTypes.sol        // enum + 4 shared structs (frozen)
│   ├── IIntentRegistry.sol    // IF-02 — commit / revoke / delegate lookup
│   ├── IAgentRegistry.sol     // IF-03 — register / stake / tier / challenge window
│   ├── IGuardedExecutor.sol   // IF-05 + IF-06 events — preflight / execute / receipts
│   ├── IChallengeArbiter.sol  // IF-08 + IF-11 stub — fileAmountViolation / resolveByReviewer
│   └── IStakeVault.sol        // internal vault surface
└── libraries/
    └── GuardConstants.sol     // reason codes + EIP-712 type + bounds
```

Implementations land under `contracts/<Name>.sol` in pass 2. **Non-upgradeable. No proxies.**

## 3. Demo constants (frozen)

| Constant | Value (raw) | Exposed as |
|---|---|---|
| Chain | Base Sepolia (chainId `84532`) | `hardhat.config.ts`, `deployments/base-sepolia.json` |
| USDC decimals | 6 | — |
| maxSpendPerTx | `10_000_000` (10 USDC) | `IntentConfig` field, slash-only |
| maxSpendPerDay | `50_000_000` (50 USDC) | `IntentConfig` field, hard-blocked |
| MAX_COUNTERPARTIES | `8` | `IIntentRegistry.MAX_COUNTERPARTIES()` |
| BRONZE_TIER_THRESHOLD | `50_000_000` (50 USDC) | `GuardConstants.BRONZE_TIER_THRESHOLD` |
| BRONZE_CHALLENGE_WINDOW | `259_200` s (72 h) | `IAgentRegistry.challengeWindow(agentId)` |
| CHALLENGE_BOND | `1_000_000` (1 USDC) | `IChallengeArbiter.CHALLENGE_BOND()` |
| Protocol fee | `0` | MVP constant |
| Day bucket | `block.timestamp / 1 days` UTC | internal |

## 4. Reason codes

All codes are `bytes32 = keccak256(<NAME>)`, published in `GuardConstants`. Reference by name, never by literal.

| Name | Preimage |
|---|---|
| `COUNTERPARTY_NOT_ALLOWED` | `keccak256("COUNTERPARTY_NOT_ALLOWED")` |
| `TOKEN_NOT_USDC` | `keccak256("TOKEN_NOT_USDC")` |
| `INTENT_EXPIRED` | `keccak256("INTENT_EXPIRED")` |
| `DAY_CAP_EXCEEDED` | `keccak256("DAY_CAP_EXCEEDED")` |
| `DELEGATE_NOT_APPROVED` | `keccak256("DELEGATE_NOT_APPROVED")` |
| `TRACE_ACK_INVALID` | `keccak256("TRACE_ACK_INVALID")` |
| `TRACE_ACK_EXPIRED` | `keccak256("TRACE_ACK_EXPIRED")` |
| `NO_ACTIVE_INTENT` | `keccak256("NO_ACTIVE_INTENT")` |

Emitted as `GuardRejected(bytes32 reasonCode)` by `GuardedExecutor.executeWithGuard`, and returned (without reverting) by `preflightCheck`.

## 5. EIP-712 TraceAck (Dev 3 signer must match byte-for-byte)

### 5.1 Domain

```
EIP712Domain(
  string  name,
  string  version,
  uint256 chainId,
  address verifyingContract
)
```

| Field | Value |
|---|---|
| `name` | `"IntentGuard"` |
| `version` | `"1"` |
| `chainId` | `84532` (Base Sepolia) |
| `verifyingContract` | GuardedExecutor deployment address (see `deployments/base-sepolia.json`) |

### 5.2 Message type

```
TraceAck(
  bytes32 contextDigest,
  bytes32 uriHash,
  uint64  expiresAt,
  address guardedExecutor,
  uint256 chainId,
  bytes32 agentId,
  address owner
)
```

### 5.3 Canonical type string (verbatim — lockable bytes)

```
TraceAck(bytes32 contextDigest,bytes32 uriHash,uint64 expiresAt,address guardedExecutor,uint256 chainId,bytes32 agentId,address owner)
```

Exposed as:
- Solidity: `GuardConstants.TRACE_ACK_TYPE` and `IGuardedExecutor.TRACE_ACK_TYPE()`.
- Typehash: `TRACE_ACK_TYPEHASH = keccak256(bytes(TRACE_ACK_TYPE))`, exposed as `GuardConstants.TRACE_ACK_TYPEHASH` and `IGuardedExecutor.TRACE_ACK_TYPEHASH()`.

Note: `chainId` and `guardedExecutor` are already bound via the EIP-712 domain separator. They are duplicated inside the message struct as defense-in-depth against signer libraries that forget to set the domain correctly.

### 5.4 Signer recipe (Dev 3)

1. Construct the EIP-712 domain above. `verifyingContract = <GuardedExecutor>` (published post-deploy).
2. Compute
   ```
   structHash = keccak256(abi.encode(
       TRACE_ACK_TYPEHASH,
       contextDigest,
       uriHash,
       expiresAt,
       guardedExecutor,
       chainId,
       agentId,
       owner
   ))
   ```
3. Compute
   ```
   digest = keccak256("\x19\x01" ++ DOMAIN_SEPARATOR ++ structHash)
   ```
4. Sign `digest` with secp256k1. Serialize as raw 65 bytes: `r || s || v` with `v ∈ {27, 28}`.
5. Return the 65 bytes in `TraceAck.signature`.

On verification, `GuardedExecutor` computes the same `digest`, calls `ECDSA.recover(digest, signature)`, and reverts with `GuardRejected(TRACE_ACK_INVALID)` if the recovered address doesn't equal `traceAckSigner()`.

### 5.5 uriHash binding

`uriHash == keccak256(bytes(traceURI))` is checked on-chain **before** signature recover. A bad or tampered URI therefore short-circuits to `TRACE_ACK_INVALID` without spending signature-recovery gas.

## 6. Execution model + USDC approval (IMPORTANT for Dev 4)

The MVP execution path inside `GuardedExecutor.executeWithGuard` is:

```solidity
IERC20(USDC).transferFrom(req.owner, req.target, req.amount);
```

**Users MUST approve `GuardedExecutor` for USDC during onboarding.** Without this approval, `executeWithGuard` will revert inside ERC-20 `transferFrom`.

Recommended Dev 4 onboarding UX:

1. After smart-account deploy, show "Approve USDC spending" as step 2.
2. Suggested allowance: `1_000_000_000` (1000 USDC). Large enough for the demo, small enough that a forgotten approval isn't catastrophic.
3. Display current allowance in the dashboard; prompt re-approval when it drops below the per-day cap.
4. Separately approve `ChallengeArbiter` for `100_000_000` (100 USDC) so users can file ~100 bonds without re-approving.

**Post-hackathon TODO** (tracked inline in `GuardedExecutor.executeWithGuard`): migrate to a 4337 executor module so the guard calls `account.execute(target, 0, data)` instead of requiring a standing approval.

## 7. Expected call order

### 7.1 User onboarding (once per user)
1. Deploy user smart account (embedded wallet is the owner).
2. `IERC20(USDC).approve(GuardedExecutor, 1_000_000_000)`.
3. `IERC20(USDC).approve(ChallengeArbiter, 100_000_000)`.
4. `IntentRegistry.commitIntent(intentHash, cfg, manifestURI)`.
5. `GuardedExecutor.setAgentDelegate(agentId, delegate, true)`.

### 7.2 Agent operator setup (once per agent)
1. `IERC20(USDC).approve(StakeVault, 50_000_000)`.
2. `AgentRegistry.registerAgent(agentId, operator, metadataURI)`.
3. `AgentRegistry.stake(agentId, 50_000_000)`.

### 7.3 Per guarded execution (delegate-initiated)
1. Runtime serializes DecisionTrace v1 and computes `contextDigest = keccak256(canonicalTraceJson)`.
2. Runtime `POST /v1/traces` → Dev 3 returns `TraceAck`.
3. (Optional) Runtime calls `preflightCheck(req)`; if RED, surface `reasonCode` via `/demo/status`.
4. Runtime calls `executeWithGuard(req)`. On success: `ActionReceipt` + `ReceiptStored` + `TraceURIStored` emitted; USDC transferred.

### 7.4 Per challenge (user-initiated, one transaction)
1. Frontend `POST /v1/challenges/prepare-amount` → Dev 3 returns `{ to, data, bondAmount }`.
2. Frontend verifies USDC allowance to `ChallengeArbiter` ≥ `CHALLENGE_BOND`.
3. Wallet sends `ChallengeArbiter.fileAmountViolation(receiptId)`.
4. Events emitted in order: `ChallengeFiled`, `StakeVault.Slashed`, `ChallengeResolved(uphold=true, payout=N)`.

## 8. Event signatures (Dev 3 indexer locks on these)

Canonical signatures (the exact strings Keccak-256 of which give the `topic0` of each event).

### `GuardedExecutor`
- `AgentDelegateSet(address,bytes32,address,bool)` — indexed: `owner, agentId, delegate`
- `ActionReceipt(bytes32,address,bytes32,bytes32,address,address,uint256,bytes32,bytes32,uint256,uint64)` — indexed: `receiptId, owner, agentId`
- `ReceiptStored(bytes32,address,bytes32)` — indexed: `receiptId, owner, intentHash`
- `TraceURIStored(bytes32,string)` — indexed: `receiptId`
- `TraceAckSignerUpdated(address,address)` — indexed: `previous, current`

### `IntentRegistry`
- `IntentCommitted(address,bytes32,string)` — indexed: `owner, intentHash`
- `IntentRevoked(address,bytes32)` — indexed: `owner, intentHash`

### `AgentRegistry`
- `AgentRegistered(bytes32,address,string)` — indexed: `agentId, operator`
- `AgentStaked(bytes32,uint256,uint256)` — indexed: `agentId`

### `ChallengeArbiter`
- `ChallengeFiled(uint256,bytes32,address)` — indexed: `challengeId, receiptId, challenger`
- `ChallengeResolved(uint256,bool,uint256)` — indexed: `challengeId`
- `ReviewerSignerUpdated(address,address)` — indexed: `previous, current`

### `StakeVault`
- `Deposited(bytes32,address,uint256,uint256)` — indexed: `agentId, from`
- `Slashed(bytes32,address,uint256,uint256)` — indexed: `agentId, to`

## 9. receiptId derivation (off-chain indexer)

The indexer can compute `receiptId` directly from `ActionReceipt` event fields — **no contract read required**:

```
receiptId = keccak256(abi.encode(
    owner,                    // ActionReceipt.owner
    agentId,                  // ActionReceipt.agentId
    nonce,                    // ActionReceipt.nonce  (== execNonce[owner] at exec time)
    84532,                    // Base Sepolia chainId
    guardedExecutorAddress    // from deployments/base-sepolia.json
))
```

`ReceiptStored` also carries `receiptId` as an indexed topic, for direct lookups from `owner` or `intentHash`.

## 10. Admin model

- `GuardedExecutor` and `ChallengeArbiter` inherit OpenZeppelin `Ownable2Step`.
- Deployer is the initial owner.
- Only admin functions exposed:
  - `GuardedExecutor.setTraceAckSigner(address)` — rotate Dev 3 infra signer.
  - `ChallengeArbiter.setReviewerSigner(address)` — rotate post-hackathon reviewer.
- No pausing, no upgradeability, no timelock. Hackathon scope.
- Ownership rotation is two-step (OZ `Ownable2Step`): proposal + acceptance.

`StakeVault`, `IntentRegistry`, and `AgentRegistry` have no admin functions. Their wired addresses (USDC, Registry, Arbiter) are set at deploy via the constructor and are immutable.

## 11. Deployment artifacts (produced in pass 2)

- `deployments/base-sepolia.json` — contract addresses + constants.
- `abi/IntentRegistry.json`, `abi/AgentRegistry.json`, `abi/GuardedExecutor.json`, `abi/ChallengeArbiter.json`, `abi/StakeVault.json` — built by `hardhat compile`.

Both committed to the repo root. Devs 2, 3, 4 import directly.

## 12. DO NOT

- Do not change the `ActionReceipt` event signature, parameter order, or indexed topic layout.
- Do not change the `TraceAck` EIP-712 type string.
- Do not change reason-code preimages.
- Do not add a YELLOW path.
- Do not add challenge types beyond `AmountViolation`.
- Do not add `maxSpendPerTx` as a pre-exec hard check — it is deliberately slash-only for the MVP demo.
