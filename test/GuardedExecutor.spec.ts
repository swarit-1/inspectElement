import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
    deployFixture,
    makeAgentId,
    makeIntentHash,
    signTraceAck,
    now,
    REASON,
    ONE_USDC,
} from "./_helpers";

describe("GuardedExecutor", () => {
    // --- Scenario builder ------------------------------------------------------
    async function setup() {
        const env = await loadFixture(deployFixture);

        const agentId = makeAgentId("gx-agent");
        const intentHash = makeIntentHash("gx-intent");
        const target = ethers.Wallet.createRandom().address;
        const userAddr = await env.user.getAddress();

        // Fund + approve USDC.
        await env.usdc.mint(userAddr, 1000n * ONE_USDC);
        await env.usdc
            .connect(env.user)
            .approve(await env.guardedExecutor.getAddress(), 1000n * ONE_USDC);

        // Commit intent.
        const expiry = (await now()) + 3600n;
        const cfg = {
            owner: userAddr,
            token: await env.usdc.getAddress(),
            maxSpendPerTx: 5n * ONE_USDC,
            maxSpendPerDay: 10n * ONE_USDC,
            allowedCounterparties: [target],
            expiry,
            nonce: 1n,
        };
        await env.intentRegistry.connect(env.user).commitIntent(intentHash, cfg, "ipfs://m");

        // Approve delegate.
        await env.guardedExecutor
            .connect(env.user)
            .setAgentDelegate(agentId, await env.delegate.getAddress(), true);

        return { env, agentId, intentHash, target, userAddr, cfg, expiry };
    }

    async function buildReq(
        env: Awaited<ReturnType<typeof setup>>["env"],
        userAddr: string,
        agentId: string,
        target: string,
        amount: bigint,
        overrides: Partial<{
            token: string;
            traceURI: string;
            uriHash: string;
            contextDigest: string;
            ackExpiresAt: bigint;
            signerWallet: Parameters<typeof signTraceAck>[0];
        }> = {},
    ) {
        const traceURI = overrides.traceURI ?? "ipfs://trace";
        const uriHash = overrides.uriHash ?? ethers.keccak256(ethers.toUtf8Bytes(traceURI));
        const contextDigest = overrides.contextDigest ?? ethers.keccak256(ethers.toUtf8Bytes("ctx"));
        const ackExpiresAt = overrides.ackExpiresAt ?? (await now()) + 600n;
        const signer = overrides.signerWallet ?? env.traceSignerWallet;

        const signature = await signTraceAck(
            signer,
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

        return {
            owner: userAddr,
            agentId,
            target,
            token: overrides.token ?? (await env.usdc.getAddress()),
            amount,
            data: "0x",
            traceURI,
            traceAck: { contextDigest, uriHash, expiresAt: ackExpiresAt, signature },
        };
    }

    // --- Delegate mgmt ---------------------------------------------------------
    it("setAgentDelegate emits and updates view", async () => {
        const env = await loadFixture(deployFixture);
        const agentId = makeAgentId("d1");
        await expect(
            env.guardedExecutor
                .connect(env.user)
                .setAgentDelegate(agentId, await env.delegate.getAddress(), true),
        )
            .to.emit(env.guardedExecutor, "AgentDelegateSet")
            .withArgs(await env.user.getAddress(), agentId, await env.delegate.getAddress(), true);
        expect(
            await env.guardedExecutor.isDelegateApproved(
                await env.user.getAddress(),
                agentId,
                await env.delegate.getAddress(),
            ),
        ).to.eq(true);
    });

    // --- Happy path ------------------------------------------------------------
    it("executeWithGuard transfers USDC, increments day + nonce, stores receipt", async () => {
        const s = await setup();
        const req = await buildReq(s.env, s.userAddr, s.agentId, s.target, 2n * ONE_USDC);

        const before = await s.env.usdc.balanceOf(s.target);
        const tx = await s.env.guardedExecutor.connect(s.env.delegate).executeWithGuard(req);
        const rc = await tx.wait();

        expect(await s.env.usdc.balanceOf(s.target)).to.eq(before + 2n * ONE_USDC);
        expect(await s.env.guardedExecutor.spentToday(s.userAddr)).to.eq(2n * ONE_USDC);
        expect(await s.env.guardedExecutor.execNonce(s.userAddr)).to.eq(1n);

        // Derive receiptId off-chain per canonical formula.
        const receiptId = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "bytes32", "uint256", "uint256", "address"],
                [s.userAddr, s.agentId, 0n, s.env.chainId, await s.env.guardedExecutor.getAddress()],
            ),
        );
        const r = await s.env.guardedExecutor.getReceipt(receiptId);
        expect(r.owner).to.eq(s.userAddr);
        expect(r.amount).to.eq(2n * ONE_USDC);
        expect(r.intentHash).to.eq(s.intentHash);

        // ActionReceipt event present.
        const ev = rc!.logs
            .map((l) => {
                try {
                    return s.env.guardedExecutor.interface.parseLog(l);
                } catch {
                    return null;
                }
            })
            .find((p) => p && p.name === "ActionReceipt");
        expect(ev).to.not.eq(undefined);
    });

    // --- Reason codes via preflight -------------------------------------------
    it("DELEGATE_NOT_APPROVED when caller is not an approved delegate", async () => {
        const s = await setup();
        const req = await buildReq(s.env, s.userAddr, s.agentId, s.target, 1n * ONE_USDC);
        const [decision, reason] = await s.env.guardedExecutor
            .connect(s.env.outsider)
            .preflightCheck(req);
        expect(decision).to.eq(2n); // RED
        expect(reason).to.eq(REASON.DELEGATE_NOT_APPROVED);
        await expect(s.env.guardedExecutor.connect(s.env.outsider).executeWithGuard(req))
            .to.be.revertedWithCustomError(s.env.guardedExecutor, "GuardRejected")
            .withArgs(REASON.DELEGATE_NOT_APPROVED);
    });

    it("TOKEN_NOT_USDC", async () => {
        const s = await setup();
        const req = await buildReq(s.env, s.userAddr, s.agentId, s.target, 1n * ONE_USDC, {
            token: ethers.Wallet.createRandom().address,
        });
        await expect(s.env.guardedExecutor.connect(s.env.delegate).executeWithGuard(req))
            .to.be.revertedWithCustomError(s.env.guardedExecutor, "GuardRejected")
            .withArgs(REASON.TOKEN_NOT_USDC);
    });

    it("NO_ACTIVE_INTENT after revoke", async () => {
        const s = await setup();
        await s.env.intentRegistry.connect(s.env.user).revokeIntent();
        const req = await buildReq(s.env, s.userAddr, s.agentId, s.target, 1n * ONE_USDC);
        const [, reason] = await s.env.guardedExecutor.connect(s.env.delegate).preflightCheck(req);
        expect(reason).to.eq(REASON.NO_ACTIVE_INTENT);
    });

    it("INTENT_EXPIRED after fast-forward", async () => {
        const s = await setup();
        await time.increaseTo(Number(s.expiry) + 1);
        const req = await buildReq(s.env, s.userAddr, s.agentId, s.target, 1n * ONE_USDC);
        const [, reason] = await s.env.guardedExecutor.connect(s.env.delegate).preflightCheck(req);
        expect(reason).to.eq(REASON.INTENT_EXPIRED);
    });

    it("COUNTERPARTY_NOT_ALLOWED", async () => {
        const s = await setup();
        const req = await buildReq(
            s.env,
            s.userAddr,
            s.agentId,
            ethers.Wallet.createRandom().address, // not in allowlist
            1n * ONE_USDC,
        );
        await expect(s.env.guardedExecutor.connect(s.env.delegate).executeWithGuard(req))
            .to.be.revertedWithCustomError(s.env.guardedExecutor, "GuardRejected")
            .withArgs(REASON.COUNTERPARTY_NOT_ALLOWED);
    });

    it("DAY_CAP_EXCEEDED", async () => {
        const s = await setup();
        // cap is 10 USDC; first spend 8, then try 3 more.
        const r1 = await buildReq(s.env, s.userAddr, s.agentId, s.target, 8n * ONE_USDC);
        await s.env.guardedExecutor.connect(s.env.delegate).executeWithGuard(r1);
        const r2 = await buildReq(s.env, s.userAddr, s.agentId, s.target, 3n * ONE_USDC);
        await expect(s.env.guardedExecutor.connect(s.env.delegate).executeWithGuard(r2))
            .to.be.revertedWithCustomError(s.env.guardedExecutor, "GuardRejected")
            .withArgs(REASON.DAY_CAP_EXCEEDED);
    });

    it("TRACE_ACK_EXPIRED", async () => {
        const s = await setup();
        const req = await buildReq(s.env, s.userAddr, s.agentId, s.target, 1n * ONE_USDC, {
            ackExpiresAt: (await now()) - 1n,
        });
        await expect(s.env.guardedExecutor.connect(s.env.delegate).executeWithGuard(req))
            .to.be.revertedWithCustomError(s.env.guardedExecutor, "GuardRejected")
            .withArgs(REASON.TRACE_ACK_EXPIRED);
    });

    it("TRACE_ACK_INVALID — uriHash mismatch", async () => {
        const s = await setup();
        const req = await buildReq(s.env, s.userAddr, s.agentId, s.target, 1n * ONE_USDC, {
            uriHash: ethers.id("tampered"), // doesn't match keccak256(traceURI)
        });
        await expect(s.env.guardedExecutor.connect(s.env.delegate).executeWithGuard(req))
            .to.be.revertedWithCustomError(s.env.guardedExecutor, "GuardRejected")
            .withArgs(REASON.TRACE_ACK_INVALID);
    });

    it("TRACE_ACK_INVALID — wrong signer", async () => {
        const s = await setup();
        const attacker = ethers.Wallet.createRandom();
        const req = await buildReq(s.env, s.userAddr, s.agentId, s.target, 1n * ONE_USDC, {
            signerWallet: attacker,
        });
        await expect(s.env.guardedExecutor.connect(s.env.delegate).executeWithGuard(req))
            .to.be.revertedWithCustomError(s.env.guardedExecutor, "GuardRejected")
            .withArgs(REASON.TRACE_ACK_INVALID);
    });

    // --- Admin -----------------------------------------------------------------
    it("setTraceAckSigner onlyOwner, rejects zero", async () => {
        const env = await loadFixture(deployFixture);
        await expect(
            env.guardedExecutor.connect(env.outsider).setTraceAckSigner(ethers.Wallet.createRandom().address),
        ).to.be.revertedWithCustomError(env.guardedExecutor, "OwnableUnauthorizedAccount");
        await expect(env.guardedExecutor.setTraceAckSigner(ethers.ZeroAddress))
            .to.be.revertedWithCustomError(env.guardedExecutor, "ZeroSigner");

        const next = ethers.Wallet.createRandom().address;
        await expect(env.guardedExecutor.setTraceAckSigner(next))
            .to.emit(env.guardedExecutor, "TraceAckSignerUpdated")
            .withArgs(env.traceSignerWallet.address, next);
    });
});
