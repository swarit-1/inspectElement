/**
 * Agent Bootstrap Script
 *
 * 1. Load operator EOA from OPERATOR_PRIVATE_KEY
 * 2. Derive agentId = keccak256(operator || salt)
 * 3. AgentRegistry.registerAgent(agentId, operator, metadataURI)
 * 4. USDC.approve(StakeVault, 50e6) → AgentRegistry.stake(agentId, 50e6)
 * 5. Print agentId, txHashes, stake amount
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeAbiParameters,
  getAddress,
  keccak256,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { baseSepolia, hardhat } from "viem/chains";
import {
  loadDeploymentConfig,
  AgentRegistryABI,
  ERC20ABI,
  GuardedExecutorABI,
  IntentRegistryABI,
  loadRuntimeEnv,
  loadAgentAccount,
} from "../packages/trace/src/index.js";

const STAKE_AMOUNT = 50_000_000n; // 50 USDC (6 decimals)
const OWNER_BUFFER_AMOUNT = 100_000_000n; // 100 USDC for demo scenarios
const INTENT_EXPIRY_BUFFER_SECONDS = 7 * 24 * 60 * 60; // 7 days

async function main() {
  const runtime = loadRuntimeEnv();
  const config = loadDeploymentConfig();
  const {
    account: operatorAccount,
    address: operatorAddress,
    agentId,
    source: signerSource,
  } = await loadAgentAccount(runtime);
  const ownerAccount = runtime.ownerAccount;

  const chainId = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : config.chainId;
  const chain = chainId === 31337 ? hardhat : baseSepolia;

  console.log("=== IntentGuard Agent Bootstrap ===");
  console.log(`Operator:  ${operatorAddress} (${signerSource})`);
  console.log(`Owner:     ${ownerAccount.address}`);
  console.log(`Chain:     ${chain.name} (${chainId})`);
  console.log(`RPC:       ${runtime.rpcUrl}`);

  if (signerSource === "cdp" && chainId !== 31337) {
    console.log(
      `\n[funding] Operator is a Coinbase Server Wallet. Ensure ${operatorAddress} ` +
        `holds Base Sepolia ETH for gas and at least 50 USDC for the stake before continuing.`
    );
  }

  const transport = http(runtime.rpcUrl);

  const publicClient = createPublicClient({
    chain,
    transport,
  });

  const operatorWalletClient = createWalletClient({
    account: operatorAccount,
    chain,
    transport,
  });

  const ownerWalletClient = createWalletClient({
    account: ownerAccount,
    chain,
    transport,
  });

  // 1. Derive agentId (resolved above from runtime + signer source)
  console.log(`AgentId:   ${agentId}`);
  const [existingOperator, existingStakeAmount] =
    (await publicClient.readContract({
      address: config.contracts.AgentRegistry,
      abi: AgentRegistryABI,
      functionName: "getAgent",
      args: [agentId],
    })) as [`0x${string}`, bigint, number, bigint];

  // 2. Register agent
  console.log("\n[1/6] Registering agent...");
  let registerHash: Hex | null = null;
  if (existingOperator === getAddress("0x0000000000000000000000000000000000000000")) {
    registerHash = await operatorWalletClient.writeContract({
      address: config.contracts.AgentRegistry,
      abi: AgentRegistryABI,
      functionName: "registerAgent",
      args: [agentId, operatorAddress, runtime.agentMetadataUri],
    });
    console.log(`  tx: ${registerHash}`);
    await publicClient.waitForTransactionReceipt({ hash: registerHash });
    console.log("  confirmed.");
  } else {
    console.log(`  already registered to ${existingOperator}; skipping.`);
  }

  // 2b. Ensure demo wallets have USDC on local chains (MockUSDC has open mint).
  if (chainId === 31337) {
    await ensureLocalMockUsdcBalance(
      publicClient as unknown as PublicClient,
      operatorWalletClient as unknown as WalletClient,
      config.contracts.USDC,
      operatorAddress,
      STAKE_AMOUNT
    );
    await ensureLocalMockUsdcBalance(
      publicClient as unknown as PublicClient,
      ownerWalletClient as unknown as WalletClient,
      config.contracts.USDC,
      ownerAccount.address,
      OWNER_BUFFER_AMOUNT
    );
  }

  // 3. Approve USDC for StakeVault
  console.log("\n[2/6] Approving USDC for StakeVault...");
  const remainingStake = STAKE_AMOUNT > existingStakeAmount ? STAKE_AMOUNT - existingStakeAmount : 0n;
  let approveHash: Hex | null = null;
  if (remainingStake > 0n) {
    approveHash = await operatorWalletClient.writeContract({
      address: config.contracts.USDC,
      abi: ERC20ABI,
      functionName: "approve",
      args: [config.contracts.StakeVault, remainingStake],
    });
    console.log(`  tx: ${approveHash}`);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log("  confirmed.");
  } else {
    console.log("  stake already funded; skipping.");
  }

  // 4. Stake
  console.log("\n[3/6] Staking 50 USDC...");
  let stakeHash: Hex | null = null;
  if (remainingStake > 0n) {
    stakeHash = await operatorWalletClient.writeContract({
      address: config.contracts.AgentRegistry,
      abi: AgentRegistryABI,
      functionName: "stake",
      args: [agentId, remainingStake],
    });
    console.log(`  tx: ${stakeHash}`);
    await publicClient.waitForTransactionReceipt({ hash: stakeHash });
    console.log("  confirmed.");
  } else {
    console.log("  stake already at or above target; skipping.");
  }

  // 5. Activate or refresh the owner's intent so GuardedExecutor has policy to enforce.
  console.log("\n[4/6] Committing active intent for demo owner...");
  const nextIntentNonce = await resolveNextIntentNonce(
    publicClient as unknown as PublicClient,
    config.contracts.IntentRegistry,
    ownerAccount.address
  );
  const intentConfig = {
    owner: ownerAccount.address,
    token: config.contracts.USDC,
    maxSpendPerTx: BigInt(config.constants.maxSpendPerTx),
    maxSpendPerDay: BigInt(config.constants.maxSpendPerDay),
    allowedCounterparties: [getAddress(runtime.merchantAddress)],
    expiry: BigInt(Math.floor(Date.now() / 1000) + INTENT_EXPIRY_BUFFER_SECONDS),
    nonce: nextIntentNonce,
  };
  const intentHash = computeDemoIntentHash(intentConfig, runtime.agentMetadataUri);
  const commitHash = await ownerWalletClient.writeContract({
    address: config.contracts.IntentRegistry,
    abi: IntentRegistryABI,
    functionName: "commitIntent",
    args: [intentHash, intentConfig, runtime.agentMetadataUri],
  });
  console.log(`  tx: ${commitHash}`);
  await publicClient.waitForTransactionReceipt({ hash: commitHash });
  console.log(`  confirmed. intentHash=${intentHash}`);

  // 6. Owner approves operator as agent delegate.
  console.log("\n[5/6] Approving operator as delegate...");
  const delegateHash = await ownerWalletClient.writeContract({
    address: config.contracts.GuardedExecutor,
    abi: GuardedExecutorABI,
    functionName: "setAgentDelegate",
    args: [agentId, operatorAddress, true],
  });
  console.log(`  tx: ${delegateHash}`);
  await publicClient.waitForTransactionReceipt({ hash: delegateHash });
  console.log("  confirmed.");

  // 7. Owner approves GuardedExecutor to pull USDC.
  console.log("\n[6/6] Approving GuardedExecutor to spend owner USDC...");
  const ownerApproveHash = await ownerWalletClient.writeContract({
    address: config.contracts.USDC,
    abi: ERC20ABI,
    functionName: "approve",
    args: [config.contracts.GuardedExecutor, BigInt(config.constants.maxSpendPerDay)],
  });
  console.log(`  tx: ${ownerApproveHash}`);
  await publicClient.waitForTransactionReceipt({ hash: ownerApproveHash });
  console.log("  confirmed.");

  // 8. Verify
  const [operator, stakeAmount, tier, reputation] =
    (await publicClient.readContract({
      address: config.contracts.AgentRegistry,
      abi: AgentRegistryABI,
      functionName: "getAgent",
      args: [agentId],
    })) as [`0x${string}`, bigint, number, bigint];

  console.log("\n=== Bootstrap Complete ===");
  console.log(`AgentId:    ${agentId}`);
  console.log(`Operator:   ${operator}`);
  console.log(`Owner:      ${ownerAccount.address}`);
  console.log(`Stake:      ${stakeAmount} (${Number(stakeAmount) / 1e6} USDC)`);
  console.log(`Tier:       ${tier === 1 ? "Bronze" : "None"}`);
  console.log(`Reputation: ${reputation}`);
  console.log(`IntentHash: ${intentHash}`);
  console.log(`\nTx Hashes:`);
  console.log(`  Register: ${registerHash ?? "skipped"}`);
  console.log(`  Approve:  ${approveHash ?? "skipped"}`);
  console.log(`  Stake:    ${stakeHash ?? "skipped"}`);
  console.log(`  Commit:   ${commitHash}`);
  console.log(`  Delegate: ${delegateHash}`);
  console.log(`  Owner USDC approve: ${ownerApproveHash}`);
}

async function ensureLocalMockUsdcBalance(
  publicClient: PublicClient,
  walletClient: WalletClient,
  token: Address,
  owner: Address,
  minimumBalance: bigint
): Promise<void> {
  const balance = (await publicClient.readContract({
    address: token,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: [owner],
  })) as bigint;

  if (balance >= minimumBalance) {
    return;
  }

  console.log(`\n[local] Minting MockUSDC to ${owner}...`);
  const mintHash = await (walletClient as any).writeContract({
    address: token,
    abi: [
      {
        type: "function",
        name: "mint",
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
      },
    ] as const,
    functionName: "mint",
    args: [owner, minimumBalance - balance],
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });
  console.log(`  tx: ${mintHash}`);
}

async function resolveNextIntentNonce(
  publicClient: PublicClient,
  intentRegistry: Address,
  owner: Address
): Promise<bigint> {
  const activeIntentHash = (await publicClient.readContract({
    address: intentRegistry,
    abi: IntentRegistryABI,
    functionName: "getActiveIntentHash",
    args: [owner],
  })) as Hex;

  if (/^0x0{64}$/.test(activeIntentHash)) {
    return 1n;
  }

  const [cfg] = (await publicClient.readContract({
    address: intentRegistry,
    abi: IntentRegistryABI,
    functionName: "getIntent",
    args: [activeIntentHash],
  })) as [
    {
      owner: Address;
      token: Address;
      maxSpendPerTx: bigint;
      maxSpendPerDay: bigint;
      allowedCounterparties: Address[];
      expiry: bigint;
      nonce: bigint;
    },
    string,
  ];

  return cfg.nonce + 1n;
}

function computeDemoIntentHash(
  cfg: {
    owner: Address;
    token: Address;
    maxSpendPerTx: bigint;
    maxSpendPerDay: bigint;
    allowedCounterparties: Address[];
    expiry: bigint;
    nonce: bigint;
  },
  manifestURI: string
): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { name: "owner", type: "address" },
        { name: "token", type: "address" },
        { name: "maxSpendPerTx", type: "uint256" },
        { name: "maxSpendPerDay", type: "uint256" },
        { name: "allowedCounterparties", type: "address[]" },
        { name: "expiry", type: "uint64" },
        { name: "nonce", type: "uint256" },
        { name: "manifestURI", type: "string" },
      ],
      [
        cfg.owner,
        cfg.token,
        cfg.maxSpendPerTx,
        cfg.maxSpendPerDay,
        cfg.allowedCounterparties,
        cfg.expiry,
        cfg.nonce,
        manifestURI,
      ]
    )
  );
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
