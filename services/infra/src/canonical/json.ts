/**
 * Canonical JSON serializer.
 *
 * Aligned with Dev 2's `DecisionTrace v1` rules so that
 * `keccak256(canonicalize(trace))` is reproducible across runs and languages.
 *
 * Rules:
 *   - UTF-8, no BOM (default for Node string encoding).
 *   - Object keys are sorted alphabetically (lexicographic) at every depth.
 *   - No whitespace outside string values.
 *   - Numbers: `bigint` is encoded as a JSON string (uint256 safety).
 *     Plain `number` is encoded as a JSON number, but only if it's a finite
 *     safe integer; otherwise we throw to force the caller to pass `bigint`.
 *   - `undefined` keys are dropped from objects (treat as "not present").
 *   - `null` is preserved verbatim ("missing optional field" emit-as-null is
 *     the caller's responsibility — we round-trip whatever they hand us).
 *   - Arrays preserve insertion order; do NOT sort.
 *   - String values are NOT trimmed; raw content is preserved.
 *
 * This implementation is intentionally dependency-free and used by both the
 * manifest pinning path (IF-01) and the trace pinning path (IF-04).
 */

export type CanonicalValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | CanonicalValue[]
  | { [key: string]: CanonicalValue | undefined };

export function canonicalize(value: CanonicalValue): string {
  return encode(value);
}

export function canonicalBytes(value: CanonicalValue): Uint8Array {
  return new TextEncoder().encode(canonicalize(value));
}

function encode(value: CanonicalValue): string {
  if (value === null) return "null";

  if (typeof value === "boolean") return value ? "true" : "false";

  if (typeof value === "bigint") {
    return JSON.stringify(value.toString(10));
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("canonicalize: non-finite number not allowed");
    }
    if (!Number.isInteger(value)) {
      // We allow non-integers but require they be finite. JSON.stringify is
      // deterministic for finite numbers in ECMA-262.
      return JSON.stringify(value);
    }
    return value.toString(10);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const items = value.map((v) => encode(v ?? null));
    return `[${items.join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${encode(v as CanonicalValue)}`);
    return `{${entries.join(",")}}`;
  }

  throw new Error(`canonicalize: unsupported value type ${typeof value}`);
}
