// Read-only copy of Dev 1's ABI — DO NOT EDIT

export const challengeArbiterAbi = [
  {
    type: "function",
    name: "fileAmountViolation",
    inputs: [{ name: "receiptId", type: "bytes32" }],
    outputs: [{ name: "challengeId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolveByReviewer",
    inputs: [
      { name: "challengeId", type: "uint256" },
      { name: "uphold", type: "bool" },
      { name: "slashAmount", type: "uint256" },
      { name: "reviewerSig", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "ChallengeFiled",
    inputs: [
      { name: "challengeId", type: "uint256", indexed: true },
      { name: "receiptId", type: "bytes32", indexed: true },
      { name: "challenger", type: "address", indexed: true },
      { name: "challengeType", type: "uint8", indexed: false },
      { name: "bondAmount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ChallengeResolved",
    inputs: [
      { name: "challengeId", type: "uint256", indexed: true },
      { name: "upheld", type: "bool", indexed: false },
      { name: "slashAmount", type: "uint256", indexed: false },
      { name: "payoutTo", type: "address", indexed: false },
    ],
  },
] as const;
