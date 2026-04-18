import { describe, expect, it } from "vitest";
import {
  encodeAbiParameters,
  hashMessage,
  keccak256,
  recoverAddress,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Signer } from "../src/signer/index.js";

describe("Signer.traceAckDigest", () => {
  it("matches the on-chain abi.encode + keccak256 reconstruction", () => {
    const contextDigest = ("0x" + "11".repeat(32)) as Hex;
    const uriHash = ("0x" + "22".repeat(32)) as Hex;
    const expiresAt = 1_700_000_000n;

    const expected = keccak256(
      encodeAbiParameters(
        [
          { type: "bytes32" },
          { type: "bytes32" },
          { type: "uint64" },
        ],
        [contextDigest, uriHash, expiresAt],
      ),
    );

    expect(Signer.traceAckDigest({ contextDigest, uriHash, expiresAt })).toBe(expected);
  });
});

describe("Signer.signTraceAck", () => {
  it("produces an EIP-191 signature recoverable to the signer pubkey", async () => {
    const key = generatePrivateKey();
    const account = privateKeyToAccount(key);
    const signer = new Signer(key, null);

    const payload = {
      contextDigest: ("0x" + "ab".repeat(32)) as Hex,
      uriHash: ("0x" + "cd".repeat(32)) as Hex,
      expiresAt: BigInt(Math.floor(Date.now() / 1000) + 600),
    };

    const ack = await signer.signTraceAck(payload);
    expect(ack.signer).toBe(account.address);

    const digest = Signer.traceAckDigest(payload);
    const ethHash = hashMessage({ raw: digest });
    const recovered = await recoverAddress({ hash: ethHash, signature: ack.signature });
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });

  it("requires a reviewer key to sign reviewer decisions", async () => {
    const signer = new Signer(generatePrivateKey(), null);
    await expect(
      signer.signReviewerDecision({ challengeId: 1n, uphold: true, slashAmount: 0n }),
    ).rejects.toThrow(/reviewer/i);
  });
});
