import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
    deployFixture,
    makeAgentId,
    makeIntentHash,
    signTraceAck,
    now,
    ONE_USDC,
    CHALLENGE_BOND,
    BRONZE_TIER_THRESHOLD,
    REASON,
} from "./_helpers";

// Mirrors spec §3.9 demo flow end-to-end.
describe("Integration — spec §3.9 demo flow", () => {
    it("legit → blocked → overspend → slash", async () => {
        const env = await loadFixture(deployFixture);
        const agentId = makeAgentId("demo-agent");
        const intentHash = makeIntentHash("demo-intent");
        const allowedTarget = ethers.Wallet.createRandom().address;
        const blockedTarget = ethers.Wallet.createRandom().address;
        const userAddr = await env.user.getAddress();
        const operatorAddr = await env.operator.getAddress();

        // --- Onboarding ---------------------------------------------------------
        await env.usdc.mint(userAddr, 1000n * ONE_USDC);
        await env.usdc
            .connect(env.user)
            .approve(await env.guardedExecutor.getAddress(), 1000n * ONE_USDC);

        const cfg = {
            owner: userAddr,
            token: await env.usdc.getAddress(),
            maxSpendPerTx: 5n * ONE_USDC,
            maxSpendPerDay: 100n * ONE_USDC,
            allowedCounterparties: [allowedTarget],
            expiry: (await now()) + 3600n,
            nonce: 1n,
        };
        await env.intentRegistry.connect(env.user).commitIntent(intentHash, cfg, "ipfs://m");

        await env.agentRegistry.registerAgent(agentId, operatorAddr, "");
        await env.usdc.mint(operatorAddr, BRONZE_TIER_THRESHOLD);
        await env.usdc
            .connect(env.operator)
            .approve(await env.stakeVault.getAddress(), BRONZE_TIER_THRESHOLD);
        await env.agentRegistry.connect(env.operator).stake(agentId, BRONZE_TIER_THRESHOLD);

        await env.guardedExecutor
            .connect(env.user)
            .setAgentDelegate(agentId, await env.delegate.getAddress(), true);

        // --- Helper: build a signed ExecutionRequest ---------------------------
        async function signedReq(target: string, amount: bigint) {
            const traceURI = `ipfs://trace-${amount.toString()}`;
            const uriHash = ethers.keccak256(ethers.toUtf8Bytes(traceURI));
            const contextDigest = ethers.keccak256(
                ethers.toUtf8Bytes(`ctx-${target}-${amount.toString()}`),
            );
            const expiresAt = (await now()) + 600n;
            const signature = await signTraceAck(
                env.traceSignerWallet,
                await env.guardedExecutor.getAddress(),
                env.chainId,
                {
                    contextDigest,
                    uriHash,
                    expiresAt,
                    guardedExecutor: await env.guardedExecutor.getAddress(),
                    chainId: env.chainId,
                    agentId,
                    owner: userAddr,
                },
            );
            return {
                owner: userAddr,
                agentId,
                target,
                token: await env.usdc.getAddress(),
                amount,
                data: "0x",
                traceURI,
                traceAck: { contextDigest, uriHash, expiresAt, signature },
            };
        }

        // --- Step 1: legit 2 USDC spend succeeds -------------------------------
        const legit = await signedReq(allowedTarget, 2n * ONE_USDC);
        const legitBefore = await env.usdc.balanceOf(allowedTarget);
        await env.guardedExecutor.connect(env.delegate).executeWithGuard(legit);
        expect(await env.usdc.balanceOf(allowedTarget)).to.eq(legitBefore + 2n * ONE_USDC);

        // --- Step 2: blocked counterparty ---------------------------------------
        const blocked = await signedReq(blockedTarget, 1n * ONE_USDC);
        const [blockedDecision, blockedReason] = await env.guardedExecutor
            .connect(env.delegate)
            .preflightCheck(blocked);
        expect(blockedDecision).to.eq(2n); // RED
        expect(blockedReason).to.eq(REASON.COUNTERPARTY_NOT_ALLOWED);
        await expect(env.guardedExecutor.connect(env.delegate).executeWithGuard(blocked))
            .to.be.revertedWithCustomError(env.guardedExecutor, "GuardRejected")
            .withArgs(REASON.COUNTERPARTY_NOT_ALLOWED);

        // --- Step 3: overspend 15 USDC ------------------------------------------
        // NOT hard-blocked: exceeds maxSpendPerTx but within maxSpendPerDay.
        const overspend = await signedReq(allowedTarget, 15n * ONE_USDC);
        const overspendTargetBefore = await env.usdc.balanceOf(allowedTarget);
        await env.guardedExecutor.connect(env.delegate).executeWithGuard(overspend);
        expect(await env.usdc.balanceOf(allowedTarget)).to.eq(overspendTargetBefore + 15n * ONE_USDC);

        const overspendReceiptId = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "bytes32", "uint256", "uint256", "address"],
                [userAddr, agentId, 1n, env.chainId, await env.guardedExecutor.getAddress()],
            ),
        );

        // --- Step 4: fileAmountViolation ----------------------------------------
        await env.usdc.mint(await env.challenger.getAddress(), CHALLENGE_BOND);
        await env.usdc
            .connect(env.challenger)
            .approve(await env.challengeArbiter.getAddress(), CHALLENGE_BOND);

        const userBalBefore = await env.usdc.balanceOf(userAddr);
        const stakeBefore = await env.stakeVault.stakeOf(agentId);

        await expect(
            env.challengeArbiter.connect(env.challenger).fileAmountViolation(overspendReceiptId),
        )
            .to.emit(env.challengeArbiter, "ChallengeFiled")
            .and.to.emit(env.challengeArbiter, "ChallengeResolved");

        // --- Final invariants ---------------------------------------------------
        expect(await env.usdc.balanceOf(userAddr)).to.eq(userBalBefore + 15n * ONE_USDC);
        expect(await env.stakeVault.stakeOf(agentId)).to.eq(stakeBefore - 15n * ONE_USDC);
        // Challenger is net-zero: bond refunded.
        // (bond minted then approved; after file it's returned, so balance == 1 USDC remaining from mint)
        expect(await env.usdc.balanceOf(await env.challenger.getAddress())).to.eq(CHALLENGE_BOND);
    });
});
