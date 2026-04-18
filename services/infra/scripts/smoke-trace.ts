/**
 * Tier 3 smoke test — boots the real server in-process and exercises the
 * full HTTP flow that Dev 2's `uploadTrace` will hit on demo day.
 *
 *   $ npm --prefix services/infra run smoke
 *
 * Asserts, for each fixture (legit / blocked / overspend):
 *   - HTTP 200
 *   - `contextDigest` round-trips correctly
 *   - the EIP-712 signature recovers to the signer the /v1/health endpoint
 *     advertises (which is what Dev 1 must register as `traceAckSigner`)
 *   - `traceURI` is reachable (local CAS or IPFS)
 *   - posting twice yields the same TraceAck (idempotent)
 *
 * Exits with code 1 on first failure so CI / a teammate can spot it fast.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { DecisionTrace } from "../../../packages/trace/src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CheckResult {
  name: string;
  ok: boolean;
  details?: unknown;
}

const results: CheckResult[] = [];

function record(name: string, ok: boolean, details?: unknown): void {
  results.push({ name, ok, details });
  const status = ok ? "PASS" : "FAIL";
  // eslint-disable-next-line no-console
  console.log(`[${status}] ${name}`);
  if (!ok && details !== undefined) {
    // eslint-disable-next-line no-console
    console.log("        ", details);
  }
}

/**
 * Reserve a local TCP port. Setting PUBLIC_BASE_URL to the loopback we
 * are about to listen on guarantees the local CAS pinner generates URIs
 * that point back at our own server.
 *
 * NOTE: we MUST do this before any dynamic import that can transitively
 * trigger `loadEnv()` (e.g. the logger module).
 */
async function reservePort(): Promise<{ port: number; baseUrl: string }> {
  return await new Promise((resolveStart) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const addr = probe.address() as AddressInfo;
      const port = addr.port;
      probe.close(() => resolveStart({ port, baseUrl: `http://127.0.0.1:${port}` }));
    });
  });
}

