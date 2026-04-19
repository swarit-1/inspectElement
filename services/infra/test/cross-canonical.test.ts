import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { keccak256, stringToBytes } from "viem";
import { canonicalize, type CanonicalValue } from "../src/canonical/json.js";
import { serializeCanonical } from "../../../packages/trace/src/serialize.js";
import { computeContextDigest } from "../../../packages/trace/src/digest.js";
import type { DecisionTrace } from "../../../packages/trace/src/types.js";

/**
 * Tier 1a — cross-implementation determinism.
 *
 * The demo dies silently if Dev 2's `serializeCanonical` and Dev 3's
 * `canonicalize` ever produce a different `keccak256` for the same trace.
 * This test loads every fixture Dev 2 ships and proves both serializers
 * agree byte-for-byte and hash-for-hash.
 */

const FIXTURES = ["legit", "blocked", "overspend"] as const;

function loadFixture(name: (typeof FIXTURES)[number]): DecisionTrace {
  const path = resolve(__dirname, "../../../fixtures", `${name}.json`);
  const raw = JSON.parse(readFileSync(path, "utf-8")) as { trace: DecisionTrace };
  return raw.trace;
}

describe("cross-canonical: Dev 2 serializeCanonical vs Dev 3 canonicalize", () => {
  for (const name of FIXTURES) {
    it(`fixture "${name}" produces an identical keccak256 from both serializers`, () => {
      const trace = loadFixture(name);

      const devTwoBytes = serializeCanonical(trace);
      const devTwoDigest = computeContextDigest(trace);

      const devThreeBytes = canonicalize(trace as unknown as CanonicalValue);
      const devThreeDigest = keccak256(stringToBytes(devThreeBytes));

      expect(devThreeDigest).toBe(devTwoDigest);

      // If the digests match the bytes might still differ if both libs happen
      // to collide; surface byte-level differences for easier debugging.
      if (devTwoBytes !== devThreeBytes) {
        const len = Math.min(devTwoBytes.length, devThreeBytes.length);
        let firstDiff = -1;
        for (let i = 0; i < len; i++) {
          if (devTwoBytes[i] !== devThreeBytes[i]) {
            firstDiff = i;
            break;
          }
        }
        throw new Error(
          `byte-level mismatch at offset ${firstDiff} (or length: ` +
            `${devTwoBytes.length} vs ${devThreeBytes.length}); digests collided?`,
        );
      }
      expect(devThreeBytes).toBe(devTwoBytes);
    });
  }

  it("is invariant under top-level key shuffles in both serializers", () => {
    const trace = loadFixture("legit");
    const expectedDigest = computeContextDigest(trace);

    const shuffledTopLevel = Object.fromEntries(
      Object.entries(trace).reverse(),
    ) as unknown as DecisionTrace;

    expect(computeContextDigest(shuffledTopLevel)).toBe(expectedDigest);

    const myShuffled = canonicalize(shuffledTopLevel as unknown as CanonicalValue);
    expect(keccak256(stringToBytes(myShuffled))).toBe(expectedDigest);
  });

  it("agrees on edge cases: explicit nulls, empty arrays, nested objects in toolCalls", () => {
    const edge = {
      schemaVersion: "1.0.0",
      agentId: "0x" + "01".repeat(32),
      owner: "0x000000000000000000000000000000000000beef",
      intentHash: "0x" + "00".repeat(32),
      session: { id: "x", startedAt: 0, model: "m", temperature: 0 },
      prompts: [],
      toolCalls: [
        {
          name: "n",
          input: { z: 1, a: { y: "y", b: "b" } },
          output: {},
          timestamp: 0,
        },
      ],
      observations: [],
      proposedAction: {
        target: "0x" + "ab".repeat(20),
        token: "0x" + "cd".repeat(20),
        amount: "1",
        callData: "0x",
        rationale: "x",
      },
      nonce: 0,
    } as unknown as DecisionTrace;

    expect(canonicalize(edge as unknown as CanonicalValue)).toBe(serializeCanonical(edge));
  });
});
