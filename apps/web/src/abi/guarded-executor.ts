// Read-only copy of Dev 1's ABI — DO NOT EDIT

export const guardedExecutorAbi = [
  {
    type: "function",
    name: "setAgentDelegate",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "delegate", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "preflightCheck",
    inputs: [
      {
        name: "req",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "agentId", type: "bytes32" },
          { name: "target", type: "address" },
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "data", type: "bytes" },
          { name: "traceURI", type: "string" },
          {
            name: "traceAck",
            type: "tuple",
            components: [
              { name: "contextDigest", type: "bytes32" },
              { name: "uriHash", type: "bytes32" },
              { name: "expiresAt", type: "uint64" },
              { name: "signature", type: "bytes" },
            ],
          },
        ],
      },
    ],
    outputs: [
      { name: "decision", type: "uint8" },
      { name: "reasonCode", type: "bytes32" },
    ],
    stateMutability: "view",
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
  {
    type: "event",
    name: "ActionReceipt",
    inputs: [
      { name: "receiptId", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "agentId", type: "bytes32", indexed: false },
      { name: "intentHash", type: "bytes32", indexed: false },
      { name: "target", type: "address", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "callDataHash", type: "bytes32", indexed: false },
      { name: "contextDigest", type: "bytes32", indexed: false },
      { name: "nonce", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;
