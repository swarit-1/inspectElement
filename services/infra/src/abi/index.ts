/**
 * Frozen contract ABI fragments consumed by the indexer + challenge-prep API.
 *
 * Source of truth: Dev 1's `abi/*.json` bundle (committed at repo root by hour 12).
 * Until those land, we keep the minimum surface frozen at the spec event
 * signatures (Dev 1 spec §3.7 / §3.8) so indexer development is unblocked.
 *
 * If Dev 1's published ABI for any of these events ever differs in shape, the
 * `loadAbi` helper at the bottom prefers the on-disk root ABI and only falls
 * back to these literals when no root file is present. **We do not modify
 * the root `abi/` directory.**
 */
import type { Abi } from "viem";

export const guardedExecutorEvents = [
  {
    type: "event",
    name: "ActionReceipt",
    inputs: [
      { name: "receiptId", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "intentHash", type: "bytes32", indexed: false },
      { name: "target", type: "address", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "callDataHash", type: "bytes32", indexed: false },
      { name: "contextDigest", type: "bytes32", indexed: false },
      { name: "nonce", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ReceiptStored",
    inputs: [
      { name: "receiptId", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "intentHash", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "event",
    name: "TraceURIStored",
    inputs: [
      { name: "receiptId", type: "bytes32", indexed: true },
      { name: "traceURI", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AgentDelegateSet",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "delegate", type: "address", indexed: true },
      { name: "approved", type: "bool", indexed: false },
    ],
  },
] as const satisfies Abi;

export const challengeArbiterEvents = [
  {
    type: "event",
    name: "ChallengeFiled",
    inputs: [
      { name: "challengeId", type: "uint256", indexed: true },
      { name: "receiptId", type: "bytes32", indexed: true },
      { name: "challenger", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ChallengeResolved",
    inputs: [
      { name: "challengeId", type: "uint256", indexed: true },
      { name: "uphold", type: "bool", indexed: false },
      { name: "payout", type: "uint256", indexed: false },
    ],
  },
] as const satisfies Abi;

export const intentRegistryEvents = [
  {
    type: "event",
    name: "IntentCommitted",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "intentHash", type: "bytes32", indexed: true },
      { name: "manifestURI", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "IntentRevoked",
    inputs: [{ name: "owner", type: "address", indexed: true }],
  },
] as const satisfies Abi;

export const agentRegistryEvents = [
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "operator", type: "address", indexed: true },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AgentStaked",
    inputs: [
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "newStake", type: "uint256", indexed: false },
    ],
  },
] as const satisfies Abi;

export const challengeArbiterFunctions = [
  {
    type: "function",
    name: "fileAmountViolation",
    stateMutability: "nonpayable",
    inputs: [{ name: "receiptId", type: "bytes32" }],
    outputs: [{ name: "challengeId", type: "uint256" }],
  },
  {
    type: "function",
    name: "resolveByReviewer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "challengeId", type: "uint256" },
      { name: "uphold", type: "bool" },
      { name: "slashAmount", type: "uint256" },
      { name: "reviewerSig", type: "bytes" },
    ],
    outputs: [],
  },
] as const satisfies Abi;

export const erc20Functions = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const satisfies Abi;
