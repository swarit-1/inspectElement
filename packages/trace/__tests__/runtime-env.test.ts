import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGENT_METADATA_URI,
  DEFAULT_RUNTIME_RPC_URL,
  deriveAgentId,
  loadRuntimeEnv,
  resolveRuntimeRpcUrl,
} from "../src/index.js";

const TEST_OPERATOR_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

describe("runtime env", () => {
  it("prefers RPC_URL over BASE_SEPOLIA_RPC_URL", () => {
    expect(
      resolveRuntimeRpcUrl({
        RPC_URL: "https://rpc.primary.example",
        BASE_SEPOLIA_RPC_URL: "https://rpc.alias.example",
      })
    ).toBe("https://rpc.primary.example");
  });

  it("falls back to BASE_SEPOLIA_RPC_URL when RPC_URL is unset", () => {
    expect(
      resolveRuntimeRpcUrl({
        BASE_SEPOLIA_RPC_URL: "https://rpc.alias.example",
      })
    ).toBe("https://rpc.alias.example");
  });

  it("falls back to the default RPC URL when neither env var is set", () => {
    expect(resolveRuntimeRpcUrl({})).toBe(DEFAULT_RUNTIME_RPC_URL);
  });

  it("derives a stable agentId from operator address and salt", () => {
    const runtime = loadRuntimeEnv({
      OPERATOR_PRIVATE_KEY: TEST_OPERATOR_KEY,
      AGENT_SALT: "intentguard-demo-agent-v1",
    });

    expect(runtime.agentId).toBe(
      deriveAgentId(runtime.account.address, "intentguard-demo-agent-v1")
    );
  });

  it("uses the default metadata URI when unset", () => {
    const runtime = loadRuntimeEnv({
      OPERATOR_PRIVATE_KEY: TEST_OPERATOR_KEY,
    });

    expect(runtime.agentMetadataUri).toBe(DEFAULT_AGENT_METADATA_URI);
  });
});
