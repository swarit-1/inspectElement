import { describe, expect, it } from "vitest";
import {
  getAddress,
  hashTypedData,
  hashMessage,
  recoverAddress,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  Signer,
  TRACE_ACK_TYPES,
  type TraceAckPayload,
  type TraceAckSignContext,
} from "../src/signer/index.js";

const ZERO_BYTES32: Hex = ("0x" + "00".repeat(32)) as Hex;
const OWNER_ADDR: Address = getAddress("0xdeadbeef00000000000000000000000000000001");
const EXECUTOR_ADDR: Address = getAddress("0x000000000000000000000000000000000000c001");
const ARBITER_ADDR: Address = getAddress("0x000000000000000000000000000000000000aaaa");
const OTHER_ADDR: Address = getAddress("0x000000000000000000000000000000000000beef");
const OTHER_EXEC_ADDR: Address = getAddress("0x000000000000000000000000000000000000bbbb");

function makePayload(over: Partial<TraceAckPayload> = {}): TraceAckPayload {
  return {
    contextDigest: ("0x" + "ab".repeat(32)) as Hex,
    uriHash: ("0x" + "cd".repeat(32)) as Hex,
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + 600),
    agentId: ("0x" + "11".repeat(32)) as Hex,
    owner: OWNER_ADDR,
    ...over,
  };
}

function makeCtx(over: Partial<TraceAckSignContext> = {}): TraceAckSignContext {
  return {
    guardedExecutor: EXECUTOR_ADDR,
    chainId: 84532,
    ...over,
  };
}

describe("Signer.traceAckDigest (EIP-712)", () => {
  it("matches viem.hashTypedData with the IntentGuard domain + 7-field TraceAck type", () => {
    const payload = makePayload();
    const ctx = makeCtx();

    const expected = hashTypedData({
      domain: {
        name: "IntentGuard",
        version: "1",
        chainId: ctx.chainId,
        verifyingContract: ctx.guardedExecutor,
      },
      types: TRACE_ACK_TYPES,
      primaryType: "TraceAck",
      message: {
        contextDigest: payload.contextDigest,
        uriHash: payload.uriHash,
        expiresAt: payload.expiresAt,
        guardedExecutor: ctx.guardedExecutor,
        chainId: BigInt(ctx.chainId),
        agentId: payload.agentId,
        owner: payload.owner,
      },
    });

    expect(Signer.traceAckDigest(payload, ctx)).toBe(expected);
  });

  it("changes if any of contextDigest, uriHash, expiresAt, agentId, owner, chainId, or guardedExecutor changes", () => {
    const baseDigest = Signer.traceAckDigest(makePayload(), makeCtx());

    const variants: { label: string; digest: Hex }[] = [
      {
        label: "contextDigest",
        digest: Signer.traceAckDigest(
          makePayload({ contextDigest: ("0x" + "fe".repeat(32)) as Hex }),
          makeCtx(),
        ),
      },
      {
        label: "uriHash",
        digest: Signer.traceAckDigest(
          makePayload({ uriHash: ("0x" + "fe".repeat(32)) as Hex }),
          makeCtx(),
        ),
      },
      {
        label: "expiresAt",
        digest: Signer.traceAckDigest(makePayload({ expiresAt: 1n }), makeCtx()),
      },
      {
        label: "agentId",
        digest: Signer.traceAckDigest(
          makePayload({ agentId: ("0x" + "ef".repeat(32)) as Hex }),
          makeCtx(),
        ),
      },
      {
        label: "owner",
        digest: Signer.traceAckDigest(
          makePayload({ owner: OTHER_ADDR }),
          makeCtx(),
        ),
      },
      {
        label: "chainId",
        digest: Signer.traceAckDigest(makePayload(), makeCtx({ chainId: 1 })),
      },
      {
        label: "guardedExecutor",
        digest: Signer.traceAckDigest(
          makePayload(),
          makeCtx({ guardedExecutor: OTHER_EXEC_ADDR }),
        ),
      },
    ];

    for (const v of variants) {
      expect(v.digest, `tampering ${v.label} should change the digest`).not.toBe(baseDigest);
    }
  });
});

