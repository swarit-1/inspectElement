/**
 * AgentRegistry ABI — derived from `contracts/interfaces/IAgentRegistry.sol`.
 *
 * Created by Dev 3 because the original `apps/web/src/abi/` set was missing
 * this contract entirely — Dev 4's dashboard would have had no way to look up
 * agent operator / stake / tier on its own (it would have had to read every
 * `AgentRegistered` log and reconstruct state).
 *
 * Tier enum:  0 = None, 1 = Bronze
 */

export const agentRegistryAbi = [
  // --- Mutating ---
  {
    type: "function",
    name: "registerAgent",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "operator", type: "address" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "stake",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // --- Views ---
  {
    type: "function",
    name: "getAgent",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [
      { name: "operator", type: "address" },
      { name: "stakeAmount", type: "uint256" },
      { name: "tier", type: "uint8" },
      { name: "reputation", type: "int256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "challengeWindow",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint64" }],
    stateMutability: "view",
  },

  // --- Events ---
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "operator", type: "address", indexed: true },
      { name: "metadataURI", type: "string", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "AgentStaked",
    inputs: [
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "newStake", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },

  // --- Errors ---
  { type: "error", name: "AgentAlreadyRegistered", inputs: [] },
  { type: "error", name: "AgentNotRegistered", inputs: [] },
  { type: "error", name: "NotAgentOperator", inputs: [] },
  { type: "error", name: "ZeroStake", inputs: [] },
] as const;
