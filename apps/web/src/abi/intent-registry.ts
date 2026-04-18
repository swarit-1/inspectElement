// Read-only copy of Dev 1's ABI — DO NOT EDIT
// Replace with actual ABI from deployments/ once available

export const intentRegistryAbi = [
  {
    type: "function",
    name: "commitIntent",
    inputs: [
      { name: "intentHash", type: "bytes32" },
      {
        name: "cfg",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "token", type: "address" },
          { name: "maxSpendPerTx", type: "uint256" },
          { name: "maxSpendPerDay", type: "uint256" },
          { name: "allowedCounterparties", type: "address[]" },
          { name: "expiry", type: "uint64" },
          { name: "nonce", type: "uint256" },
        ],
      },
      { name: "manifestURI", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeIntent",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getActiveIntentHash",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
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
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "intentHash", type: "bytes32", indexed: true },
    ],
  },
] as const;
