/**
 * Local trace service stub — fallback when Dev 3's POST /v1/traces isn't ready.
 *
 * Signs TraceAck with a local dev key. Dev 1's guard must trust this signer
 * on testnet. Swap to real Dev 3 service when live.
 */

import express from "express";
import {
  getAddress,
  keccak256,
  stringToBytes,
  type Address,
  type Hex,
  type PrivateKeyAccount,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadDeploymentConfig } from "./config.js";

const TRACE_ACK_VALIDITY_SECONDS = 3600; // 1 hour
const TRACE_ACK_DOMAIN_NAME = "IntentGuard";
const TRACE_ACK_DOMAIN_VERSION = "1";

const TRACE_ACK_TYPES = {
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

interface TraceRequest {
  agentId: string;
  owner: string;
  contextDigest: Hex;
  /** Canonical JSON string or parsed object (IF-04). */
  trace: string | Record<string, unknown>;
}

/**
 * Create an Express app that stubs Dev 3's POST /v1/traces.
 *
 * @param signerPrivateKey - The private key used to sign TraceAcks.
 *   Dev 1 must register this signer's address in GuardedExecutor.
 */
export function createTraceStubServer(signerPrivateKey: Hex) {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  const signer: PrivateKeyAccount = privateKeyToAccount(signerPrivateKey);

  // In-memory trace store (stub only)
  const traces = new Map<
    string,
    { trace: string; contextDigest: Hex; timestamp: number }
  >();

  app.post("/v1/traces", async (req, res) => {
    try {
      const body = req.body as TraceRequest;
      const deployment = loadDeploymentConfig();

      if (!body.agentId || !body.owner || !body.contextDigest || !body.trace) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      // Generate a deterministic trace URI from the digest
      const traceURI = `ipfs://stub/${body.contextDigest}`;
      const uriHash = keccak256(stringToBytes(traceURI));
      const expiresAt = Math.floor(Date.now() / 1000) + TRACE_ACK_VALIDITY_SECONDS;

      // Mirror GuardedExecutor's EIP-712 TraceAck digest exactly.
      const signature = await signer.signTypedData({
        domain: {
          name: TRACE_ACK_DOMAIN_NAME,
          version: TRACE_ACK_DOMAIN_VERSION,
          chainId: deployment.chainId,
          verifyingContract: deployment.contracts.GuardedExecutor,
        },
        types: TRACE_ACK_TYPES,
        primaryType: "TraceAck",
        message: {
          contextDigest: body.contextDigest,
          uriHash,
          expiresAt: BigInt(expiresAt),
          guardedExecutor: deployment.contracts.GuardedExecutor,
          chainId: BigInt(deployment.chainId),
          agentId: body.agentId as Hex,
          owner: getAddress(body.owner) as Address,
        },
      });

      const traceStored =
        typeof body.trace === "string"
          ? body.trace
          : JSON.stringify(body.trace);

      traces.set(body.contextDigest, {
        trace: traceStored,
        contextDigest: body.contextDigest,
        timestamp: Date.now(),
      });

      res.json({
        traceURI,
        contextDigest: body.contextDigest,
        uriHash,
        expiresAt,
        signature,
        signer: signer.address,
        guardedExecutor: deployment.contracts.GuardedExecutor,
        chainId: deployment.chainId,
      });
    } catch (err) {
      console.error("[trace-stub] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", signer: signer.address, traceCount: traces.size });
  });

  return { app, signer };
}

/**
 * Start the trace stub server.
 */
export function startTraceStub(
  signerPrivateKey: Hex,
  port = 7403
): Promise<{ address: string; port: number }> {
  const { app, signer } = createTraceStubServer(signerPrivateKey);

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(
        `[trace-stub] Listening on :${port} | signer=${signer.address}`
      );
      resolve({ address: signer.address, port });
    });

    // Graceful shutdown
    process.on("SIGTERM", () => server.close());
    process.on("SIGINT", () => server.close());
  });
}
