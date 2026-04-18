// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IGuardTypes } from "./IGuardTypes.sol";

/// @title IAgentRegistry — agent identity and stake accounting (IF-03).
/// @notice Maps `agentId` to operator + current stake. Tier and challenge window are derived
/// from stake size. Reputation is an internal counter not writable from outside.
interface IAgentRegistry is IGuardTypes {
    /// @notice Coarse stake tiers. Only Bronze is used in MVP flow.
    enum Tier {
        None,
        Bronze
    }

    // --- Events ---

    /// @notice Emitted on successful agent registration.
    event AgentRegistered(bytes32 indexed agentId, address indexed operator, string metadataURI);

    /// @notice Emitted after a successful stake deposit.
    event AgentStaked(bytes32 indexed agentId, uint256 amount, uint256 newStake);

    // --- Errors ---

    /// @notice `agentId` already exists.
    error AgentAlreadyRegistered();
    /// @notice `agentId` is unknown.
    error AgentNotRegistered();
    /// @notice Caller is not the agent's operator.
    error NotAgentOperator();
    /// @notice Zero-amount stake is rejected.
    error ZeroStake();

    // --- Mutating ---

    /// @notice Register a new agent.
    /// @param agentId     Globally unique 32-byte identifier (ERC-8004-style).
    /// @param operator    Address that will stake and receive slash consequences.
    /// @param metadataURI Off-chain metadata pointer (e.g. ipfs://...).
    function registerAgent(bytes32 agentId, address operator, string calldata metadataURI) external;

    /// @notice Deposit USDC stake for an existing agent.
    /// @dev Caller must be the agent's operator and must have approved USDC to StakeVault.
    /// @param agentId Agent to stake for.
    /// @param amount  USDC amount (6 decimals).
    function stake(bytes32 agentId, uint256 amount) external;

    // --- Views ---

    /// @notice Read agent metadata and current stake state.
    /// @return operator    Operator address.
    /// @return stakeAmount USDC stake held in StakeVault for this agent.
    /// @return tier        Bronze if `stakeAmount >= BRONZE_TIER_THRESHOLD`, else None.
    /// @return reputation  Signed reputation counter (MVP: only changes via dispute outcome).
    function getAgent(bytes32 agentId)
        external
        view
        returns (address operator, uint256 stakeAmount, Tier tier, int256 reputation);

    /// @notice Challenge window (seconds) for this agent's current tier.
    /// @dev Bronze => 72 hours; None => 0.
    function challengeWindow(bytes32 agentId) external view returns (uint64);
}
