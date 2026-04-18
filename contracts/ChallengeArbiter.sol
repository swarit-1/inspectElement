// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IChallengeArbiter } from "./interfaces/IChallengeArbiter.sol";
import { IIntentRegistry } from "./interfaces/IIntentRegistry.sol";
import { IAgentRegistry } from "./interfaces/IAgentRegistry.sol";
import { IGuardedExecutor } from "./interfaces/IGuardedExecutor.sol";
import { IStakeVault } from "./interfaces/IStakeVault.sol";
import { GuardConstants } from "./libraries/GuardConstants.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title ChallengeArbiter
/// @notice Live path: `fileAmountViolation` — atomic file + slash + payout for overspends.
/// `resolveByReviewer` is a post-hackathon stub with signer-check only.
contract ChallengeArbiter is IChallengeArbiter, ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;
    using MessageHashUtils for bytes32;

    address public immutable USDC;
    IStakeVault public immutable stakeVault;
    IAgentRegistry public immutable agentRegistry;
    IIntentRegistry public immutable intentRegistry;
    IGuardedExecutor public immutable guardedExecutor;

    address public reviewerSigner;

    struct Challenge {
        bytes32 receiptId;
        address challenger;
        bool resolved;
    }

    uint256 private _nextId;
    mapping(uint256 => Challenge) private _challenges;

    error ZeroAddress();

    constructor(
        address usdc_,
        address stakeVault_,
        address agentRegistry_,
        address intentRegistry_,
        address guardedExecutor_,
        address reviewerSigner_,
        address initialOwner_
    ) Ownable(initialOwner_) {
        if (
            usdc_ == address(0) ||
            stakeVault_ == address(0) ||
            agentRegistry_ == address(0) ||
            intentRegistry_ == address(0) ||
            guardedExecutor_ == address(0) ||
            initialOwner_ == address(0)
        ) revert ZeroAddress();
        USDC = usdc_;
        stakeVault = IStakeVault(stakeVault_);
        agentRegistry = IAgentRegistry(agentRegistry_);
        intentRegistry = IIntentRegistry(intentRegistry_);
        guardedExecutor = IGuardedExecutor(guardedExecutor_);
        reviewerSigner = reviewerSigner_; // may be zero; rotate via setReviewerSigner
    }

    /// @inheritdoc IChallengeArbiter
    function CHALLENGE_BOND() external pure returns (uint256) {
        return GuardConstants.CHALLENGE_BOND;
    }

    /// @inheritdoc IChallengeArbiter
    function fileAmountViolation(bytes32 receiptId)
        external
        nonReentrant
        returns (uint256 challengeId)
    {
        ReceiptSummary memory r = guardedExecutor.getReceipt(receiptId);
        if (r.timestamp == 0) revert ReceiptNotFound();

        uint64 window = agentRegistry.challengeWindow(r.agentId);
        if (block.timestamp > uint256(r.timestamp) + uint256(window)) {
            revert ChallengeWindowClosed();
        }

        (IntentConfig memory cfg, ) = intentRegistry.getIntent(r.intentHash);
        if (r.amount <= cfg.maxSpendPerTx) revert NotOverspend();

        // 1. pull bond from challenger
        IERC20(USDC).safeTransferFrom(msg.sender, address(this), GuardConstants.CHALLENGE_BOND);

        // 2. assign challengeId and record
        challengeId = ++_nextId;
        _challenges[challengeId] =
            Challenge({ receiptId: receiptId, challenger: msg.sender, resolved: true });

        emit ChallengeFiled(challengeId, receiptId, msg.sender);

        // 3. slash operator stake and pay receipt.owner
        uint256 actual = stakeVault.slash(r.agentId, r.owner, r.amount);

        // 4. refund bond to challenger
        IERC20(USDC).safeTransfer(msg.sender, GuardConstants.CHALLENGE_BOND);

        emit ChallengeResolved(challengeId, true, actual);
    }

    /// @inheritdoc IChallengeArbiter
    function resolveByReviewer(
        uint256 challengeId,
        bool uphold,
        uint256 slashAmount,
        bytes calldata reviewerSig
    ) external nonReentrant {
        Challenge storage c = _challenges[challengeId];
        if (c.resolved) revert ChallengeAlreadyResolved();
        if (reviewerSigner == address(0)) revert InvalidReviewerSignature();

        bytes32 inner = keccak256(
            abi.encode(challengeId, uphold, slashAmount, address(this), block.chainid)
        );
        bytes32 digest = inner.toEthSignedMessageHash();
        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(digest, reviewerSig);
        if (err != ECDSA.RecoverError.NoError || recovered != reviewerSigner) {
            revert InvalidReviewerSignature();
        }

        c.resolved = true;

        uint256 payout;
        if (uphold) {
            ReceiptSummary memory r = guardedExecutor.getReceipt(c.receiptId);
            payout = stakeVault.slash(r.agentId, r.owner, slashAmount);
        }
        emit ChallengeResolved(challengeId, uphold, payout);
    }

    /// @inheritdoc IChallengeArbiter
    function setReviewerSigner(address signer) external onlyOwner {
        if (signer == address(0)) revert ZeroSigner();
        address prev = reviewerSigner;
        reviewerSigner = signer;
        emit ReviewerSignerUpdated(prev, signer);
    }
}
