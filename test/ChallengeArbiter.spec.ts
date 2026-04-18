import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
    deployFixture,
    makeAgentId,
    makeIntentHash,
    signTraceAck,
    now,
    ONE_USDC,
    CHALLENGE_BOND,
    BRONZE_TIER_THRESHOLD,
    BRONZE_CHALLENGE_WINDOW,
} from "./_helpers";

// Full fixture: deploy + commit intent + register + stake + delegate + execute one overspend.
// Returns the receiptId so tests can file challenges against it.
async function overspendFixture() {
    const env = await loadFixture(deployFixture);
    const agentId = makeAgentId("ca-agent");
    const intentHash = makeIntentHash("ca-intent");
    const target = ethers.Wallet.createRandom().address;
    const userAddr = await env.user.getAddress();
    const operatorAddr = await env.operator.getAddress();

    // User funds + approves.
    await env.usdc.mint(userAddr, 1000n * ONE_USDC);
    await env.usdc
        .connect(env.user)
        .approve(await env.guardedExecutor.getAddress(), 1000n * ONE_USDC);

    // Intent: maxSpendPerTx = 5 USDC, maxSpendPerDay = 100 USDC (generous day cap
    // so amount-cap violation is isolated).
    const expiry = (await now()) + 3600n;
    const cfg = {
        owner: userAddr,
        token: await env.usdc.getAddress(),
        maxSpendPerTx: 5n * ONE_USDC,
        maxSpendPerDay: 100n * ONE_USDC,
        allowedCounterparties: [target],
        expiry,
        nonce: 1n,
    };
    await env.intentRegistry.connect(env.user).commitIntent(intentHash, cfg, "ipfs://m");

    // Register agent + Bronze stake.
    await env.agentRegistry.registerAgent(agentId, operatorAddr, "");
    await env.usdc.mint(operatorAddr, BRONZE_TIER_THRESHOLD);
    await env.usdc.connect(env.operator).approve(await env.stakeVault.getAddress(), BRONZE_TIER_THRESHOLD);
    await env.agentRegistry.connect(env.operator).stake(agentId, BRONZE_TIER_THRESHOLD);

    // Delegate approval.
    await env.guardedExecutor
        .connect(env.user)
        .setAgentDelegate(agentId, await env.delegate.getAddress(), true);

    // Sign TraceAck and execute 15 USDC (> maxSpendPerTx, within maxSpendPerDay).
    const traceURI = "ipfs://trace";
    const uriHash = ethers.keccak256(ethers.toUtf8Bytes(traceURI));
    const contextDigest = ethers.keccak256(ethers.toUtf8Bytes("ctx"));
    const ackExpiresAt = (await now()) + 600n;
    const signature = await signTraceAck(
        env.traceSignerWallet,
        await env.guardedExecutor.getAddress(),
        env.chainId,
        {
            contextDigest,
            uriHash,
            expiresAt: ackExpiresAt,
            guardedExecutor: await env.guardedExecutor.getAddress(),
            chainId: env.chainId,
            agentId,
            owner: userAddr,
        },
    );

    const overspendAmount = 15n * ONE_USDC;
    await env.guardedExecutor.connect(env.delegate).executeWithGuard({
        owner: userAddr,
        agentId,
        target,
        token: await env.usdc.getAddress(),
        amount: overspendAmount,
        data: "0x",
        traceURI,
        traceAck: { contextDigest, uriHash, expiresAt: ackExpiresAt, signature },
    });

    const receiptId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "bytes32", "uint256", "uint256", "address"],
            [userAddr, agentId, 0n, env.chainId, await env.guardedExecutor.getAddress()],
        ),
    );

    return { env, agentId, intentHash, target, userAddr, receiptId, overspendAmount };
}

