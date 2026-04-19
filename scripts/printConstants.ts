/*
 * Prints the frozen on-chain constants that other devs need:
 *   - TRACE_ACK_TYPE string + TRACE_ACK_TYPEHASH
 *   - ActionReceipt event signature + topic0
 *   - EIP-712 domain fields
 *   - Reason code preimages
 *
 * Run: `npx ts-node scripts/printConstants.ts`
 */
import { ethers } from "ethers";

const TRACE_ACK_TYPE =
    "TraceAck(bytes32 contextDigest,bytes32 uriHash,uint64 expiresAt,address guardedExecutor,uint256 chainId,bytes32 agentId,address owner)";

const ACTION_RECEIPT_SIG =
    "ActionReceipt(bytes32,address,bytes32,bytes32,address,address,uint256,bytes32,bytes32,uint256,uint64)";

const SELECTORS = [
    "commitIntent(bytes32,(address,address,uint256,uint256,address[],uint64,uint256),string)",
    "revokeIntent()",
    "setAgentDelegate(bytes32,address,bool)",
    "registerAgent(bytes32,address,string)",
    "stake(bytes32,uint256)",
    "getAgent(bytes32)",
    "preflightCheck((address,bytes32,address,address,uint256,bytes,string,(bytes32,bytes32,uint64,bytes)))",
    "executeWithGuard((address,bytes32,address,address,uint256,bytes,string,(bytes32,bytes32,uint64,bytes)))",
    "fileAmountViolation(bytes32)",
    "resolveByReviewer(uint256,bool,uint256,bytes)",
];

const REASONS = [
    "COUNTERPARTY_NOT_ALLOWED",
    "TOKEN_NOT_USDC",
    "INTENT_EXPIRED",
    "DAY_CAP_EXCEEDED",
    "DELEGATE_NOT_APPROVED",
    "TRACE_ACK_INVALID",
    "TRACE_ACK_EXPIRED",
    "NO_ACTIVE_INTENT",
];

console.log("=== EIP-712 Domain ===");
console.log('  name     = "IntentGuard"');
console.log('  version  = "1"');
console.log("  chainId  = block.chainid");
console.log("  verifyingContract = GuardedExecutor");

console.log("\n=== TraceAck type ===");
console.log("  TRACE_ACK_TYPE      =", TRACE_ACK_TYPE);
console.log("  TRACE_ACK_TYPEHASH  =", ethers.keccak256(ethers.toUtf8Bytes(TRACE_ACK_TYPE)));

console.log("\n=== ActionReceipt event ===");
console.log("  signature  =", ACTION_RECEIPT_SIG);
console.log("  topic0     =", ethers.id(ACTION_RECEIPT_SIG));

console.log("\n=== Frozen function selectors ===");
for (const signature of SELECTORS) {
    console.log(`  ${signature.padEnd(110)} ${ethers.id(signature).slice(0, 10)}`);
}

console.log("\n=== Reason codes (GuardRejected payload) ===");
for (const name of REASONS) {
    console.log(`  ${name.padEnd(28)} ${ethers.id(name)}`);
}
