import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
    deployFixture,
    makeAgentId,
    BRONZE_TIER_THRESHOLD,
    BRONZE_CHALLENGE_WINDOW,
} from "./_helpers";

describe("AgentRegistry", () => {
    it("registers an agent and emits", async () => {
        const env = await loadFixture(deployFixture);
        const id = makeAgentId("agent-1");
        await expect(
            env.agentRegistry.registerAgent(id, await env.operator.getAddress(), "ipfs://a"),
        )
            .to.emit(env.agentRegistry, "AgentRegistered")
            .withArgs(id, await env.operator.getAddress(), "ipfs://a");
    });

    it("rejects duplicate registration", async () => {
        const env = await loadFixture(deployFixture);
        const id = makeAgentId("agent-2");
        await env.agentRegistry.registerAgent(id, await env.operator.getAddress(), "");
        await expect(
            env.agentRegistry.registerAgent(id, await env.operator.getAddress(), ""),
        ).to.be.revertedWithCustomError(env.agentRegistry, "AgentAlreadyRegistered");
    });

    it("stake routes USDC to StakeVault and updates tier + window", async () => {
        const env = await loadFixture(deployFixture);
        const id = makeAgentId("agent-3");
        await env.agentRegistry.registerAgent(id, await env.operator.getAddress(), "");

        // Operator funds and approves the vault.
        await env.usdc.mint(await env.operator.getAddress(), BRONZE_TIER_THRESHOLD);
        await env.usdc
            .connect(env.operator)
            .approve(await env.stakeVault.getAddress(), BRONZE_TIER_THRESHOLD);

        await expect(env.agentRegistry.connect(env.operator).stake(id, BRONZE_TIER_THRESHOLD))
            .to.emit(env.agentRegistry, "AgentStaked")
            .withArgs(id, BRONZE_TIER_THRESHOLD, BRONZE_TIER_THRESHOLD);

        const [op, stakeAmount, tier] = await env.agentRegistry.getAgent(id);
        expect(op).to.eq(await env.operator.getAddress());
        expect(stakeAmount).to.eq(BRONZE_TIER_THRESHOLD);
        expect(tier).to.eq(1n); // Bronze
        expect(await env.agentRegistry.challengeWindow(id)).to.eq(BRONZE_CHALLENGE_WINDOW);
    });

    it("below-threshold stake yields Tier.None and window=0", async () => {
        const env = await loadFixture(deployFixture);
        const id = makeAgentId("agent-4");
        await env.agentRegistry.registerAgent(id, await env.operator.getAddress(), "");

        const small = BRONZE_TIER_THRESHOLD - 1n;
        await env.usdc.mint(await env.operator.getAddress(), small);
        await env.usdc.connect(env.operator).approve(await env.stakeVault.getAddress(), small);
        await env.agentRegistry.connect(env.operator).stake(id, small);

        const [, , tier] = await env.agentRegistry.getAgent(id);
        expect(tier).to.eq(0n);
        expect(await env.agentRegistry.challengeWindow(id)).to.eq(0n);
    });

    it("only operator can stake", async () => {
        const env = await loadFixture(deployFixture);
        const id = makeAgentId("agent-5");
        await env.agentRegistry.registerAgent(id, await env.operator.getAddress(), "");
        await expect(env.agentRegistry.connect(env.outsider).stake(id, 1n))
            .to.be.revertedWithCustomError(env.agentRegistry, "NotAgentOperator");
    });

    it("rejects zero stake and unknown agent", async () => {
        const env = await loadFixture(deployFixture);
        const id = makeAgentId("agent-6");
        await env.agentRegistry.registerAgent(id, await env.operator.getAddress(), "");
        await expect(env.agentRegistry.connect(env.operator).stake(id, 0n))
            .to.be.revertedWithCustomError(env.agentRegistry, "ZeroStake");
        await expect(
            env.agentRegistry.connect(env.operator).stake(ethers.id("missing"), 1n),
        ).to.be.revertedWithCustomError(env.agentRegistry, "AgentNotRegistered");
    });
});
