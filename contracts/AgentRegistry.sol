// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IAgentRegistry } from "./interfaces/IAgentRegistry.sol";
import { IStakeVault } from "./interfaces/IStakeVault.sol";
import { GuardConstants } from "./libraries/GuardConstants.sol";

/// @title AgentRegistry
/// @notice Agent identity + stake routing. Delegates USDC custody to StakeVault.
/// Tier and challenge window are derived from current stake.
contract AgentRegistry is IAgentRegistry {
    struct AgentRecord {
        address operator;
        string metadataURI;
        int256 reputation;
        bool exists;
    }

    address public immutable USDC;
    IStakeVault public immutable stakeVault;

    mapping(bytes32 => AgentRecord) private _agents;

    error ZeroAddress();

    constructor(address usdc_, address stakeVault_) {
        if (usdc_ == address(0) || stakeVault_ == address(0)) revert ZeroAddress();
        USDC = usdc_;
        stakeVault = IStakeVault(stakeVault_);
    }

    /// @inheritdoc IAgentRegistry
    function registerAgent(bytes32 agentId, address operator, string calldata metadataURI) external {
        if (operator == address(0)) revert ZeroAddress();
        AgentRecord storage r = _agents[agentId];
        if (r.exists) revert AgentAlreadyRegistered();
        r.operator = operator;
        r.metadataURI = metadataURI;
        r.exists = true;
        emit AgentRegistered(agentId, operator, metadataURI);
    }

    /// @inheritdoc IAgentRegistry
    function stake(bytes32 agentId, uint256 amount) external {
        AgentRecord storage r = _agents[agentId];
        if (!r.exists) revert AgentNotRegistered();
        if (msg.sender != r.operator) revert NotAgentOperator();
        if (amount == 0) revert ZeroStake();

        // StakeVault pulls USDC from msg.sender (the operator); requires prior approval.
        stakeVault.deposit(agentId, msg.sender, amount);
        uint256 newStake = stakeVault.stakeOf(agentId);
        emit AgentStaked(agentId, amount, newStake);
    }

    /// @inheritdoc IAgentRegistry
    function getAgent(bytes32 agentId)
        external
        view
        returns (address operator, uint256 stakeAmount, Tier tier, int256 reputation)
    {
        AgentRecord storage r = _agents[agentId];
        operator = r.operator;
        stakeAmount = stakeVault.stakeOf(agentId);
        tier = stakeAmount >= GuardConstants.BRONZE_TIER_THRESHOLD ? Tier.Bronze : Tier.None;
        reputation = r.reputation;
    }

    /// @inheritdoc IAgentRegistry
    function challengeWindow(bytes32 agentId) external view returns (uint64) {
        uint256 s = stakeVault.stakeOf(agentId);
        if (s >= GuardConstants.BRONZE_TIER_THRESHOLD) return GuardConstants.BRONZE_CHALLENGE_WINDOW;
        return 0;
    }
}
