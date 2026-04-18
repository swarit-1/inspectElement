// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IGuardTypes } from "./IGuardTypes.sol";

/// @title IGuardedExecutor — delegate-initiated guarded USDC execution (IF-05, IF-06 events).
/// @notice Hard pre-exec checks: delegate approved, token==USDC, target in allowlist,
/// now<expiry, spentToday+amount<=dayCap, valid unexpired TraceAck.
/// `maxSpendPerTx` is NOT hard-blocked; it is enforced post-hoc by ChallengeArbiter.
/// @dev MVP execution path: `IERC20(USDC).transferFrom(owner, target, amount)`. Users MUST
/// approve USDC to this contract during onboarding. Post-hackathon migration to a 4337
/// module is tracked as an inline TODO in the implementation.
interface IGuardedExecutor is IGuardTypes {
    // --- Events ---

    /// @notice Emitted when an owner sets or clears a delegate for an `agentId`.
    event AgentDelegateSet(
        address indexed owner,
        bytes32 indexed agentId,
        address indexed delegate,
        bool approved
    );

    /// @notice Canonical executed-action record. This is the "Executed" event for indexers.
    /// @dev `nonce` equals `execNonce[owner]` at execution time. Indexer reconstructs
    /// receiptId as `keccak256(abi.encode(owner, agentId, nonce, chainId, guardedExecutor))`.
    event ActionReceipt(
        bytes32 indexed receiptId,
        address indexed owner,
        bytes32 indexed agentId,
        bytes32 intentHash,
        address target,
        address token,
        uint256 amount,
        bytes32 callDataHash,
        bytes32 contextDigest,
        uint256 nonce,
        uint64 timestamp
    );

    /// @notice Companion event for cheap owner/intent lookups against receipts.
    event ReceiptStored(
        bytes32 indexed receiptId,
        address indexed owner,
        bytes32 indexed intentHash
    );

    /// @notice Companion event carrying the raw `traceURI` string (unindexed on purpose).
    event TraceURIStored(bytes32 indexed receiptId, string traceURI);

    /// @notice Emitted when the TraceAck signer is rotated by the owner.
    event TraceAckSignerUpdated(address indexed previous, address indexed current);

    // --- Errors ---

    /// @notice Unified revert for `executeWithGuard` when any pre-exec check fails.
    /// @param reasonCode One of the 8 frozen codes in GuardConstants.
    error GuardRejected(bytes32 reasonCode);

    /// @notice Caller is not the intent owner.
    error NotOwner();

    /// @notice `msg.sender` is not an approved delegate for `(req.owner, req.agentId)`.
    error NotApprovedDelegate();

    /// @notice `setTraceAckSigner` was called with `address(0)`.
    error ZeroSigner();

    // --- Owner-scoped ---

    /// @notice Approve or revoke a delegate key for an agent.
    /// @dev Caller is implicitly the intent owner; `(owner, agentId, delegate)` triple is stored.
    function setAgentDelegate(bytes32 agentId, address delegate, bool approved) external;

    // --- Delegate-scoped ---

    /// @notice View-only dry run of the guard. Returns a decision and reason code without reverting.
    /// @dev Use before submitting a suspected-RED request so the reason code is visible to the
    /// runtime (on-chain reverts discard logs).
    function preflightCheck(ExecutionRequest calldata req)
        external
        view
        returns (GuardDecision decision, bytes32 reasonCode);

    /// @notice Execute the payment under guard. Reverts with `GuardRejected` on any failed check.
    /// @return receiptId `keccak256(abi.encode(owner, agentId, execNonce[owner], chainId, address(this)))`.
    function executeWithGuard(ExecutionRequest calldata req) external returns (bytes32 receiptId);

    // --- Views ---

    /// @notice Read a stored receipt; returns a zero-filled struct for unknown ids.
    function getReceipt(bytes32 receiptId) external view returns (ReceiptSummary memory);

    /// @notice Whether `delegate` is currently approved by `owner` for `agentId`.
    function isDelegateApproved(
        address owner,
        bytes32 agentId,
        address delegate
    ) external view returns (bool);

    /// @notice USDC spent by `owner` during the current UTC day bucket.
    function spentToday(address owner) external view returns (uint256);

    /// @notice Current per-owner execution counter. The next successful execute will use this value.
    function execNonce(address owner) external view returns (uint256);

    /// @notice EIP-712 domain separator used to verify TraceAck signatures.
    /// @dev Domain: name="IntentGuard", version="1", chainId=block.chainid,
    /// verifyingContract=address(this).
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /// @notice Frozen EIP-712 type string for TraceAck. Dev 3 signer must use this verbatim.
    function TRACE_ACK_TYPE() external pure returns (string memory);

    /// @notice `keccak256(bytes(TRACE_ACK_TYPE()))`.
    function TRACE_ACK_TYPEHASH() external pure returns (bytes32);

    /// @notice Off-chain infra address that signs TraceAck.
    function traceAckSigner() external view returns (address);

    /// @notice USDC address this executor transfers on successful execute.
    function USDC() external view returns (address);

    // --- Admin (Ownable2Step) ---

    /// @notice Rotate the TraceAck signer. onlyOwner.
    /// @param signer New signer address (must be non-zero).
    function setTraceAckSigner(address signer) external;
}
