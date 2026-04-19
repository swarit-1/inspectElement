/**
 * ABI stubs for Dev 1's contracts.
 *
 * These are the minimal ABIs needed by the runtime to call
 * preflightCheck, executeWithGuard, registerAgent, stake, and ERC20.
 *
 * When Dev 1 publishes full ABIs to abi/*.json, those should be used instead.
 * These stubs exist so Dev 2 can build and test independently.
 */

export const GuardedExecutorABI = [
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
    type: "function",
    name: "executeWithGuard",
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
    outputs: [{ name: "receiptId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
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
    type: "error",
    name: "GuardRejected",
    inputs: [{ name: "reasonCode", type: "bytes32" }],
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

export const AgentRegistryABI = [
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
] as const;

export const IntentRegistryABI = [
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
    name: "getActiveIntentHash",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getIntent",
    inputs: [{ name: "intentHash", type: "bytes32" }],
    outputs: [
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
    stateMutability: "view",
  },
] as const;

export const ERC20ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;