async function main(): Promise<void> {
  const reserved = await reservePort();
  process.env.PUBLIC_BASE_URL = reserved.baseUrl;
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? ":memory:";
  process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "warn";

  // Dynamic imports so the env override happens BEFORE any module-load
  // side effects that call loadEnv() (notably ../src/utils/logger.ts).
  const [{ createApp }, traceClient, signerMod, viem] = await Promise.all([
    import("../src/api/app.js"),
    import("../../../packages/trace/src/trace-client.js"),
    import("../src/signer/index.js"),
    import("viem"),
  ]);
  const { uploadTrace } = traceClient;
  const { TRACE_ACK_TYPES } = signerMod;
  const { hashTypedData, keccak256, recoverAddress, stringToBytes } = viem;
  type Address = `0x${string}`;
  type Hex = `0x${string}`;

  function loadFixture(name: "legit" | "blocked" | "overspend"): DecisionTrace {
    const path = resolve(__dirname, "..", "..", "..", "fixtures", `${name}.json`);
    return (JSON.parse(readFileSync(path, "utf-8")) as { trace: DecisionTrace }).trace;
  }

  async function startServer(port: number): Promise<{ server: Server; baseUrl: string }> {
    const app = createApp();
    return await new Promise((resolveStart) => {
      const server = createServer(app);
      server.listen(port, "127.0.0.1", () => {
        const addr = server.address() as AddressInfo;
        const baseUrl = `http://127.0.0.1:${addr.port}`;
        resolveStart({ server, baseUrl });
      });
    });
  }

  const { server, baseUrl } = await startServer(reserved.port);
  // eslint-disable-next-line no-console
  console.log(`Smoke test server listening on ${baseUrl}\n`);

  try {
    const healthRes = await fetch(`${baseUrl}/v1/health`);
    const health = (await healthRes.json()) as {
      ok: boolean;
      traceAckSigner: Address;
      reviewerSigner: Address | null;
      contracts: { GuardedExecutor: Address } | null;
      chainId: number;
    };
    record("GET /v1/health responds 200 + ok=true", healthRes.ok && health.ok);
    record(
      "GET /v1/health publishes a valid TraceAck signer pubkey",
      /^0x[0-9a-fA-F]{40}$/.test(health.traceAckSigner),
      { signer: health.traceAckSigner },
    );

    if (!health.contracts) {
      record("/v1/health has GuardedExecutor address (deployment manifest loaded)", false);
      return;
    }
    record("/v1/health exposes GuardedExecutor address from deployment manifest", true, {
      guardedExecutor: health.contracts.GuardedExecutor,
      chainId: health.chainId,
    });

    // eslint-disable-next-line no-console
    console.log(`\n>>> SIGNER ADDRESS FOR DEV 1: ${health.traceAckSigner} <<<\n`);

    for (const name of ["legit", "blocked", "overspend"] as const) {
      // eslint-disable-next-line no-console
      console.log(`\n--- fixture: ${name} ---`);
      const trace = loadFixture(name) as unknown as {
        agentId: string;
        owner: string;
      };

      try {
        const ack = await uploadTrace(trace as never, baseUrl);
        record(`${name}: uploadTrace 200 + digest matches local`, true);
        record(
          `${name}: traceURI looks valid`,
          typeof ack.traceURI === "string" && ack.traceURI.length > 0,
          { traceURI: ack.traceURI },
        );

        const expectedUriHash = keccak256(stringToBytes(ack.traceURI));
        record(
          `${name}: uriHash = keccak256(traceURI)`,
          ack.uriHash.toLowerCase() === expectedUriHash.toLowerCase(),
        );
        record(`${name}: expiresAt is in the future`, ack.expiresAt > Math.floor(Date.now() / 1000));

        const digest = hashTypedData({
          domain: {
            name: "IntentGuard",
            version: "1",
            chainId: health.chainId,
            verifyingContract: health.contracts.GuardedExecutor,
          },
          types: TRACE_ACK_TYPES,
          primaryType: "TraceAck",
          message: {
            contextDigest: ack.contextDigest,
            uriHash: ack.uriHash,
            expiresAt: BigInt(ack.expiresAt),
            guardedExecutor: health.contracts.GuardedExecutor,
            chainId: BigInt(health.chainId),
            agentId: trace.agentId as Hex,
            owner: trace.owner as Address,
          },
        });
        const recovered = await recoverAddress({ hash: digest, signature: ack.signature });
        record(
          `${name}: signature recovers to advertised TraceAck signer`,
          recovered.toLowerCase() === health.traceAckSigner.toLowerCase(),
          { recovered, expected: health.traceAckSigner },
        );

        if (ack.traceURI.startsWith("http")) {
          try {
            const fetched = await fetch(ack.traceURI);
            record(
              `${name}: traceURI is fetchable (HTTP ${fetched.status})`,
              fetched.ok,
              { url: ack.traceURI },
            );
          } catch (fetchErr) {
            record(`${name}: traceURI fetch threw`, false, {
              url: ack.traceURI,
              err: (fetchErr as Error).message,
            });
          }
        }

        try {
          const ack2 = await uploadTrace(trace as never, baseUrl);
          record(
            `${name}: re-upload returns the same TraceAck (idempotent)`,
            ack2.traceURI === ack.traceURI && ack2.signature === ack.signature,
          );
        } catch (idempErr) {
          record(`${name}: idempotent upload threw`, false, (idempErr as Error).message);
        }
      } catch (err) {
        record(`${name}: uploadTrace pipeline`, false, (err as Error).message);
      }
    }

    // eslint-disable-next-line no-console
    console.log("\n=== summary ===");
    const passed = results.filter((r) => r.ok).length;
    // eslint-disable-next-line no-console
    console.log(`${passed}/${results.length} checks passed`);
  } finally {
    server.close();
  }

  if (results.some((r) => !r.ok)) process.exit(1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("smoke-trace crashed:", err);
  process.exit(1);
});
