/**
 * @intentguard/trace — DecisionTrace v1 schema, canonical serializer, and digest.
 *
 * This is the single most important artifact owned by Dev 2.
 * Dev 3 imports it for trace storage; Dev 1's guard verifies the digest.
 */

export type {
  DecisionTrace,
  SessionInfo,
  PromptMessage,
  ToolCall,
  Observation,
  ProposedAction,
  TraceAck,
  ExecutionRequest,
  ReasonCode,
} from "./types.js";

export { GuardDecision, REASON_CODES } from "./types.js";
export { serializeCanonical } from "./serialize.js";
export { computeContextDigest } from "./digest.js";
export { uploadTrace, toTraceAck, TraceDigestMismatchError, TraceUploadError } from "./trace-client.js";
export type { TraceUploadResponse } from "./trace-client.js";
export { createGuardClient, GuardRejectedError } from "./guard-client.js";
export type { PreflightResult, GuardClientOptions, GuardClient } from "./guard-client.js";
export { loadDeploymentConfig, clearConfigCache } from "./config.js";
export type { DeploymentConfig } from "./config.js";
export { GuardedExecutorABI, AgentRegistryABI, ERC20ABI } from "./abi.js";
