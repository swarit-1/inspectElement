/**
 * Trace upload client — consumes Dev 3's POST /v1/traces (IF-04).
 *
 * Uploads a DecisionTrace, receives a TraceAck, and validates that the
 * returned contextDigest matches the locally computed one.
 */

import type { DecisionTrace, TraceAck } from "./types.js";
import { serializeCanonical } from "./serialize.js";
import { computeContextDigest } from "./digest.js";
import type { Hex } from "viem";

export interface TraceUploadResponse {
  readonly traceURI: string;
  readonly contextDigest: Hex;
  readonly uriHash: Hex;
  readonly expiresAt: number;
  readonly signature: Hex;
}

export class TraceDigestMismatchError extends Error {
  constructor(
    public readonly local: Hex,
    public readonly remote: Hex
  ) {
    super(
      `TraceAck contextDigest mismatch: local=${local}, remote=${remote}. ` +
        `This indicates serialization drift between runtime and infra.`
    );
    this.name = "TraceDigestMismatchError";
  }
}

export class TraceUploadError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(`Trace upload failed (${statusCode}): ${message}`);
    this.name = "TraceUploadError";
  }
}

/**
 * Upload a trace to the infra service and return a validated TraceAck.
 *
 * @param trace - The DecisionTrace to upload
 * @param serviceUrl - Base URL of the trace service (e.g., "http://localhost:7403")
 * @returns TraceAck fields ready to embed in an ExecutionRequest
 * @throws TraceDigestMismatchError if the returned digest doesn't match local computation
 * @throws TraceUploadError if the upload fails
 */
export async function uploadTrace(
  trace: DecisionTrace,
  serviceUrl: string
): Promise<TraceUploadResponse> {
  const localDigest = computeContextDigest(trace);
  const canonicalJson = serializeCanonical(trace);

  // Send `trace` as a parsed object so Dev 3 can run canonicalize(trace) on JSON
  // (same bytes as our serializeCanonical). Sending a string would double-encode.
  const tracePayload = JSON.parse(canonicalJson) as Record<string, unknown>;

  const response = await fetch(`${serviceUrl}/v1/traces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: trace.agentId,
      owner: trace.owner,
      contextDigest: localDigest,
      trace: tracePayload,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "unknown error");
    throw new TraceUploadError(response.status, body);
  }

  const data = (await response.json()) as TraceUploadResponse;

  // Critical: validate that the remote contextDigest matches our local computation.
  // A mismatch means the infra service is using a different serialization,
  // which would cause the on-chain guard to reject the TraceAck.
  if (data.contextDigest !== localDigest) {
    throw new TraceDigestMismatchError(localDigest, data.contextDigest);
  }

  return data;
}

/**
 * Convert a TraceUploadResponse into a TraceAck struct for ExecutionRequest.
 */
export function toTraceAck(response: TraceUploadResponse): TraceAck {
  return {
    contextDigest: response.contextDigest,
    uriHash: response.uriHash,
    expiresAt: response.expiresAt,
    signature: response.signature,
  };
}
