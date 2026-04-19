# `@intentguard/trace-schema`

Frozen Dev 2 trace helpers for IntentGuard:
- `DecisionTrace v1` TypeScript types
- canonical JSON serialization
- `contextDigest = keccak256(canonicalTraceJson)`
- schema export at `@intentguard/trace-schema/schema`
- Python parity helper at `packages/trace/python/trace.py`

## TypeScript

```ts
import {
  serializeCanonical,
  computeContextDigest,
  validateDecisionTrace,
} from "@intentguard/trace-schema";
```

## Python

```bash
python3 packages/trace/python/trace.py canonical < trace.json
python3 packages/trace/python/trace.py digest < trace.json
```

The Python helper reads a raw `DecisionTrace` JSON object from stdin and emits:
- `canonical`: canonical JSON bytes as UTF-8 text
- `digest`: `0x`-prefixed keccak256 digest of the canonical JSON
