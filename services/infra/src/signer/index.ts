import {
  encodeAbiParameters,
  hashTypedData,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PrivateKeyAccount } from "viem/accounts";
import { loadDeployments, loadEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * TraceAck signer.
 *
 * Hash scheme is locked with Dev 1 in `contracts/GuardedExecutor.sol` lines
 * 230-243 and `contracts/libraries/GuardConstants.sol`. The Solidity does:
 *
 *   structHash = keccak256(abi.encode(
 *     TRACE_ACK_TYPEHASH,
 *     contextDigest, uriHash, expiresAt,
 *     address(this),     // GuardedExecutor address
 *     block.chainid,
 *     agentId, owner
 *   ));
 *   digest = _hashTypedDataV4(structHash); // EIP-712 with domain ("IntentGuard", "1")
 *   recovered = ECDSA.tryRecover(digest, signature);
 *
 * We mirror it here using viem's `signTypedData` with the exact 7-field
 * TraceAck type and the `IntentGuard`/`1` domain. **EIP-712, NOT EIP-191** —
 * a previous version of this file used personal_sign and would have caused
 * every demo run to fail with `TRACE_ACK_INVALID`.
 */

const TRACE_ACK_DOMAIN_NAME = "IntentGuard";
const TRACE_ACK_DOMAIN_VERSION = "1";

/** EIP-712 type definition mirroring `GuardConstants.TRACE_ACK_TYPE`. */
export const TRACE_ACK_TYPES = {
  TraceAck: [
    { name: "contextDigest", type: "bytes32" },
    { name: "uriHash", type: "bytes32" },
    { name: "expiresAt", type: "uint64" },
    { name: "guardedExecutor", type: "address" },
    { name: "chainId", type: "uint256" },
    { name: "agentId", type: "bytes32" },
    { name: "owner", type: "address" },
  ],
} as const;

export interface TraceAckPayload {
  contextDigest: Hex;
  uriHash: Hex;
  expiresAt: bigint;
  agentId: Hex;
  owner: Address;
}

export interface TraceAckSignContext {
  /** GuardedExecutor address — pulled from `deployments/base-sepolia.json`. */
  guardedExecutor: Address;
  /** Chain id — `block.chainid` on the executor. */
  chainId: number;
}

export interface TraceAck extends TraceAckPayload {
  signature: Hex;
  signer: Address;
  guardedExecutor: Address;
  chainId: number;
}

export interface ReviewerSignContext {
  /** ChallengeArbiter address — pulled from `deployments/base-sepolia.json`. */
  challengeArbiter: Address;
  /** Chain id. */
  chainId: number;
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

  /**
   * Reproduce the exact EIP-712 digest that `GuardedExecutor.preflightCheck`
   * computes via `_hashTypedDataV4(structHash)`. Useful for unit tests and
   * debugging signature mismatches.
   */
  static traceAckDigest(payload: TraceAckPayload, ctx: TraceAckSignContext): Hex {
    return hashTypedData({
      domain: {
        name: TRACE_ACK_DOMAIN_NAME,
        version: TRACE_ACK_DOMAIN_VERSION,
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
  }

  async signTraceAck(payload: TraceAckPayload, ctx: TraceAckSignContext): Promise<TraceAck> {
    const signature = await this.traceAck.signTypedData({
      domain: {
        name: TRACE_ACK_DOMAIN_NAME,
        version: TRACE_ACK_DOMAIN_VERSION,
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
    return {
      ...payload,
      signature,
      signer: this.traceAck.address,
      guardedExecutor: ctx.guardedExecutor,
      chainId: ctx.chainId,
    };
  }

  /**
   * Reviewer signature for `ChallengeArbiter.resolveByReviewer`. Matches
   * `contracts/ChallengeArbiter.sol` lines 121-125:
   *
   *   inner = keccak256(abi.encode(challengeId, uphold, slashAmount, address(this), chainid))
   *   digest = inner.toEthSignedMessageHash()  // EIP-191 personal_sign
   *
   * Earlier this method only hashed (challengeId, uphold, slashAmount), which
   * would have failed `ECDSA.tryRecover` on-chain.
   */
  static reviewerInnerHash(input: {
    challengeId: bigint;
    uphold: boolean;
    slashAmount: bigint;
    challengeArbiter: Address;
    chainId: number;
  }): Hex {
    return keccak256(
      encodeAbiParameters(
        [
          { name: "challengeId", type: "uint256" },
          { name: "uphold", type: "bool" },
          { name: "slashAmount", type: "uint256" },
          { name: "challengeArbiter", type: "address" },
          { name: "chainId", type: "uint256" },
        ],
        [
          input.challengeId,
          input.uphold,
          input.slashAmount,
          input.challengeArbiter,
          BigInt(input.chainId),
        ],
      ),
    );
  }

  async signReviewerDecision(input: {
    challengeId: bigint;
    uphold: boolean;
    slashAmount: bigint;
    challengeArbiter: Address;
    chainId: number;
  }): Promise<{ digest: Hex; signature: Hex; signer: Address }> {
    if (!this.reviewer) {
      throw new Error("Reviewer signing key not configured (set REVIEWER_PRIVATE_KEY)");
    }
    const digest = Signer.reviewerInnerHash(input);
    const signature = await this.reviewer.signMessage({ message: { raw: digest } });
    return { digest, signature, signer: this.reviewer.address };
  }
}

/**
 * Resolve the `(guardedExecutor, chainId)` context the signer needs from the
 * deployment manifest + env. Throws if the manifest is missing — there is
 * literally nothing safe to sign without it.
 */
export function resolveTraceAckContext(): TraceAckSignContext {
  const env = loadEnv();
  const deployment = loadDeployments(env);
  if (!deployment) {
    throw new Error(
      "Cannot sign TraceAck: deployments/base-sepolia.json not found. " +
        "Dev 1 must publish the deployment manifest with GuardedExecutor.",
    );
  }
  return {
    guardedExecutor: deployment.contracts.GuardedExecutor,
    chainId: deployment.chainId ?? env.CHAIN_ID,
  };
}

export function resolveReviewerContext(): ReviewerSignContext {
  const env = loadEnv();
  const deployment = loadDeployments(env);
  if (!deployment) {
    throw new Error(
      "Cannot sign reviewer decision: deployments/base-sepolia.json not found.",
    );
  }
  return {
    challengeArbiter: deployment.contracts.ChallengeArbiter,
    chainId: deployment.chainId ?? env.CHAIN_ID,
  };
}
