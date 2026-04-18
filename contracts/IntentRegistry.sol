// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IIntentRegistry } from "./interfaces/IIntentRegistry.sol";
import { GuardConstants } from "./libraries/GuardConstants.sol";

/// @title IntentRegistry
/// @notice Commits user intents on-chain keyed by `intentHash`. Tracks one active intent
/// per owner; retains historical configs so ChallengeArbiter can resolve disputes against
/// the intent in force at receipt time.
/// @dev The contract does NOT recompute `keccak256(canonicalManifestJson)` — Dev 3 infra
/// produces it off-chain. Instead, the contract requires `intentHash` to be globally unused
/// at commit time to prevent aliasing another owner's intent.
contract IntentRegistry is IIntentRegistry {
    address public immutable USDC;

    mapping(address => bytes32) private _activeIntentHash;
    mapping(address => uint256) private _lastNonce;
    mapping(bytes32 => IntentConfig) private _intentConfig;
    mapping(bytes32 => string) private _manifestURI;
    mapping(bytes32 => bool) private _intentExists;

    error ZeroAddress();

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        USDC = usdc_;
    }

    /// @inheritdoc IIntentRegistry
    function commitIntent(
        bytes32 intentHash,
        IntentConfig calldata cfg,
        string calldata manifestURI
    ) external {
        if (cfg.owner != msg.sender) revert NotConfigOwner();
        if (cfg.token != USDC) revert TokenNotUsdc();
        if (cfg.allowedCounterparties.length > GuardConstants.MAX_COUNTERPARTIES) {
            revert CounterpartyListTooLong();
        }
        if (cfg.expiry == 0 || cfg.expiry <= block.timestamp) revert IntentAlreadyExpired();
        if (cfg.nonce <= _lastNonce[msg.sender]) revert NonceNotStrictlyIncreasing();
        if (_intentExists[intentHash]) revert IntentHashMismatch();

        _intentConfig[intentHash] = cfg;
        _manifestURI[intentHash] = manifestURI;
        _intentExists[intentHash] = true;
        _activeIntentHash[msg.sender] = intentHash;
        _lastNonce[msg.sender] = cfg.nonce;

        emit IntentCommitted(msg.sender, intentHash, manifestURI);
    }

    /// @inheritdoc IIntentRegistry
    function revokeIntent() external {
        bytes32 active = _activeIntentHash[msg.sender];
        if (active == bytes32(0)) revert NotIntentOwner();
        _activeIntentHash[msg.sender] = bytes32(0);
        emit IntentRevoked(msg.sender, active);
    }

    /// @inheritdoc IIntentRegistry
    function getActiveIntentHash(address owner) external view returns (bytes32) {
        return _activeIntentHash[owner];
    }

    /// @inheritdoc IIntentRegistry
    function getIntent(bytes32 intentHash)
        external
        view
        returns (IntentConfig memory cfg, string memory manifestURI)
    {
        cfg = _intentConfig[intentHash];
        manifestURI = _manifestURI[intentHash];
    }

    /// @inheritdoc IIntentRegistry
    function MAX_COUNTERPARTIES() external pure returns (uint256) {
        return GuardConstants.MAX_COUNTERPARTIES;
    }
}
