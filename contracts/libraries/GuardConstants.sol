// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title GuardConstants — frozen reason codes, EIP-712 type, and bounds.
/// @notice Any change to this file breaks Dev 3's signer, Dev 3's indexer, and Dev 4's form validation.
/// @dev Library of `internal constant`s. Importers inline these at compile time; no runtime deploy.
library GuardConstants {
    // -------------------------------------------------------------------------
    // Reason codes (used as `GuardRejected(bytes32)` payloads)
    // -------------------------------------------------------------------------
    bytes32 internal constant COUNTERPARTY_NOT_ALLOWED = keccak256("COUNTERPARTY_NOT_ALLOWED");
    bytes32 internal constant TOKEN_NOT_USDC           = keccak256("TOKEN_NOT_USDC");
    bytes32 internal constant INTENT_EXPIRED           = keccak256("INTENT_EXPIRED");
    bytes32 internal constant DAY_CAP_EXCEEDED         = keccak256("DAY_CAP_EXCEEDED");
    bytes32 internal constant DELEGATE_NOT_APPROVED    = keccak256("DELEGATE_NOT_APPROVED");
    bytes32 internal constant TRACE_ACK_INVALID        = keccak256("TRACE_ACK_INVALID");
    bytes32 internal constant TRACE_ACK_EXPIRED        = keccak256("TRACE_ACK_EXPIRED");
    bytes32 internal constant NO_ACTIVE_INTENT         = keccak256("NO_ACTIVE_INTENT");

    // -------------------------------------------------------------------------
    // EIP-712 domain
    // -------------------------------------------------------------------------
    string internal constant EIP712_DOMAIN_NAME    = "IntentGuard";
    string internal constant EIP712_DOMAIN_VERSION = "1";

    // -------------------------------------------------------------------------
    // EIP-712 TraceAck type.
    // chainId and guardedExecutor are ALSO bound via the domain separator;
    // duplicating them inside the struct is defense-in-depth against signers
    // that forget to set the domain correctly.
    // -------------------------------------------------------------------------
    string internal constant TRACE_ACK_TYPE =
        "TraceAck(bytes32 contextDigest,bytes32 uriHash,uint64 expiresAt,address guardedExecutor,uint256 chainId,bytes32 agentId,address owner)";
    bytes32 internal constant TRACE_ACK_TYPEHASH = keccak256(bytes(TRACE_ACK_TYPE));

    // -------------------------------------------------------------------------
    // Bounds and thresholds
    // -------------------------------------------------------------------------
    uint256 internal constant MAX_COUNTERPARTIES      = 8;
    uint64  internal constant BRONZE_CHALLENGE_WINDOW = 72 hours;      // 259_200 seconds
    uint256 internal constant BRONZE_TIER_THRESHOLD   = 50_000_000;    // 50 USDC (6 decimals)
    uint256 internal constant CHALLENGE_BOND          = 1_000_000;     // 1 USDC (6 decimals)
}