describe("Signer.signTraceAck (EIP-712)", () => {
  it("produces a signature recoverable to the signer pubkey via the same EIP-712 digest", async () => {
    const key = generatePrivateKey();
    const account = privateKeyToAccount(key);
    const signer = new Signer(key, null);

    const payload = makePayload();
    const ctx = makeCtx();

    const ack = await signer.signTraceAck(payload, ctx);
    expect(ack.signer).toBe(account.address);
    expect(ack.guardedExecutor).toBe(ctx.guardedExecutor);
    expect(ack.chainId).toBe(ctx.chainId);

    const digest = Signer.traceAckDigest(payload, ctx);
    const recovered = await recoverAddress({ hash: digest, signature: ack.signature });
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });

  it("does NOT recover when verifying as EIP-191 personal_sign (i.e. we are using EIP-712, not personal_sign)", async () => {
    const key = generatePrivateKey();
    const signer = new Signer(key, null);

    const payload = makePayload();
    const ctx = makeCtx();

    const ack = await signer.signTraceAck(payload, ctx);
    const wrongDigest = hashMessage({ raw: ZERO_BYTES32 });
    const recovered = await recoverAddress({
      hash: wrongDigest,
      signature: ack.signature,
    });
    expect(recovered.toLowerCase()).not.toBe(privateKeyToAccount(key).address.toLowerCase());
  });
});

describe("Signer.signReviewerDecision (EIP-191 with chainId + arbiter)", () => {
  it("is recoverable to the reviewer key via toEthSignedMessageHash(inner)", async () => {
    const reviewerKey = generatePrivateKey();
    const reviewerAccount = privateKeyToAccount(reviewerKey);
    const signer = new Signer(generatePrivateKey(), reviewerKey);

    const arbiter = ARBITER_ADDR;
    const chainId = 84532;
    const input = {
      challengeId: 7n,
      uphold: true,
      slashAmount: 15_000_000n,
      challengeArbiter: arbiter,
      chainId,
    };

    const sig = await signer.signReviewerDecision(input);
    expect(sig.signer).toBe(reviewerAccount.address);

    const inner = Signer.reviewerInnerHash(input);
    expect(sig.digest).toBe(inner);

    const ethHash = hashMessage({ raw: inner });
    const recovered = await recoverAddress({ hash: ethHash, signature: sig.signature });
    expect(recovered.toLowerCase()).toBe(reviewerAccount.address.toLowerCase());
  });

  it("would NOT recover if address(this) or chainId were omitted (regression for the previous 3-field bug)", async () => {
    const reviewerKey = generatePrivateKey();
    const signer = new Signer(generatePrivateKey(), reviewerKey);

    const sig = await signer.signReviewerDecision({
      challengeId: 1n,
      uphold: true,
      slashAmount: 0n,
      challengeArbiter: ARBITER_ADDR,
      chainId: 84532,
    });

    // Reproduce the OLD (buggy) inner hash without arbiter/chainId.
    const { keccak256, encodeAbiParameters, hashMessage } = await import("viem");
    const buggyInner = keccak256(
      encodeAbiParameters(
        [
          { name: "challengeId", type: "uint256" },
          { name: "uphold", type: "bool" },
          { name: "slashAmount", type: "uint256" },
        ],
        [1n, true, 0n],
      ),
    );
    const buggyDigest = hashMessage({ raw: buggyInner });
    const recovered = await recoverAddress({ hash: buggyDigest, signature: sig.signature });
    expect(recovered.toLowerCase()).not.toBe(privateKeyToAccount(reviewerKey).address.toLowerCase());
  });

  it("requires a reviewer key", async () => {
    const signer = new Signer(generatePrivateKey(), null);
    await expect(
      signer.signReviewerDecision({
        challengeId: 1n,
        uphold: true,
        slashAmount: 0n,
        challengeArbiter: ARBITER_ADDR,
        chainId: 84532,
      }),
    ).rejects.toThrow(/reviewer/i);
  });
});
