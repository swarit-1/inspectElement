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
  keccak256,
  encodePacked,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import {
  loadDeploymentConfig,
  AgentRegistryABI,
  ERC20ABI,
} from "../packages/trace/src/index.js";

const STAKE_AMOUNT = 50_000_000n; // 50 USDC (6 decimals)
const METADATA_URI = "ipfs://stub/agent-metadata";

async function main() {
  const operatorKey = process.env.OPERATOR_PRIVATE_KEY as Hex | undefined;
  if (!operatorKey) {
    console.error("Error: OPERATOR_PRIVATE_KEY env var required");
    process.exit(1);
  }

  const salt = process.env.AGENT_SALT ?? "intentguard-demo-agent-v1";
  const rpcUrl =
    process.env.RPC_URL ?? "https://sepolia.base.org";

  const config = loadDeploymentConfig();
  const account = privateKeyToAccount(operatorKey);

  console.log("=== IntentGuard Agent Bootstrap ===");
  console.log(`Operator:  ${account.address}`);
  console.log(`Chain:     Base Sepolia (${config.chainId})`);

  const transport = http(rpcUrl);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport,
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport,
  });

  // 1. Derive agentId
  const agentId = keccak256(
    encodePacked(["address", "string"], [account.address, salt])
  );
  console.log(`AgentId:   ${agentId}`);

  // 2. Register agent
  console.log("\n[1/3] Registering agent...");
  const registerHash = await walletClient.writeContract({
    address: config.contracts.AgentRegistry,
    abi: AgentRegistryABI,
    functionName: "registerAgent",
    args: [agentId, account.address, METADATA_URI],
  });
  console.log(`  tx: ${registerHash}`);
  await publicClient.waitForTransactionReceipt({ hash: registerHash });
  console.log("  confirmed.");

  // 3. Approve USDC for StakeVault
  console.log("\n[2/3] Approving USDC for StakeVault...");
  const approveHash = await walletClient.writeContract({
    address: config.contracts.USDC,
    abi: ERC20ABI,
    functionName: "approve",
    args: [config.contracts.StakeVault, STAKE_AMOUNT],
  });
  console.log(`  tx: ${approveHash}`);
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log("  confirmed.");

  // 4. Stake
  console.log("\n[3/3] Staking 50 USDC...");
  const stakeHash = await walletClient.writeContract({
    address: config.contracts.AgentRegistry,
    abi: AgentRegistryABI,
    functionName: "stake",
    args: [agentId, STAKE_AMOUNT],
  });
  console.log(`  tx: ${stakeHash}`);
  await publicClient.waitForTransactionReceipt({ hash: stakeHash });
  console.log("  confirmed.");

  // 5. Verify
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
  console.log(`Stake:      ${stakeAmount} (${Number(stakeAmount) / 1e6} USDC)`);
  console.log(`Tier:       ${tier === 1 ? "Bronze" : "None"}`);
  console.log(`Reputation: ${reputation}`);
  console.log(`\nTx Hashes:`);
  console.log(`  Register: ${registerHash}`);
  console.log(`  Approve:  ${approveHash}`);
  console.log(`  Stake:    ${stakeHash}`);
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
