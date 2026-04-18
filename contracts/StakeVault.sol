// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IStakeVault } from "./interfaces/IStakeVault.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title StakeVault
/// @notice USDC custody for operator stake and slash payouts. Deposit is gated to
/// AgentRegistry; slash is gated to ChallengeArbiter.
/// @dev Addresses of the registry and arbiter are set via a one-shot `setWiring` call
/// by the deployer (resolves circular construction). After wiring, no admin exists.
contract StakeVault is IStakeVault, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Immutable wiring ---
    address public immutable USDC;
    address public immutable deployer;

    // --- One-shot wiring (set once, then frozen) ---
    address public agentRegistry;
    address public challengeArbiter;

    // --- Stake accounting ---
    mapping(bytes32 => uint256) private _stake;

    // --- Impl-only errors ---
    error AlreadyWired();
    error NotDeployer();
    error ZeroAddress();

    modifier onlyAgentRegistry() {
        if (msg.sender != agentRegistry) revert OnlyAgentRegistry();
        _;
    }

    modifier onlyChallengeArbiter() {
        if (msg.sender != challengeArbiter) revert OnlyChallengeArbiter();
        _;
    }

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        USDC = usdc_;
        deployer = msg.sender;
    }

    /// @notice One-shot deploy-time wiring. Only callable once, only by the deployer.
    function setWiring(address agentRegistry_, address challengeArbiter_) external {
        if (msg.sender != deployer) revert NotDeployer();
        if (agentRegistry != address(0) || challengeArbiter != address(0)) revert AlreadyWired();
        if (agentRegistry_ == address(0) || challengeArbiter_ == address(0)) revert ZeroAddress();
        agentRegistry = agentRegistry_;
        challengeArbiter = challengeArbiter_;
    }

    /// @inheritdoc IStakeVault
    function deposit(bytes32 agentId, address from, uint256 amount)
        external
        nonReentrant
        onlyAgentRegistry
    {
        if (amount == 0) revert ZeroAmount();
        IERC20(USDC).safeTransferFrom(from, address(this), amount);
        uint256 newStake = _stake[agentId] + amount;
        _stake[agentId] = newStake;
        emit Deposited(agentId, from, amount, newStake);
    }

    /// @inheritdoc IStakeVault
    function slash(bytes32 agentId, address to, uint256 amount)
        external
        nonReentrant
        onlyChallengeArbiter
        returns (uint256 actual)
    {
        if (amount == 0) revert ZeroAmount();
        uint256 current = _stake[agentId];
        if (current == 0) revert InsufficientStake();
        actual = amount < current ? amount : current;
        _stake[agentId] = current - actual;
        IERC20(USDC).safeTransfer(to, actual);
        emit Slashed(agentId, to, amount, actual);
    }

    /// @inheritdoc IStakeVault
    function stakeOf(bytes32 agentId) external view returns (uint256) {
        return _stake[agentId];
    }
}
