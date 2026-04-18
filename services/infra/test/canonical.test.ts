import { describe, expect, it } from "vitest";
import { keccak256, stringToBytes } from "viem";
import { canonicalize, type CanonicalValue } from "../src/canonical/json.js";
import { buildCanonicalManifest } from "../src/canonical/manifest.js";

describe("canonicalize", () => {
  it("sorts object keys alphabetically at every depth", () => {
    const a = canonicalize({ b: 1, a: 0, c: { y: 2, x: { z: 3, w: 4 } } });
    const b = canonicalize({ c: { x: { w: 4, z: 3 }, y: 2 }, a: 0, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":0,"b":1,"c":{"x":{"w":4,"z":3},"y":2}}');
  });

  it("preserves array insertion order (no sort)", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
    expect(canonicalize(["b", "a", "c"])).toBe('["b","a","c"]');
  });

  it("encodes bigints as JSON strings (uint256 safety)", () => {
    expect(canonicalize({ amount: 10n ** 30n })).toBe(
      '{"amount":"1000000000000000000000000000000"}',
    );
  });

  it("emits explicit nulls and drops undefined keys", () => {
    expect(canonicalize({ a: null, b: undefined, c: 1 })).toBe('{"a":null,"c":1}');
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalize({ x: Number.POSITIVE_INFINITY })).toThrow();
    expect(() => canonicalize({ x: Number.NaN })).toThrow();
  });

  it("is byte-stable across 100 random shuffles of object keys", () => {
    const base = {
      schemaVersion: "1.0.0",
      agentId: "0x" + "ab".repeat(32),
      owner: "0xdeadbeef00000000000000000000000000000001",
      proposedAction: {
        amount: "15000000",
        target: "0xabc",
        token: "0xdef",
        rationale: "x",
      },
      prompts: [{ role: "user", content: "hi", timestamp: 1700000000 }],
    } satisfies Record<string, CanonicalValue>;
    const expected = canonicalize(base);
    for (let i = 0; i < 100; i++) {
      const shuffled = shuffleKeys(base);
      expect(canonicalize(shuffled)).toBe(expected);
    }
  });

  it("produces a stable contextDigest analog (keccak256 of canonical bytes)", () => {
    const trace = {
      schemaVersion: "1.0.0",
      agentId: "0x" + "ab".repeat(32),
      proposedAction: { amount: 15_000_000n, target: "0xdead" },
    };
    const a = keccak256(stringToBytes(canonicalize(trace)));
    const b = keccak256(stringToBytes(canonicalize({ ...trace })));
    expect(a).toBe(b);
  });
});

describe("buildCanonicalManifest", () => {
  it("produces the same intentHash regardless of input field ordering", () => {
    const params = {
      owner: "0xdeAdBeef00000000000000000000000000000001",
      token: "0xCa11000000000000000000000000000000000002",
      maxSpendPerTx: "10000000" as string | number | bigint,
      maxSpendPerDay: 50_000_000 as string | number | bigint,
      allowedCounterparties: [
        "0x0000000000000000000000000000000000000111",
        "0x0000000000000000000000000000000000000222",
        "0x0000000000000000000000000000000000000333",
      ],
      expiry: 2_000_000_000n as string | number | bigint,
      nonce: 1 as string | number | bigint,
    };

    const a = buildCanonicalManifest(params);
    // Re-pass with values in different "order" / types — should yield the same hash.
    const b = buildCanonicalManifest({
      nonce: "1",
      expiry: "2000000000",
      allowedCounterparties: [...params.allowedCounterparties],
      maxSpendPerDay: "50000000",
      maxSpendPerTx: 10_000_000n,
      token: params.token,
      owner: params.owner,
    });
    expect(a.intentHash).toBe(b.intentHash);
    expect(a.json).toBe(b.json);
  });

  it("rejects empty allowedCounterparties and over-cap arrays", () => {
    const base = {
      owner: "0xdeAdBeef00000000000000000000000000000001",
      token: "0xCa11000000000000000000000000000000000002",
      maxSpendPerTx: "10000000",
      maxSpendPerDay: "50000000",
      expiry: 2_000_000_000n,
      nonce: 1,
    };
    expect(() => buildCanonicalManifest({ ...base, allowedCounterparties: [] })).toThrow();
    const tooMany = Array.from({ length: 9 }, (_, i) =>
      `0x${i.toString(16).padStart(40, "0")}`,
    );
    expect(() =>
      buildCanonicalManifest({ ...base, allowedCounterparties: tooMany }),
    ).toThrow();
  });
});

function shuffleKeys<T extends Record<string, CanonicalValue>>(obj: T): T {
  const entries = Object.entries(obj);
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = entries[i];
    entries[i] = entries[j];
    entries[j] = tmp;
  }
  return Object.fromEntries(entries) as T;
}
