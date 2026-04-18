import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { loadEnv, type Env } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Pinning client.
 *
 * Strategy: prefer real IPFS (web3.storage / Pinata-compatible bearer token).
 * If `IPFS_TOKEN` is unset, fall back to a deterministic local content store
 * served from `<PUBLIC_BASE_URL>/ipfs/<sha256>` (see `api/local-cas.ts`). This
 * keeps the same `traceURI` shape and lets the demo run end-to-end without an
 * external pinning provider.
 */
export interface PinResult {
  uri: string; // ipfs://… or http(s)://…
  cid: string; // CID for IPFS uploads, sha256 hex for local CAS
  bytes: number;
  pinner: "web3-storage" | "local-cas";
}

export interface Pinner {
  pin(content: string | Uint8Array, filename?: string): Promise<PinResult>;
  fetch(uri: string): Promise<Uint8Array | null>;
}

export function createPinner(env: Env = loadEnv()): Pinner {
  if (env.IPFS_TOKEN) {
    return new Web3StoragePinner(env.IPFS_TOKEN, env.IPFS_API_URL);
  }
  logger.warn("IPFS_TOKEN unset; using local content-addressed store fallback");
  return new LocalCasPinner(env.PUBLIC_BASE_URL);
}

export const LOCAL_CAS_DIR = resolve(process.cwd(), "data/cas");

class LocalCasPinner implements Pinner {
  constructor(private readonly publicBaseUrl: string) {
    mkdirSync(LOCAL_CAS_DIR, { recursive: true });
  }

  async pin(content: string | Uint8Array): Promise<PinResult> {
    const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
    const hash = createHash("sha256").update(bytes).digest("hex");
    const path = resolve(LOCAL_CAS_DIR, hash);
    if (!existsSync(path)) writeFileSync(path, bytes);
    const uri = `${this.publicBaseUrl.replace(/\/$/, "")}/ipfs/${hash}`;
    return { uri, cid: hash, bytes: bytes.byteLength, pinner: "local-cas" };
  }

  async fetch(uri: string): Promise<Uint8Array | null> {
    const id = uri.split("/").pop();
    if (!id) return null;
    const path = resolve(LOCAL_CAS_DIR, id);
    if (!existsSync(path)) return null;
    return new Uint8Array(readFileSync(path));
  }
}

class Web3StoragePinner implements Pinner {
  constructor(
    private readonly token: string,
    private readonly apiUrl: string,
  ) {}

  async pin(content: string | Uint8Array, filename = "blob.json"): Promise<PinResult> {
    const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
    const form = new FormData();
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    form.append("file", blob, filename);
    const res = await fetch(`${this.apiUrl.replace(/\/$/, "")}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`Web3.storage upload failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { cid?: string; Hash?: string };
    const cid = json.cid ?? json.Hash;
    if (!cid) throw new Error("Web3.storage response missing CID");
    return { uri: `ipfs://${cid}`, cid, bytes: bytes.byteLength, pinner: "web3-storage" };
  }

  async fetch(uri: string): Promise<Uint8Array | null> {
    const cid = uri.replace(/^ipfs:\/\//, "");
    const gatewayUrl = `https://w3s.link/ipfs/${cid}`;
    const res = await fetch(gatewayUrl);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  }
}
