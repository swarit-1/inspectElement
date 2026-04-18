// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IGuardedExecutor } from "./interfaces/IGuardedExecutor.sol";
import { IIntentRegistry } from "./interfaces/IIntentRegistry.sol";
import { GuardConstants } from "./libraries/GuardConstants.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title GuardedExecutor
/// @notice Hard pre-exec checks and USDC transfer for delegate-initiated agent payments.
/// @dev MVP execution uses `USDC.transferFrom(owner, target, amount)`. Users MUST approve
/// this contract for USDC during onboarding (see CONTRACTS-README §6).
/// TODO(post-hackathon): migrate to ERC-4337 executor module so the guard calls
/// `account.execute(target, 0, data)` and the standing approval goes away.
contract GuardedExecutor is IGuardedExecutor, ReentrancyGuard, Ownable2Step, EIP712 {
    using SafeERC20 for IERC20;

    address public immutable USDC;
    IIntentRegistry public immutable intentRegistry;
    address public traceAckSigner;

    mapping(address => mapping(bytes32 => mapping(address => bool))) private _delegates;
    mapping(address => mapping(uint256 => uint256)) private _spentByDay;
    mapping(address => uint256) private _execNonce;
    mapping(bytes32 => ReceiptSummary) private _receipts;

    error ZeroAddress();

    constructor(
        address usdc_,
        address intentRegistry_,
        address traceAckSigner_,
        address initialOwner_
    )
        Ownable(initialOwner_)
        EIP712(GuardConstants.EIP712_DOMAIN_NAME, GuardConstants.EIP712_DOMAIN_VERSION)
    {
        if (
            usdc_ == address(0) ||
            intentRegistry_ == address(0) ||
            traceAckSigner_ == address(0) ||
            initialOwner_ == address(0)
        ) revert ZeroAddress();
        USDC = usdc_;
        intentRegistry = IIntentRegistry(intentRegistry_);
        traceAckSigner = traceAckSigner_;
    }

    // --- Owner-scoped ---

    /// @inheritdoc IGuardedExecutor
    function setAgentDelegate(bytes32 agentId, address delegate, bool approved) external {
        _delegates[msg.sender][agentId][delegate] = approved;
        emit AgentDelegateSet(msg.sender, agentId, delegate, approved);
    }

    // --- Delegate-scoped ---

    /// @inheritdoc IGuardedExecutor
    function preflightCheck(ExecutionRequest calldata req)
        external
        view
        returns (GuardDecision decision, bytes32 reasonCode)
    {
        return _checkGuard(req);
    }

    /// @inheritdoc IGuardedExecutor
    function executeWithGuard(ExecutionRequest calldata req)
        external
        nonReentrant
        returns (bytes32 receiptId)
    {
        (GuardDecision decision, bytes32 reasonCode) = _checkGuard(req);
        if (decision != GuardDecision.GREEN) revert GuardRejected(reasonCode);

        // --- Effects ---
        uint256 dayBucket = block.timestamp / 1 days;
        _spentByDay[req.owner][dayBucket] += req.amount;

        uint256 nonce = _execNonce[req.owner];
        _execNonce[req.owner] = nonce + 1;

        bytes32 intentHash = intentRegistry.getActiveIntentHash(req.owner);
        receiptId = keccak256(
            abi.encode(req.owner, req.agentId, nonce, block.chainid, address(this))
        );

        ReceiptSummary memory summary = ReceiptSummary({
            owner: req.owner,
            agentId: req.agentId,
            intentHash: intentHash,
            target: req.target,
            token: req.token,
            amount: req.amount,
            callDataHash: keccak256(req.data),
            contextDigest: req.traceAck.contextDigest,
            nonce: nonce,
            timestamp: uint64(block.timestamp)
        });
        _receipts[receiptId] = summary;

        emit ActionReceipt(
            receiptId,
            req.owner,
            req.agentId,
            intentHash,
            req.target,
            req.token,
            req.amount,
            summary.callDataHash,
            req.traceAck.contextDigest,
            nonce,
            uint64(block.timestamp)
        );
        emit ReceiptStored(receiptId, req.owner, intentHash);
        emit TraceURIStored(receiptId, req.traceURI);

        // --- Interactions ---
        IERC20(USDC).safeTransferFrom(req.owner, req.target, req.amount);
    }

    // --- Views ---

    /// @inheritdoc IGuardedExecutor
    function getReceipt(bytes32 receiptId) external view returns (ReceiptSummary memory) {
        return _receipts[receiptId];
    }

    /// @inheritdoc IGuardedExecutor
    function isDelegateApproved(address owner, bytes32 agentId, address delegate)
        external
        view
        returns (bool)
    {
        return _delegates[owner][agentId][delegate];
    }

    /// @inheritdoc IGuardedExecutor
    function spentToday(address owner) external view returns (uint256) {
        return _spentByDay[owner][block.timestamp / 1 days];
    }

    /// @inheritdoc IGuardedExecutor
    function execNonce(address owner) external view returns (uint256) {
        return _execNonce[owner];
    }

    /// @inheritdoc IGuardedExecutor
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @inheritdoc IGuardedExecutor
    function TRACE_ACK_TYPE() external pure returns (string memory) {
        return GuardConstants.TRACE_ACK_TYPE;
    }

    /// @inheritdoc IGuardedExecutor
    function TRACE_ACK_TYPEHASH() external pure returns (bytes32) {
        return GuardConstants.TRACE_ACK_TYPEHASH;
    }

    // --- Admin ---

    /// @inheritdoc IGuardedExecutor
    function setTraceAckSigner(address signer) external onlyOwner {
        if (signer == address(0)) revert ZeroSigner();
        address prev = traceAckSigner;
        traceAckSigner = signer;
        emit TraceAckSignerUpdated(prev, signer);
    }

    // --- Internals ---

    function _checkGuard(ExecutionRequest calldata req)
        internal
        view
        returns (GuardDecision, bytes32)
    {
        if (!_delegates[req.owner][req.agentId][msg.sender]) {
            return (GuardDecision.RED, GuardConstants.DELEGATE_NOT_APPROVED);
        }
        if (req.token != USDC) {
            return (GuardDecision.RED, GuardConstants.TOKEN_NOT_USDC);
        }

        bytes32 intentHash = intentRegistry.getActiveIntentHash(req.owner);
        if (intentHash == bytes32(0)) {
            return (GuardDecision.RED, GuardConstants.NO_ACTIVE_INTENT);
        }
        (IntentConfig memory cfg, ) = intentRegistry.getIntent(intentHash);

        if (block.timestamp >= cfg.expiry) {
            return (GuardDecision.RED, GuardConstants.INTENT_EXPIRED);
        }

        bool found;
        uint256 len = cfg.allowedCounterparties.length;
        for (uint256 i = 0; i < len; ) {
            if (cfg.allowedCounterparties[i] == req.target) {
                found = true;
                break;
            }
            unchecked { ++i; }
        }
        if (!found) {
            return (GuardDecision.RED, GuardConstants.COUNTERPARTY_NOT_ALLOWED);
        }

        uint256 dayBucket = block.timestamp / 1 days;
        if (_spentByDay[req.owner][dayBucket] + req.amount > cfg.maxSpendPerDay) {
            return (GuardDecision.RED, GuardConstants.DAY_CAP_EXCEEDED);
        }

        // TraceAck
        TraceAck calldata ack = req.traceAck;
        if (ack.expiresAt <= block.timestamp) {
            return (GuardDecision.RED, GuardConstants.TRACE_ACK_EXPIRED);
        }
        if (keccak256(bytes(req.traceURI)) != ack.uriHash) {
            return (GuardDecision.RED, GuardConstants.TRACE_ACK_INVALID);
        }
        bytes32 structHash = keccak256(
            abi.encode(
                GuardConstants.TRACE_ACK_TYPEHASH,
                ack.contextDigest,
                ack.uriHash,
                ack.expiresAt,
                address(this),
                block.chainid,
                req.agentId,
                req.owner
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(digest, ack.signature);
        if (err != ECDSA.RecoverError.NoError || recovered != traceAckSigner) {
            return (GuardDecision.RED, GuardConstants.TRACE_ACK_INVALID);
        }

        return (GuardDecision.GREEN, bytes32(0));
    }
}
