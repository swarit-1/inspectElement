/**
 * Context digest computation for DecisionTrace v1.
 *
 * contextDigest = keccak256(serializeCanonical(trace))
 *
 * This digest is committed on-chain in the TraceAck and verified
 * by GuardedExecutor. It must be reproducible across runs and languages.
 */

import { keccak256, toHex, type Hex } from "viem";
import type { DecisionTrace } from "./types.js";
import { serializeCanonical } from "./serialize.js";

/**
 * Compute the context digest for a DecisionTrace.
 * Returns a bytes32 hex string suitable for on-chain use.
 */
export function computeContextDigest(trace: DecisionTrace): Hex {
  const canonical = serializeCanonical(trace);
  const bytes = new TextEncoder().encode(canonical);
  return keccak256(toHex(bytes));
}
