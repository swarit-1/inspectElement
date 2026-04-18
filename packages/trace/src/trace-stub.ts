/**
 * Local trace service stub — fallback when Dev 3's POST /v1/traces isn't ready.
 *
 * Signs TraceAck with a local dev key. Dev 1's guard must trust this signer
 * on testnet. Swap to real Dev 3 service when live.
 */

import express from "express";
import {
  keccak256,
  toHex,
  type Hex,
  encodePacked,
  type PrivateKeyAccount,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const TRACE_ACK_VALIDITY_SECONDS = 3600; // 1 hour

interface TraceRequest {
  agentId: string;
  owner: string;
  contextDigest: Hex;
  trace: string;
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

      if (!body.agentId || !body.owner || !body.contextDigest || !body.trace) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      // Generate a deterministic trace URI from the digest
      const traceURI = `ipfs://stub/${body.contextDigest}`;
      const uriHash = keccak256(
        new TextEncoder().encode(traceURI) as unknown as Uint8Array
      );
      const expiresAt = Math.floor(Date.now() / 1000) + TRACE_ACK_VALIDITY_SECONDS;

      // Sign the TraceAck fields: contextDigest, uriHash, expiresAt
      // This matches the on-chain verification in GuardedExecutor
      const messageHash = keccak256(
        encodePacked(
          ["bytes32", "bytes32", "uint64"],
          [body.contextDigest, uriHash, BigInt(expiresAt)]
        )
      );

      const signature = await signer.signMessage({
        message: { raw: messageHash as Hex },
      });

      // Store the trace
      traces.set(body.contextDigest, {
        trace: body.trace,
        contextDigest: body.contextDigest,
        timestamp: Date.now(),
      });

      res.json({
        traceURI,
        contextDigest: body.contextDigest,
        uriHash,
        expiresAt,
        signature,
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
