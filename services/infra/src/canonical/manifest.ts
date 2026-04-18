import { getAddress, keccak256, type Address, type Hex } from "viem";
import { canonicalBytes, type CanonicalValue } from "./json.js";

/**
 * Canonical manifest shape stored on IPFS and hashed into `intentHash`.
 *
 * Mirrors Solidity `IntentConfig` from PRD §3.5 / Dev 1 spec §3.7. Values
 * that map to `uint256` on-chain are emitted as JSON strings so the canonical
 * digest matches across languages without precision loss.
 */
export interface ManifestInput {
  owner: string;
  token: string;
  maxSpendPerTx: string | bigint | number;
  maxSpendPerDay: string | bigint | number;
  allowedCounterparties: string[];
  expiry: number | bigint | string;
  nonce: string | bigint | number;
  /** Optional metadata. Excluded from on-chain `IntentConfig` but pinned for audit. */
  metadata?: Record<string, unknown> | null;
}

export interface CanonicalManifest {
  schemaVersion: "1.0.0";
  owner: Address;
  token: Address;
  maxSpendPerTx: bigint;
  maxSpendPerDay: bigint;
  allowedCounterparties: Address[];
  expiry: bigint;
  nonce: bigint;
  metadata: Record<string, unknown> | null;
}

export interface CanonicalManifestResult {
  manifest: CanonicalManifest;
  json: string;
  intentHash: Hex;
}

const MAX_ALLOWED_COUNTERPARTIES = 8;

export function buildCanonicalManifest(input: ManifestInput): CanonicalManifestResult {
  const owner = getAddress(input.owner);
  const token = getAddress(input.token);

  if (!Array.isArray(input.allowedCounterparties)) {
    throw new Error("allowedCounterparties must be an array");
  }
  if (input.allowedCounterparties.length === 0) {
    throw new Error("allowedCounterparties must contain at least one address");
  }
  if (input.allowedCounterparties.length > MAX_ALLOWED_COUNTERPARTIES) {
    throw new Error(
      `allowedCounterparties length ${input.allowedCounterparties.length} exceeds cap of ${MAX_ALLOWED_COUNTERPARTIES}`,
    );
  }

  const allowedCounterparties = input.allowedCounterparties.map((a, i) => {
    try {
      return getAddress(a);
    } catch {
      throw new Error(`allowedCounterparties[${i}] is not a valid EVM address`);
    }
  });

  const manifest: CanonicalManifest = {
    schemaVersion: "1.0.0",
    owner,
    token,
    maxSpendPerTx: toUint(input.maxSpendPerTx, "maxSpendPerTx"),
    maxSpendPerDay: toUint(input.maxSpendPerDay, "maxSpendPerDay"),
    allowedCounterparties,
    expiry: toUint(input.expiry, "expiry"),
    nonce: toUint(input.nonce, "nonce"),
    metadata: input.metadata ?? null,
  };

  if (manifest.maxSpendPerTx === 0n) throw new Error("maxSpendPerTx must be > 0");
  if (manifest.maxSpendPerDay === 0n) throw new Error("maxSpendPerDay must be > 0");
  if (manifest.expiry === 0n) throw new Error("expiry must be > 0");

  const canonicalValue: CanonicalValue = {
    schemaVersion: manifest.schemaVersion,
    owner: manifest.owner,
    token: manifest.token,
    maxSpendPerTx: manifest.maxSpendPerTx,
    maxSpendPerDay: manifest.maxSpendPerDay,
    allowedCounterparties: manifest.allowedCounterparties,
    expiry: manifest.expiry,
    nonce: manifest.nonce,
    metadata: (manifest.metadata as CanonicalValue | null) ?? null,
  };

  const bytes = canonicalBytes(canonicalValue);
  const json = new TextDecoder().decode(bytes);
  const intentHash = keccak256(bytes);

  return { manifest, json, intentHash };
}

function toUint(value: string | number | bigint, label: string): bigint {
  try {
    if (typeof value === "bigint") {
      if (value < 0n) throw new Error("negative");
      return value;
    }
    if (typeof value === "number") {
      if (!Number.isInteger(value) || value < 0) throw new Error("not a non-negative integer");
      return BigInt(value);
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!/^\d+$/.test(trimmed)) throw new Error("not a base-10 integer string");
      return BigInt(trimmed);
    }
    throw new Error(`unsupported type ${typeof value}`);
  } catch (e) {
    throw new Error(`${label}: ${(e as Error).message}`);
  }
}
