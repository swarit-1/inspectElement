/**
 * @intentguard/trace — DecisionTrace v1 schema, canonical serializer, and digest.
 *
 * This is the single most important artifact owned by Dev 2.
 * Dev 3 imports it for trace storage; Dev 1's guard verifies the digest.
 *
 * @see `specs/specs-dev2.md` — frozen schema rules and deliverables.
 */

export { DECISION_TRACE_SCHEMA_VERSION } from "./types.js";
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
export type {
  PreflightResult,
  GuardClientOptions,
  GuardClient,
  ExecuteResult,
} from "./guard-client.js";
export { REASON_CODE_HEX, decodeReasonLabel } from "./reason-codes.js";
export { loadDeploymentConfig, clearConfigCache } from "./config.js";
export type { DeploymentConfig } from "./config.js";
export {
  DEFAULT_RUNTIME_RPC_URL,
  DEFAULT_TRACE_SERVICE_URL,
  DEFAULT_AGENT_SALT,
  DEFAULT_AGENT_METADATA_URI,
  DEFAULT_MERCHANT_ADDRESS,
  DEFAULT_DEMO_PORT,
  DEFAULT_MOCK_X402_PORT,
  resolveRuntimeRpcUrl,
  resolveTraceServiceUrl,
  resolveAgentSalt,
  resolveAgentMetadataUri,
  resolveMerchantAddress,
  resolveDemoPort,
  resolveMockX402Port,
  deriveAgentId,
  loadRuntimeEnv,
} from "./runtime-env.js";
export type { RuntimeEnv } from "./runtime-env.js";
export { GuardedExecutorABI, AgentRegistryABI, ERC20ABI } from "./abi.js";
