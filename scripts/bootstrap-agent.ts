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
} from "viem";
import { baseSepolia } from "viem/chains";
import {
  loadDeploymentConfig,
  AgentRegistryABI,
  ERC20ABI,
  loadRuntimeEnv,
} from "../packages/trace/src/index.js";

const STAKE_AMOUNT = 50_000_000n; // 50 USDC (6 decimals)

async function main() {
  const runtime = loadRuntimeEnv();
  const config = loadDeploymentConfig();
  const account = runtime.account;

  console.log("=== IntentGuard Agent Bootstrap ===");
  console.log(`Operator:  ${account.address}`);
  console.log(`Chain:     Base Sepolia (${config.chainId})`);
  console.log(`RPC:       ${runtime.rpcUrl}`);

  const transport = http(runtime.rpcUrl);

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
  const agentId = runtime.agentId;
  console.log(`AgentId:   ${agentId}`);

  // 2. Register agent
  console.log("\n[1/3] Registering agent...");
  const registerHash = await walletClient.writeContract({
    address: config.contracts.AgentRegistry,
    abi: AgentRegistryABI,
    functionName: "registerAgent",
    args: [agentId, account.address, runtime.agentMetadataUri],
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
