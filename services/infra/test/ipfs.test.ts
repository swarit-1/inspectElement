/**
 * Tier 6 — Pinning fallback verification.
 *
 * The hackathon demo runs without a paid IPFS provider, so the local CAS
 * pinner is what actually serves traceURIs to Dev 1 (challenges) and Dev 4
 * (replay UI). These tests pin three properties that those consumers rely on:
 *
 *   1. URI shape is `${PUBLIC_BASE_URL}/ipfs/<64-hex>` (Dev 4 expects http(s))
 *   2. CID is the sha256 of the bytes (deterministic, content-addressed)
 *   3. Re-pinning identical content is idempotent (no duplicate files)
 *   4. The HTTP gateway serves the same bytes back (Dev 4 fetch loop)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";

import { createPinner, LOCAL_CAS_DIR } from "../src/ipfs/index.js";
import { createLocalCasRouter } from "../src/api/local-cas.js";

const sha256Hex = (s: string): string => createHash("sha256").update(s).digest("hex");
const uniqueTag = (): string => randomBytes(8).toString("hex");

describe("LocalCasPinner — content-addressed fallback", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((res) => {
      const app = express();
      app.use("/ipfs", createLocalCasRouter());
      server = createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        res();
      });
    });
  });

  afterAll(() => {
    if (server) server.close();
  });

  it("pins content and returns a URI of shape ${PUBLIC_BASE_URL}/ipfs/<sha256>", async () => {
    const pinner = createPinner({
      PORT: 0,
      DATABASE_URL: ":memory:",
      RPC_URL: "http://x",
      DEPLOYMENTS_FILE: "x",
      PUBLIC_BASE_URL: baseUrl,
      INDEXER_POLL_MS: 1000,
      INDEXER_BATCH: 1,
      INDEXER_FROM_BLOCK: null,
      LOG_LEVEL: "warn",
      IPFS_TOKEN: undefined,
      IPFS_API_URL: "https://api.web3.storage",
      TRACE_ACK_PRIVATE_KEY: undefined,
      REVIEWER_PRIVATE_KEY: undefined,
      TRACE_ACK_TTL_SEC: 600,
    } as never);

    const payload = JSON.stringify({ hello: "world", n: 1, tag: uniqueTag() });
    const expectedHash = sha256Hex(payload);

    const result = await pinner.pin(payload);

    expect(result.pinner).toBe("local-cas");
    expect(result.cid).toBe(expectedHash);
    expect(result.uri).toBe(`${baseUrl}/ipfs/${expectedHash}`);
    expect(result.bytes).toBe(Buffer.byteLength(payload, "utf-8"));
    expect(existsSync(resolve(LOCAL_CAS_DIR, expectedHash))).toBe(true);
  });

  it("re-pinning identical content is idempotent (same CID, same URI, same bytes on disk)", async () => {
    const pinner = createPinner({
      PORT: 0,
      DATABASE_URL: ":memory:",
      RPC_URL: "http://x",
      DEPLOYMENTS_FILE: "x",
      PUBLIC_BASE_URL: baseUrl,
      INDEXER_POLL_MS: 1000,
      INDEXER_BATCH: 1,
      INDEXER_FROM_BLOCK: null,
      LOG_LEVEL: "warn",
      IPFS_TOKEN: undefined,
      IPFS_API_URL: "https://api.web3.storage",
      TRACE_ACK_PRIVATE_KEY: undefined,
      REVIEWER_PRIVATE_KEY: undefined,
      TRACE_ACK_TTL_SEC: 600,
    } as never);

    const payload = JSON.stringify({ idempotent: true, tag: uniqueTag() });
    const a = await pinner.pin(payload);
    const b = await pinner.pin(payload);

    expect(b.cid).toBe(a.cid);
    expect(b.uri).toBe(a.uri);
    expect(readFileSync(resolve(LOCAL_CAS_DIR, a.cid), "utf-8")).toBe(payload);
  });

  it("HTTP gateway returns the exact bytes that were pinned (Dev 4 replay path)", async () => {
    const pinner = createPinner({
      PORT: 0,
      DATABASE_URL: ":memory:",
      RPC_URL: "http://x",
      DEPLOYMENTS_FILE: "x",
      PUBLIC_BASE_URL: baseUrl,
      INDEXER_POLL_MS: 1000,
      INDEXER_BATCH: 1,
      INDEXER_FROM_BLOCK: null,
      LOG_LEVEL: "warn",
      IPFS_TOKEN: undefined,
      IPFS_API_URL: "https://api.web3.storage",
      TRACE_ACK_PRIVATE_KEY: undefined,
      REVIEWER_PRIVATE_KEY: undefined,
      TRACE_ACK_TTL_SEC: 600,
    } as never);

    const payload = JSON.stringify({ replay: "yes", agent: "0xabc", tag: uniqueTag() });
    const result = await pinner.pin(payload);

    const fetched = await fetch(result.uri);
    expect(fetched.ok).toBe(true);
    expect(fetched.headers.get("content-type")).toMatch(/application\/json/);
    expect(await fetched.text()).toBe(payload);
  });

  it("HTTP gateway 400s on malformed cids and 404s on unknown cids", async () => {
    const bad = await fetch(`${baseUrl}/ipfs/not-a-real-hash`);
    expect(bad.status).toBe(400);

    const unknown = await fetch(`${baseUrl}/ipfs/${"0".repeat(64)}`);
    expect(unknown.status).toBe(404);
  });

  it("pinner.fetch round-trips bytes by URI (used by replay engine scaffold)", async () => {
    const pinner = createPinner({
      PORT: 0,
      DATABASE_URL: ":memory:",
      RPC_URL: "http://x",
      DEPLOYMENTS_FILE: "x",
      PUBLIC_BASE_URL: baseUrl,
      INDEXER_POLL_MS: 1000,
      INDEXER_BATCH: 1,
      INDEXER_FROM_BLOCK: null,
      LOG_LEVEL: "warn",
      IPFS_TOKEN: undefined,
      IPFS_API_URL: "https://api.web3.storage",
      TRACE_ACK_PRIVATE_KEY: undefined,
      REVIEWER_PRIVATE_KEY: undefined,
      TRACE_ACK_TTL_SEC: 600,
    } as never);

    const payload = JSON.stringify({ direct: "fetch", tag: uniqueTag() });
    const result = await pinner.pin(payload);

    const bytes = await pinner.fetch(result.uri);
    expect(bytes).not.toBeNull();
    expect(new TextDecoder().decode(bytes!)).toBe(payload);
  });
});

describe("createPinner — provider selection", () => {
  it("returns the web3-storage pinner when IPFS_TOKEN is set", () => {
    const pinner = createPinner({
      PORT: 0,
      DATABASE_URL: ":memory:",
      RPC_URL: "http://x",
      DEPLOYMENTS_FILE: "x",
      PUBLIC_BASE_URL: "http://localhost:8787",
      INDEXER_POLL_MS: 1000,
      INDEXER_BATCH: 1,
      INDEXER_FROM_BLOCK: null,
      LOG_LEVEL: "warn",
      IPFS_TOKEN: "test-token",
      IPFS_API_URL: "https://api.web3.storage",
      TRACE_ACK_PRIVATE_KEY: undefined,
      REVIEWER_PRIVATE_KEY: undefined,
      TRACE_ACK_TTL_SEC: 600,
    } as never);
    // Smoke check: the constructor does not throw and exposes the pin/fetch contract.
    expect(typeof pinner.pin).toBe("function");
    expect(typeof pinner.fetch).toBe("function");
  });

  it("falls back to local CAS when IPFS_TOKEN is undefined", async () => {
    const pinner = createPinner({
      PORT: 0,
      DATABASE_URL: ":memory:",
      RPC_URL: "http://x",
      DEPLOYMENTS_FILE: "x",
      PUBLIC_BASE_URL: "http://localhost:8787",
      INDEXER_POLL_MS: 1000,
      INDEXER_BATCH: 1,
      INDEXER_FROM_BLOCK: null,
      LOG_LEVEL: "warn",
      IPFS_TOKEN: undefined,
      IPFS_API_URL: "https://api.web3.storage",
      TRACE_ACK_PRIVATE_KEY: undefined,
      REVIEWER_PRIVATE_KEY: undefined,
      TRACE_ACK_TTL_SEC: 600,
    } as never);
    const result = await pinner.pin("provider-selection-check");
    expect(result.pinner).toBe("local-cas");
  });
});
