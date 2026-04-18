/**
 * Reason codes — bytes32 values matching Dev 1 Solidity:
 *   bytes32 public constant X = bytes32(keccak256("NAME"));
 *
 * Solidity `keccak256("...")` hashes the UTF-8 bytes of the string (same as
 * keccak256(bytes(string)) for string literals).
 */

import { keccak256, stringToBytes, type Hex } from "viem";

function reasonHash(label: string): Hex {
  return keccak256(stringToBytes(label));
}

/** Frozen labels from specs-dev1 §3.6 */
export const REASON_CODE_HEX = {
  COUNTERPARTY_NOT_ALLOWED: reasonHash("COUNTERPARTY_NOT_ALLOWED"),
  TOKEN_NOT_USDC: reasonHash("TOKEN_NOT_USDC"),
  INTENT_EXPIRED: reasonHash("INTENT_EXPIRED"),
  DAY_CAP_EXCEEDED: reasonHash("DAY_CAP_EXCEEDED"),
  DELEGATE_NOT_APPROVED: reasonHash("DELEGATE_NOT_APPROVED"),
  TRACE_ACK_INVALID: reasonHash("TRACE_ACK_INVALID"),
  TRACE_ACK_EXPIRED: reasonHash("TRACE_ACK_EXPIRED"),
  NO_ACTIVE_INTENT: reasonHash("NO_ACTIVE_INTENT"),
} as const;

const HEX_TO_NAME = new Map<Hex, string>(
  (Object.entries(REASON_CODE_HEX) as [string, Hex][]).map(([name, hex]) => [
    hex.toLowerCase() as Hex,
    name,
  ])
);

/**
 * Map a bytes32 reason from preflight / GuardRejected to a stable label for APIs and UI.
 */
export function decodeReasonLabel(reasonCode: Hex): string {
  const hit = HEX_TO_NAME.get(reasonCode.toLowerCase() as Hex);
  return hit ?? reasonCode;
}