describe("ChallengeArbiter", () => {
    it("fileAmountViolation: slashes operator, pays user, refunds bond", async () => {
        const f = await overspendFixture();
        const { env, receiptId, userAddr, overspendAmount } = f;

        // Challenger funds + approves.
        await env.usdc.mint(await env.challenger.getAddress(), CHALLENGE_BOND);
        await env.usdc
            .connect(env.challenger)
            .approve(await env.challengeArbiter.getAddress(), CHALLENGE_BOND);

        const userBefore = await env.usdc.balanceOf(userAddr);
        const challengerBefore = await env.usdc.balanceOf(await env.challenger.getAddress());

        await expect(env.challengeArbiter.connect(env.challenger).fileAmountViolation(receiptId))
            .to.emit(env.challengeArbiter, "ChallengeFiled")
            .and.to.emit(env.challengeArbiter, "ChallengeResolved");

        // User receives slashed stake = min(stake, overspend) = min(50, 15) = 15 USDC.
        expect(await env.usdc.balanceOf(userAddr)).to.eq(userBefore + overspendAmount);
        // Challenger net-zero (bond refunded).
        expect(await env.usdc.balanceOf(await env.challenger.getAddress())).to.eq(challengerBefore);
        // Operator stake reduced.
        expect(await env.stakeVault.stakeOf(f.agentId)).to.eq(BRONZE_TIER_THRESHOLD - overspendAmount);
    });

    it("reverts ReceiptNotFound for unknown receiptId", async () => {
        const env = await loadFixture(deployFixture);
        await expect(env.challengeArbiter.connect(env.challenger).fileAmountViolation(ethers.id("missing")))
            .to.be.revertedWithCustomError(env.challengeArbiter, "ReceiptNotFound");
    });

    it("reverts ChallengeWindowClosed after 72h", async () => {
        const f = await overspendFixture();
        await time.increase(Number(BRONZE_CHALLENGE_WINDOW) + 1);
        await f.env.usdc.mint(await f.env.challenger.getAddress(), CHALLENGE_BOND);
        await f.env.usdc
            .connect(f.env.challenger)
            .approve(await f.env.challengeArbiter.getAddress(), CHALLENGE_BOND);
        await expect(f.env.challengeArbiter.connect(f.env.challenger).fileAmountViolation(f.receiptId))
            .to.be.revertedWithCustomError(f.env.challengeArbiter, "ChallengeWindowClosed");
    });

    it("reverts NotOverspend when amount <= maxSpendPerTx", async () => {
        // Use a tweaked fixture where executed amount is within limit.
        const env = await loadFixture(deployFixture);
        const agentId = makeAgentId("under");
        const intentHash = makeIntentHash("under-i");
        const target = ethers.Wallet.createRandom().address;
        const userAddr = await env.user.getAddress();

        await env.usdc.mint(userAddr, 100n * ONE_USDC);
        await env.usdc.connect(env.user).approve(await env.guardedExecutor.getAddress(), 100n * ONE_USDC);

        const cfg = {
            owner: userAddr,
            token: await env.usdc.getAddress(),
            maxSpendPerTx: 10n * ONE_USDC,
            maxSpendPerDay: 100n * ONE_USDC,
            allowedCounterparties: [target],
            expiry: (await now()) + 3600n,
            nonce: 1n,
        };
        await env.intentRegistry.connect(env.user).commitIntent(intentHash, cfg, "");

        await env.agentRegistry.registerAgent(agentId, await env.operator.getAddress(), "");
        await env.usdc.mint(await env.operator.getAddress(), BRONZE_TIER_THRESHOLD);
        await env.usdc.connect(env.operator).approve(await env.stakeVault.getAddress(), BRONZE_TIER_THRESHOLD);
        await env.agentRegistry.connect(env.operator).stake(agentId, BRONZE_TIER_THRESHOLD);

        await env.guardedExecutor
            .connect(env.user)
            .setAgentDelegate(agentId, await env.delegate.getAddress(), true);

        const traceURI = "ipfs://t";
        const uriHash = ethers.keccak256(ethers.toUtf8Bytes(traceURI));
        const contextDigest = ethers.id("ctx2");
        const ackExpiresAt = (await now()) + 600n;
        const signature = await signTraceAck(
            env.traceSignerWallet,
            await env.guardedExecutor.getAddress(),
            env.chainId,
            {
                contextDigest,
                uriHash,
                expiresAt: ackExpiresAt,
                guardedExecutor: await env.guardedExecutor.getAddress(),
                chainId: env.chainId,
                agentId,
                owner: userAddr,
            },
        );

        await env.guardedExecutor.connect(env.delegate).executeWithGuard({
            owner: userAddr,
            agentId,
            target,
            token: await env.usdc.getAddress(),
            amount: 3n * ONE_USDC, // within cap
            data: "0x",
            traceURI,
            traceAck: { contextDigest, uriHash, expiresAt: ackExpiresAt, signature },
        });

        const receiptId = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "bytes32", "uint256", "uint256", "address"],
                [userAddr, agentId, 0n, env.chainId, await env.guardedExecutor.getAddress()],
            ),
        );

        await env.usdc.mint(await env.challenger.getAddress(), CHALLENGE_BOND);
        await env.usdc
            .connect(env.challenger)
            .approve(await env.challengeArbiter.getAddress(), CHALLENGE_BOND);

        await expect(env.challengeArbiter.connect(env.challenger).fileAmountViolation(receiptId))
            .to.be.revertedWithCustomError(env.challengeArbiter, "NotOverspend");
    });

    it("setReviewerSigner onlyOwner, rejects zero", async () => {
        const env = await loadFixture(deployFixture);
        await expect(
            env.challengeArbiter
                .connect(env.outsider)
                .setReviewerSigner(ethers.Wallet.createRandom().address),
        ).to.be.revertedWithCustomError(env.challengeArbiter, "OwnableUnauthorizedAccount");
        await expect(env.challengeArbiter.setReviewerSigner(ethers.ZeroAddress))
            .to.be.revertedWithCustomError(env.challengeArbiter, "ZeroSigner");
    });

    it("resolveByReviewer rejects bad signatures", async () => {
        const env = await loadFixture(deployFixture);
        // No challenge exists so we hit resolved-check via a fresh id; but the contract
        // checks `resolved` first (which is false for id=1) then signer. Feed any bytes.
        await expect(
            env.challengeArbiter.resolveByReviewer(1n, true, 0n, "0x" + "11".repeat(65)),
        ).to.be.revertedWithCustomError(env.challengeArbiter, "InvalidReviewerSignature");
    });
});
