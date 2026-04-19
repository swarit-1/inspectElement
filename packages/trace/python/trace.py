#!/usr/bin/env python3
"""
Cross-language helper for DecisionTrace v1 canonicalization and digesting.

Usage:
  python3 trace.py canonical < trace.json
  python3 trace.py digest < trace.json
"""

from __future__ import annotations

import json
import math
import sys
from typing import Any

MASK_64 = (1 << 64) - 1
RATE_BYTES = 136  # Keccak-256

ROTATION_OFFSETS = [
    0, 1, 62, 28, 27,
    36, 44, 6, 55, 20,
    3, 10, 43, 25, 39,
    41, 45, 15, 21, 8,
    18, 2, 61, 56, 14,
]

ROUND_CONSTANTS = [
    0x0000000000000001,
    0x0000000000008082,
    0x800000000000808A,
    0x8000000080008000,
    0x000000000000808B,
    0x0000000080000001,
    0x8000000080008081,
    0x8000000000008009,
    0x000000000000008A,
    0x0000000000000088,
    0x0000000080008009,
    0x000000008000000A,
    0x000000008000808B,
    0x800000000000008B,
    0x8000000000008089,
    0x8000000000008003,
    0x8000000000008002,
    0x8000000000000080,
    0x000000000000800A,
    0x800000008000000A,
    0x8000000080008081,
    0x8000000000008080,
    0x0000000080000001,
    0x8000000080008008,
]


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"canonical", "digest"}:
        print("Usage: python3 trace.py [canonical|digest] < trace.json", file=sys.stderr)
        return 1

    trace = json.loads(sys.stdin.read())
    canonical = serialize_canonical(trace)

    if sys.argv[1] == "canonical":
        sys.stdout.write(canonical)
        return 0

    sys.stdout.write("0x" + keccak_256(canonical.encode("utf-8")).hex())
    return 0


def serialize_canonical(value: Any) -> str:
    if value is None:
        return "null"

    if isinstance(value, bool):
        return "true" if value else "false"

    if isinstance(value, int):
        return str(value)

    if isinstance(value, float):
        if not math.isfinite(value) or not value.is_integer():
            raise ValueError(f"Invalid number in trace: {value}. Only finite integers allowed.")
        return str(int(value))

    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))

    if isinstance(value, list):
        return "[" + ",".join(serialize_canonical(item) for item in value) + "]"

    if isinstance(value, dict):
        parts = []
        for key in sorted(value.keys()):
            parts.append(
                json.dumps(key, ensure_ascii=False, separators=(",", ":"))
                + ":"
                + serialize_canonical(value[key])
            )
        return "{" + ",".join(parts) + "}"

    raise TypeError(f"Unsupported type in trace: {type(value).__name__}")


def keccak_256(data: bytes) -> bytes:
    state = [0] * 25
    offset = 0

    while offset + RATE_BYTES <= len(data):
        absorb_block(state, data[offset : offset + RATE_BYTES])
        keccak_f(state)
        offset += RATE_BYTES

    tail = bytearray(data[offset:])
    tail.append(0x01)
    if len(tail) > RATE_BYTES:
        raise ValueError("Unexpected keccak padding overflow")
    tail.extend(b"\x00" * (RATE_BYTES - len(tail)))
    tail[-1] ^= 0x80

    absorb_block(state, tail)
    keccak_f(state)

    out = bytearray()
    while len(out) < 32:
        for index in range(RATE_BYTES):
            out.append((state[index // 8] >> (8 * (index % 8))) & 0xFF)
            if len(out) == 32:
                return bytes(out)
        keccak_f(state)

    return bytes(out)


def absorb_block(state: list[int], block: bytes | bytearray) -> None:
    for index, byte in enumerate(block):
        lane = index // 8
        shift = 8 * (index % 8)
        state[lane] ^= (byte & 0xFF) << shift
        state[lane] &= MASK_64


def keccak_f(state: list[int]) -> None:
    for rc in ROUND_CONSTANTS:
        c = [
            state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20]
            for x in range(5)
        ]
        d = [
            c[(x - 1) % 5] ^ rotl64(c[(x + 1) % 5], 1)
            for x in range(5)
        ]

        for x in range(5):
            for y in range(5):
                index = x + 5 * y
                state[index] = (state[index] ^ d[x]) & MASK_64

        b = [0] * 25
        for x in range(5):
            for y in range(5):
                index = x + 5 * y
                target_x = y
                target_y = (2 * x + 3 * y) % 5
                b[target_x + 5 * target_y] = rotl64(state[index], ROTATION_OFFSETS[index])

        for x in range(5):
            for y in range(5):
                index = x + 5 * y
                state[index] = (
                    b[index]
                    ^ ((~b[((x + 1) % 5) + 5 * y] & MASK_64) & b[((x + 2) % 5) + 5 * y])
                ) & MASK_64

        state[0] ^= rc
        state[0] &= MASK_64


def rotl64(value: int, shift: int) -> int:
    shift %= 64
    if shift == 0:
        return value & MASK_64
    return ((value << shift) | (value >> (64 - shift))) & MASK_64


if __name__ == "__main__":
    raise SystemExit(main())
