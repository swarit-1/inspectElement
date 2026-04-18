import type { Address, Hex } from "viem";
import { getAddress, isAddress, isHex, toHex } from "viem";

export function ensureHex(value: string, label: string): Hex {
  if (!isHex(value)) throw new Error(`${label} must be a 0x-prefixed hex string`);
  return value as Hex;
}

export function ensureBytes32(value: string, label: string): Hex {
  const v = ensureHex(value, label);
  if (v.length !== 66) throw new Error(`${label} must be 32 bytes (66 hex chars including 0x)`);
  return v;
}

export function ensureAddress(value: string, label: string): Address {
  if (!isAddress(value)) throw new Error(`${label} must be a valid EVM address`);
  return getAddress(value);
}

export function uintToHex(value: bigint | number | string): Hex {
  return toHex(BigInt(value));
}

export function lowerAddress(value: string): string {
  return value.toLowerCase();
}
