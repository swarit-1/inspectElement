// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IGuardTypes } from "./IGuardTypes.sol";

/// @title IChallengeArbiter — deterministic AmountViolation + reviewer stub (IF-08, IF-11).
/// @notice MVP live path: `fileAmountViolation(receiptId)` — single-tx file + resolve + payout.
/// `resolveByReviewer` is a post-hackathon stub for semantic challenges; signer check only.
interface IChallengeArbiter is IGuardTypes {
    // --- Events ---

    /// @notice Emitted at the start of a challenge. For AmountViolation, always followed by
    /// `ChallengeResolved` in the same transaction.
    event ChallengeFiled(
        uint256 indexed challengeId,
        bytes32 indexed receiptId,
        address indexed challenger
    );

    /// @notice Emitted when a challenge is resolved.
    /// @param challengeId Monotonic challenge id.
    /// @param uphold      true if the challenge succeeded.
    /// @param payout      USDC paid to `receipt.owner` from operator stake (0 if `!uphold`).
    event ChallengeResolved(uint256 indexed challengeId, bool uphold, uint256 payout);

    /// @notice Emitted when the reviewer signer is rotated by the owner.
    event ReviewerSignerUpdated(address indexed previous, address indexed current);

    // --- Errors ---

    /// @notice The challenged `receiptId` does not exist in GuardedExecutor.
    error ReceiptNotFound();
    /// @notice `block.timestamp > receipt.timestamp + AgentRegistry.challengeWindow(agentId)`.
    error ChallengeWindowClosed();
    /// @notice `receipt.amount <= intent.maxSpendPerTx` — AmountViolation predicate fails.
    error NotOverspend();
    /// @notice `resolveByReviewer` signature does not recover to the current `reviewerSigner`.
    error InvalidReviewerSignature();
    /// @notice Attempted to resolve an already-resolved challenge.
    error ChallengeAlreadyResolved();
    /// @notice `setReviewerSigner` was called with `address(0)`.
    error ZeroSigner();

    // --- User-facing ---

    /// @notice File an AmountViolation challenge. One tx: pull bond, load receipt + intent,
    /// enforce challenge window, require overspend, slash operator via StakeVault, pay owner,
    /// refund bond to challenger.
    /// @dev `msg.sender` must have approved `CHALLENGE_BOND` USDC to this contract.
    /// @param receiptId The receipt alleged to violate `intent.maxSpendPerTx`.
    /// @return challengeId Monotonic id emitted in `ChallengeFiled` / `ChallengeResolved`.
    function fileAmountViolation(bytes32 receiptId) external returns (uint256 challengeId);

    // --- Reviewer (stub only; not in live MVP demo) ---

    /// @notice Resolve a semantic challenge via off-chain reviewer signature.
    /// @dev `reviewerSig` must be produced by the current `reviewerSigner`. Signer-check only
    /// in MVP; full semantic resolution flow is post-hackathon.
    function resolveByReviewer(
        uint256 challengeId,
        bool uphold,
        uint256 slashAmount,
        bytes calldata reviewerSig
    ) external;

    // --- Views ---

    /// @notice Fixed USDC bond (1 USDC = 1_000_000, 6 decimals).
    function CHALLENGE_BOND() external pure returns (uint256);

    /// @notice Current reviewer signer (0x0 if unused).
    function reviewerSigner() external view returns (address);

    /// @notice USDC token address used for bonds and payouts.
    function USDC() external view returns (address);

    // --- Admin (Ownable2Step) ---

    /// @notice Rotate the reviewer signer. onlyOwner.
    function setReviewerSigner(address signer) external;
}
