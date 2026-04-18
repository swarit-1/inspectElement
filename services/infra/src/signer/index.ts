import {
  encodeAbiParameters,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PrivateKeyAccount } from "viem/accounts";
import { loadEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * TraceAck signer.
 *
 * Hash scheme (locked with Dev 1, see Dev 3 spec §3.2 / §8 risk mitigation):
 *   digest = keccak256(abi.encode(bytes32 contextDigest, bytes32 uriHash, uint64 expiresAt))
 *   signature = EIP-191 personal_sign(digest)
 *
 * Solidity verification on the GuardedExecutor side reconstructs the same
 * `digest` and uses `ECDSA.recover(toEthSignedMessageHash(digest), sig)`.
 */
export interface TraceAckPayload {
  contextDigest: Hex;
  uriHash: Hex;
  expiresAt: bigint;
}

export interface TraceAck extends TraceAckPayload {
  signature: Hex;
  signer: Address;
}

export class Signer {
  readonly traceAck: PrivateKeyAccount;
  readonly reviewer: PrivateKeyAccount | null;

  constructor(traceAckKey: Hex, reviewerKey: Hex | null) {
    this.traceAck = privateKeyToAccount(traceAckKey);
    this.reviewer = reviewerKey ? privateKeyToAccount(reviewerKey) : null;
  }

  private static cached: Signer | null = null;

  static fromEnv(): Signer {
    if (Signer.cached) return Signer.cached;
    const env = loadEnv();
    const reviewerKey =
      env.REVIEWER_PRIVATE_KEY && env.REVIEWER_PRIVATE_KEY !== "0x" + "0".repeat(64)
        ? (env.REVIEWER_PRIVATE_KEY as Hex)
        : null;
    const signer = new Signer(env.TRACE_ACK_PRIVATE_KEY as Hex, reviewerKey);
    logger.info(
      {
        traceAckSigner: signer.traceAck.address,
        reviewerSigner: signer.reviewer?.address ?? null,
      },
      "Signer initialized",
    );
    Signer.cached = signer;
    return signer;
  }

  /** Test helper: drop the cached singleton. */
  static __resetForTests(): void {
    Signer.cached = null;
  }

  /** Returns the digest that the GuardedExecutor reconstructs on-chain (pre-EIP-191). */
  static traceAckDigest(payload: TraceAckPayload): Hex {
    return keccak256(
      encodeAbiParameters(
        [
          { name: "contextDigest", type: "bytes32" },
          { name: "uriHash", type: "bytes32" },
          { name: "expiresAt", type: "uint64" },
        ],
        [payload.contextDigest, payload.uriHash, payload.expiresAt],
      ),
    );
  }

  async signTraceAck(payload: TraceAckPayload): Promise<TraceAck> {
    const digest = Signer.traceAckDigest(payload);
    // EIP-191 personal-sign of the raw 32-byte digest. viem's `signMessage`
    // with `{ raw: digest }` wraps with the "\x19Ethereum Signed Message:\n32"
    // prefix, which matches OpenZeppelin's `ECDSA.toEthSignedMessageHash`.
    const signature = await this.traceAck.signMessage({ message: { raw: digest } });
    return { ...payload, signature, signer: this.traceAck.address };
  }

  /**
   * Reviewer signature for `resolveByReviewer(challengeId, uphold, slashAmount, sig)`.
   *
   * Hash scheme matches Dev 1's reviewer-stub interface:
   *   digest = keccak256(abi.encode(uint256 challengeId, bool uphold, uint256 slashAmount))
   *   sig = personal_sign(digest)
   */
  async signReviewerDecision(input: {
    challengeId: bigint;
    uphold: boolean;
    slashAmount: bigint;
  }): Promise<{ digest: Hex; signature: Hex; signer: Address }> {
    if (!this.reviewer) {
      throw new Error("Reviewer signing key not configured (set REVIEWER_PRIVATE_KEY)");
    }
    const digest = keccak256(
      encodeAbiParameters(
        [
          { name: "challengeId", type: "uint256" },
          { name: "uphold", type: "bool" },
          { name: "slashAmount", type: "uint256" },
        ],
        [input.challengeId, input.uphold, input.slashAmount],
      ),
    );
    const signature = await this.reviewer.signMessage({ message: { raw: digest } });
    return { digest, signature, signer: this.reviewer.address };
  }
}
