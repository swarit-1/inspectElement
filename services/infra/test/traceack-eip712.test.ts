import "./setup.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getAddress,
  keccak256,
  recoverAddress,
  stringToBytes,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Signer } from "../src/signer/index.js";
import { computeContextDigest } from "../../../packages/trace/src/digest.js";
import type { DecisionTrace } from "../../../packages/trace/src/types.js";

/**
 * Tier 2 — full TraceAck EIP-712 round-trip against the real on-chain values.
 *
 * Loads the live Base Sepolia deployment manifest (chainId + GuardedExecutor
 * address) and signs a payload exactly the way `GuardedExecutor.preflightCheck`
 * will reconstruct it. Recovers the address. If this passes, the demo will
 * pass at the signature layer.
 */

interface DeploymentManifest {
  chainId: number;
  contracts: {
    GuardedExecutor: Address;
    ChallengeArbiter: Address;
  };
}

function loadDeployment(): DeploymentManifest {
  const path = resolve(__dirname, "../../../deployments/base-sepolia.json");
  return JSON.parse(readFileSync(path, "utf-8")) as DeploymentManifest;
}

function loadFixtureTrace(name: "legit" | "blocked" | "overspend"): DecisionTrace {
  const path = resolve(__dirname, "../../../fixtures", `${name}.json`);
  return (JSON.parse(readFileSync(path, "utf-8")) as { trace: DecisionTrace }).trace;
}

describe("TraceAck EIP-712 round-trip vs deployments/base-sepolia.json", () => {
  const deployment = loadDeployment();

  it("recovers the signer address using Dev 1's exact chainId + verifyingContract", async () => {
    const key = generatePrivateKey();
    const account = privateKeyToAccount(key);
    const signer = new Signer(key, null);

    const trace = loadFixtureTrace("legit");
    const contextDigest = computeContextDigest(trace);
    const traceURI = `ipfs://Qm${"a".repeat(44)}`;
    const uriHash = keccak256(stringToBytes(traceURI));
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 600);

    const owner = getAddress(trace.owner);
    const guardedExecutor = getAddress(deployment.contracts.GuardedExecutor);

    const ack = await signer.signTraceAck(
      {
        contextDigest,
        uriHash,
        expiresAt,
        agentId: trace.agentId as Hex,
        owner,
      },
      { guardedExecutor, chainId: deployment.chainId },
    );

    const digest = Signer.traceAckDigest(
      {
        contextDigest,
        uriHash,
        expiresAt,
        agentId: trace.agentId as Hex,
        owner,
      },
      { guardedExecutor, chainId: deployment.chainId },
    );

    const recovered = await recoverAddress({ hash: digest, signature: ack.signature });
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });

  it("REGRESSION: recovery fails when chainId is 1 (mainnet) instead of 84532 (base-sepolia)", async () => {
    const key = generatePrivateKey();
    const account = privateKeyToAccount(key);
    const signer = new Signer(key, null);

    const trace = loadFixtureTrace("legit");
    const contextDigest = computeContextDigest(trace);
    const uriHash = keccak256(stringToBytes("ipfs://x"));
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 600);
    const owner = getAddress(trace.owner);
    const guardedExecutor = getAddress(deployment.contracts.GuardedExecutor);
    const payload = {
      contextDigest,
      uriHash,
      expiresAt,
      agentId: trace.agentId as Hex,
      owner,
    };

    const ack = await signer.signTraceAck(payload, {
      guardedExecutor,
      chainId: deployment.chainId,
    });

    const wrongChainDigest = Signer.traceAckDigest(payload, {
      guardedExecutor,
      chainId: 1,
    });
    const recovered = await recoverAddress({
      hash: wrongChainDigest,
      signature: ack.signature,
    });
    expect(recovered.toLowerCase()).not.toBe(account.address.toLowerCase());
  });
});
