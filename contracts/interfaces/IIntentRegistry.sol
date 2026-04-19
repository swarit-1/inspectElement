// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IGuardTypes } from "./IGuardTypes.sol";

/// @title IIntentRegistry — user-signed intent commit/revoke (IF-02).
/// @notice Stores the enforceable IntentConfig on-chain keyed by `intentHash`. Tracks one
/// active intent per owner while retaining historical configs so ChallengeArbiter can resolve
/// disputes against the intent in force at receipt time.
interface IIntentRegistry is IGuardTypes {
    // --- Events ---

    /// @notice Emitted on a successful commitIntent.
    event IntentCommitted(address indexed owner, bytes32 indexed intentHash, string manifestURI);

    /// @notice Emitted on revokeIntent. Historical `intentByHash` entry is preserved.
    event IntentRevoked(address indexed owner, bytes32 indexed intentHash);

    // --- Errors ---

    /// @notice Provided `intentHash` doesn't match the canonical manifest hash.
    error IntentHashMismatch();
    /// @notice `cfg.allowedCounterparties.length > MAX_COUNTERPARTIES`.
    error CounterpartyListTooLong();
    /// @notice `cfg.expiry == 0` or `cfg.expiry <= block.timestamp` at commit.
    error IntentAlreadyExpired();
    /// @notice revoke called by a caller with no active intent.
    error NotIntentOwner();
    /// @notice New intent nonce is not strictly greater than the prior one for this owner.
    error NonceNotStrictlyIncreasing();
    /// @notice `cfg.owner != msg.sender`.
    error NotConfigOwner();
    /// @notice `cfg.token` is not the configured USDC address.
    error TokenNotUsdc();

    // --- Mutating ---

    /// @notice Commit an intent for `msg.sender`. Overwrites any prior active intent for this owner.
    /// @dev `cfg.owner` must equal `msg.sender`. `intentHash` must equal `keccak256` of the
    /// canonical manifest JSON (as produced by Dev 3's /v1/manifests endpoint).
    /// @param intentHash  keccak256 of the canonical manifest JSON.
    /// @param cfg         Enforceable on-chain subset.
    /// @param manifestURI Pointer to the full manifest (e.g. ipfs://...). Stored, not fetched.
    function commitIntent(
        bytes32 intentHash,
        IntentConfig calldata cfg,
        string calldata manifestURI
    ) external;

    /// @notice Clear the active intent for `msg.sender`. Historical entries remain.
    function revokeIntent() external;

    // --- Views ---

    /// @notice Currently active intent hash for `owner`, or `bytes32(0)` if none.
    function getActiveIntentHash(address owner) external view returns (bytes32);

    /// @notice Read the historical IntentConfig + manifestURI for an `intentHash`.
    /// @dev This is the frozen `intentByHash` surface from the Dev 1 spec.
    function intentByHash(bytes32 intentHash)
        external
        view
        returns (IntentConfig memory cfg, string memory manifestURI);

    /// @notice Backward-compatible alias retained for existing consumers while the
    /// repo converges on the spec name `intentByHash`.
    function getIntent(bytes32 intentHash)
        external
        view
        returns (IntentConfig memory cfg, string memory manifestURI);

    /// @notice Maximum `allowedCounterparties` length. Exposed for Dev 4 form validation.
    function MAX_COUNTERPARTIES() external pure returns (uint256);

    /// @notice Configured USDC token address (set at deploy, immutable).
    function USDC() external view returns (address);
}
