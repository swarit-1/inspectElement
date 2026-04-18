import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFixture, makeIntentHash, now, MAX_COUNTERPARTIES } from "./_helpers";

describe("IntentRegistry", () => {
    async function baseCfg(user: string, usdc: string, nonce: bigint, expiry: bigint) {
        return {
            owner: user,
            token: usdc,
            maxSpendPerTx: 5_000_000n,
            maxSpendPerDay: 20_000_000n,
            allowedCounterparties: [ethers.Wallet.createRandom().address],
            expiry,
            nonce,
        };
    }

    it("commits an intent and exposes it via views", async () => {
        const env = await loadFixture(deployFixture);
        const hash = makeIntentHash("A");
        const cfg = await baseCfg(
            await env.user.getAddress(),
            await env.usdc.getAddress(),
            1n,
            (await now()) + 3600n,
        );
        await expect(env.intentRegistry.connect(env.user).commitIntent(hash, cfg, "ipfs://m"))
            .to.emit(env.intentRegistry, "IntentCommitted")
            .withArgs(await env.user.getAddress(), hash, "ipfs://m");
        expect(await env.intentRegistry.getActiveIntentHash(await env.user.getAddress())).to.eq(hash);
        const [stored, uri] = await env.intentRegistry.getIntent(hash);
        expect(stored.nonce).to.eq(1n);
        expect(uri).to.eq("ipfs://m");
    });

    it("rejects cfg.owner != msg.sender", async () => {
        const env = await loadFixture(deployFixture);
        const cfg = await baseCfg(
            await env.outsider.getAddress(),
            await env.usdc.getAddress(),
            1n,
            (await now()) + 3600n,
        );
        await expect(env.intentRegistry.connect(env.user).commitIntent(makeIntentHash("B"), cfg, ""))
            .to.be.revertedWithCustomError(env.intentRegistry, "NotConfigOwner");
    });

    it("rejects non-USDC token", async () => {
        const env = await loadFixture(deployFixture);
        const cfg = await baseCfg(
            await env.user.getAddress(),
            ethers.Wallet.createRandom().address,
            1n,
            (await now()) + 3600n,
        );
        await expect(env.intentRegistry.connect(env.user).commitIntent(makeIntentHash("C"), cfg, ""))
            .to.be.revertedWithCustomError(env.intentRegistry, "TokenNotUsdc");
    });

    it("rejects counterparty list > MAX_COUNTERPARTIES", async () => {
        const env = await loadFixture(deployFixture);
        const cps = [];
        for (let i = 0; i < Number(MAX_COUNTERPARTIES) + 1; i++) {
            cps.push(ethers.Wallet.createRandom().address);
        }
        const cfg = {
            owner: await env.user.getAddress(),
            token: await env.usdc.getAddress(),
            maxSpendPerTx: 1n,
            maxSpendPerDay: 1n,
            allowedCounterparties: cps,
            expiry: (await now()) + 3600n,
            nonce: 1n,
        };
        await expect(env.intentRegistry.connect(env.user).commitIntent(makeIntentHash("D"), cfg, ""))
            .to.be.revertedWithCustomError(env.intentRegistry, "CounterpartyListTooLong");
    });

    it("rejects expiry <= now and expiry == 0", async () => {
        const env = await loadFixture(deployFixture);
        const past = await baseCfg(
            await env.user.getAddress(),
            await env.usdc.getAddress(),
            1n,
            (await now()) - 1n,
        );
        await expect(env.intentRegistry.connect(env.user).commitIntent(makeIntentHash("E1"), past, ""))
            .to.be.revertedWithCustomError(env.intentRegistry, "IntentAlreadyExpired");
        const zero = await baseCfg(
            await env.user.getAddress(),
            await env.usdc.getAddress(),
            1n,
            0n,
        );
        await expect(env.intentRegistry.connect(env.user).commitIntent(makeIntentHash("E2"), zero, ""))
            .to.be.revertedWithCustomError(env.intentRegistry, "IntentAlreadyExpired");
    });

    it("rejects nonce not strictly increasing", async () => {
        const env = await loadFixture(deployFixture);
        const first = await baseCfg(
            await env.user.getAddress(),
            await env.usdc.getAddress(),
            5n,
            (await now()) + 3600n,
        );
        await env.intentRegistry.connect(env.user).commitIntent(makeIntentHash("F1"), first, "");
        const second = await baseCfg(
            await env.user.getAddress(),
            await env.usdc.getAddress(),
            5n,
            (await now()) + 3600n,
        );
        await expect(env.intentRegistry.connect(env.user).commitIntent(makeIntentHash("F2"), second, ""))
            .to.be.revertedWithCustomError(env.intentRegistry, "NonceNotStrictlyIncreasing");
    });

    it("rejects re-using an existing intentHash", async () => {
        const env = await loadFixture(deployFixture);
        const hash = makeIntentHash("G");
        const cfg1 = await baseCfg(
            await env.user.getAddress(),
            await env.usdc.getAddress(),
            1n,
            (await now()) + 3600n,
        );
        await env.intentRegistry.connect(env.user).commitIntent(hash, cfg1, "");
        const cfg2 = await baseCfg(
            await env.outsider.getAddress(),
            await env.usdc.getAddress(),
            1n,
            (await now()) + 3600n,
        );
        await expect(env.intentRegistry.connect(env.outsider).commitIntent(hash, cfg2, ""))
            .to.be.revertedWithCustomError(env.intentRegistry, "IntentHashMismatch");
    });

    it("revoke clears active hash and emits", async () => {
        const env = await loadFixture(deployFixture);
        const hash = makeIntentHash("H");
        const cfg = await baseCfg(
            await env.user.getAddress(),
            await env.usdc.getAddress(),
            1n,
            (await now()) + 3600n,
        );
        await env.intentRegistry.connect(env.user).commitIntent(hash, cfg, "");
        await expect(env.intentRegistry.connect(env.user).revokeIntent())
            .to.emit(env.intentRegistry, "IntentRevoked")
            .withArgs(await env.user.getAddress(), hash);
        expect(await env.intentRegistry.getActiveIntentHash(await env.user.getAddress())).to.eq(ethers.ZeroHash);
    });

    it("revokeIntent with no active reverts NotIntentOwner", async () => {
        const env = await loadFixture(deployFixture);
        await expect(env.intentRegistry.connect(env.user).revokeIntent())
            .to.be.revertedWithCustomError(env.intentRegistry, "NotIntentOwner");
    });
});
