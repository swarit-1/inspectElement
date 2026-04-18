// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IGuardTypes } from "./IGuardTypes.sol";

/// @title IStakeVault — USDC custody for operator stake and slash payouts.
/// @notice Internal interface. Not called directly by EOAs. `deposit` is gated to
/// AgentRegistry; `slash` is gated to ChallengeArbiter.
interface IStakeVault is IGuardTypes {
    // --- Events ---

    /// @notice Emitted after a successful stake deposit.
    /// @param agentId  Agent credited with the deposit.
    /// @param from     Address whose USDC was pulled (the operator).
    /// @param amount   USDC amount deposited (6 decimals).
    /// @param newStake Total stake held for `agentId` after this deposit.
    event Deposited(bytes32 indexed agentId, address indexed from, uint256 amount, uint256 newStake);

    /// @notice Emitted after a slash.
    /// @param agentId   Agent whose stake was reduced.
    /// @param to        Recipient of the slashed USDC (typically the receipt owner).
    /// @param requested Amount ChallengeArbiter asked to slash.
    /// @param actual    min(stake, requested) — amount actually transferred.
    event Slashed(bytes32 indexed agentId, address indexed to, uint256 requested, uint256 actual);

    // --- Errors ---

    /// @notice Caller is not the configured AgentRegistry.
    error OnlyAgentRegistry();
    /// @notice Caller is not the configured ChallengeArbiter.
    error OnlyChallengeArbiter();
    /// @notice Zero-amount deposit or slash.
    error ZeroAmount();
    /// @notice Slash attempted against an empty stake.
    error InsufficientStake();

    // --- Mutating ---

    /// @notice Pull `amount` USDC from `from` and credit it to `agentId`.
    /// @dev onlyAgentRegistry. `from` must have approved this vault for `amount` USDC.
    function deposit(bytes32 agentId, address from, uint256 amount) external;

    /// @notice Transfer up to `amount` USDC from `agentId`'s stake to `to`.
    /// @dev onlyChallengeArbiter. Partial slash semantics: returns `min(stake, amount)`.
    /// @return actual The USDC amount actually transferred.
    function slash(bytes32 agentId, address to, uint256 amount) external returns (uint256 actual);

    // --- Views ---

    /// @notice Current USDC stake balance held for `agentId`.
    function stakeOf(bytes32 agentId) external view returns (uint256);

    /// @notice AgentRegistry address allowed to deposit (immutable after deploy).
    function agentRegistry() external view returns (address);

    /// @notice ChallengeArbiter address allowed to slash (immutable after deploy).
    function challengeArbiter() external view returns (address);

    /// @notice USDC token address used for all stake movements.
    function USDC() external view returns (address);
}
