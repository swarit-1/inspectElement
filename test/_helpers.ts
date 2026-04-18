import { ethers } from "hardhat";
import type { HDNodeWallet, Signer } from "ethers";

// ---------------------------------------------------------------------------
// Constants mirrored from GuardConstants.sol. Any drift here is a test bug.
// ---------------------------------------------------------------------------
export const EIP712_DOMAIN_NAME = "IntentGuard";
export const EIP712_DOMAIN_VERSION = "1";

export const ONE_USDC = 1_000_000n;
export const CHALLENGE_BOND = 1_000_000n; // 1 USDC
export const BRONZE_TIER_THRESHOLD = 50_000_000n; // 50 USDC
export const BRONZE_CHALLENGE_WINDOW = 72n * 3600n; // 72 hours
export const MAX_COUNTERPARTIES = 8n;

export const REASON = {
    COUNTERPARTY_NOT_ALLOWED: ethers.id("COUNTERPARTY_NOT_ALLOWED"),
    TOKEN_NOT_USDC: ethers.id("TOKEN_NOT_USDC"),
    INTENT_EXPIRED: ethers.id("INTENT_EXPIRED"),
    DAY_CAP_EXCEEDED: ethers.id("DAY_CAP_EXCEEDED"),
    DELEGATE_NOT_APPROVED: ethers.id("DELEGATE_NOT_APPROVED"),
    TRACE_ACK_INVALID: ethers.id("TRACE_ACK_INVALID"),
    TRACE_ACK_EXPIRED: ethers.id("TRACE_ACK_EXPIRED"),
    NO_ACTIVE_INTENT: ethers.id("NO_ACTIVE_INTENT"),
} as const;

// ---------------------------------------------------------------------------
// EIP-712 TraceAck signing.
// ---------------------------------------------------------------------------
export interface TraceAckInput {
    contextDigest: string;
    uriHash: string;
    expiresAt: bigint;
    guardedExecutor: string;
    chainId: bigint;
    agentId: string;
    owner: string;
}

export async function signTraceAck(
    signer: HDNodeWallet,
    executor: string,
    chainId: bigint,
    ack: TraceAckInput,
): Promise<string> {
    const domain = {
        name: EIP712_DOMAIN_NAME,
        version: EIP712_DOMAIN_VERSION,
        chainId,
        verifyingContract: executor,
    };
    const types = {
        TraceAck: [
            { name: "contextDigest", type: "bytes32" },
            { name: "uriHash", type: "bytes32" },
            { name: "expiresAt", type: "uint64" },
            { name: "guardedExecutor", type: "address" },
            { name: "chainId", type: "uint256" },
            { name: "agentId", type: "bytes32" },
            { name: "owner", type: "address" },
        ],
    };
    return signer.signTypedData(domain, types, ack);
}

// ---------------------------------------------------------------------------
// Deploy fixture.
// ---------------------------------------------------------------------------
export interface DeployedEnv {
    deployer: Signer;
    user: Signer;
    delegate: Signer;
    operator: Signer;
    challenger: Signer;
    outsider: Signer;
    traceSignerWallet: HDNodeWallet;
    reviewerWallet: HDNodeWallet;
    chainId: bigint;
    usdc: any;
    intentRegistry: any;
    stakeVault: any;
    guardedExecutor: any;
    agentRegistry: any;
    challengeArbiter: any;
}

export async function deployFixture(): Promise<DeployedEnv> {
    const [deployer, user, delegate, operator, challenger, outsider] = await ethers.getSigners();

    // Deterministic off-chain signers (not tied to hardhat accounts).
    const traceSignerWallet = ethers.Wallet.createRandom();
    const reviewerWallet = ethers.Wallet.createRandom();

    const chainId = (await ethers.provider.getNetwork()).chainId;

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const IntentRegistry = await ethers.getContractFactory("IntentRegistry");
    const intentRegistry = await IntentRegistry.deploy(await usdc.getAddress());
    await intentRegistry.waitForDeployment();

    const StakeVault = await ethers.getContractFactory("StakeVault");
    const stakeVault = await StakeVault.connect(deployer).deploy(await usdc.getAddress());
    await stakeVault.waitForDeployment();

    const GuardedExecutor = await ethers.getContractFactory("GuardedExecutor");
    const guardedExecutor = await GuardedExecutor.deploy(
        await usdc.getAddress(),
        await intentRegistry.getAddress(),
        traceSignerWallet.address,
        await deployer.getAddress(),
    );
    await guardedExecutor.waitForDeployment();

    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const agentRegistry = await AgentRegistry.deploy(
        await usdc.getAddress(),
        await stakeVault.getAddress(),
    );
    await agentRegistry.waitForDeployment();

    const ChallengeArbiter = await ethers.getContractFactory("ChallengeArbiter");
    const challengeArbiter = await ChallengeArbiter.deploy(
        await usdc.getAddress(),
        await stakeVault.getAddress(),
        await agentRegistry.getAddress(),
        await intentRegistry.getAddress(),
        await guardedExecutor.getAddress(),
        reviewerWallet.address,
        await deployer.getAddress(),
    );
    await challengeArbiter.waitForDeployment();

    await stakeVault.connect(deployer).setWiring(
        await agentRegistry.getAddress(),
        await challengeArbiter.getAddress(),
    );

    return {
        deployer,
        user,
        delegate,
        operator,
        challenger,
        outsider,
        traceSignerWallet,
        reviewerWallet,
        chainId,
        usdc,
        intentRegistry,
        stakeVault,
        guardedExecutor,
        agentRegistry,
        challengeArbiter,
    };
}

// ---------------------------------------------------------------------------
// Small helpers.
// ---------------------------------------------------------------------------
export function makeAgentId(seed: string): string {
    return ethers.id(seed);
}

export function makeIntentHash(seed: string): string {
    return ethers.id(seed);
}

export async function now(): Promise<bigint> {
    const block = await ethers.provider.getBlock("latest");
    return BigInt(block!.timestamp);
}
