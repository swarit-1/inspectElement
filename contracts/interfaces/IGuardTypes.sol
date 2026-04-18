// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IGuardTypes — shared enums and structs for the IntentGuard protocol.
/// @notice Frozen at hour 4. Any change to this file breaks Dev 2, Dev 3, and Dev 4.
interface IGuardTypes {
    /// @notice Pre-execution guard decision. YELLOW is reserved and never returned in MVP flow.
    enum GuardDecision {
        GREEN,
        YELLOW,
        RED
    }

    /// @notice The on-chain enforceable subset of a user's intent manifest.
    /// @dev `maxSpendPerTx` is a slash-only invariant and is NOT enforced as a hard pre-exec check.
    struct IntentConfig {
        address owner;                    // must equal msg.sender at commit
        address token;                    // must equal the configured USDC address
        uint256 maxSpendPerTx;            // slash-only invariant (ChallengeArbiter enforces)
        uint256 maxSpendPerDay;           // hard-blocked per-owner per-UTC-day
        address[] allowedCounterparties;  // length <= MAX_COUNTERPARTIES (8)
        uint64 expiry;                    // unix seconds; must be > block.timestamp at commit
        uint256 nonce;                    // per-owner strictly-increasing intent nonce
    }

    /// @notice Infra-signed attestation that a decision-trace blob exists at a given URI.
    /// @dev `signature` is secp256k1 over the EIP-712 digest defined in IGuardedExecutor.
    struct TraceAck {
        bytes32 contextDigest;  // keccak256(canonical DecisionTrace v1 JSON)
        bytes32 uriHash;        // keccak256(bytes(traceURI))
        uint64 expiresAt;       // unix seconds after which the ack is invalid
        bytes signature;        // 65-byte r||s||v
    }

    /// @notice A delegate-submitted execution request.
    /// @dev callDataHash = keccak256(data) is recorded in the receipt for later dispute.
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

    /// @notice On-chain receipt record read by ChallengeArbiter for dispute resolution.
    /// @dev `nonce` equals GuardedExecutor.execNonce[owner] at execution time.
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
        uint64 timestamp;
    }
}
