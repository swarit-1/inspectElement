import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGENT_METADATA_URI,
  DEFAULT_RUNTIME_RPC_URL,
  deriveAgentId,
  loadRuntimeEnv,
  resolveRuntimeRpcUrl,
  resolveSignerProvider,
} from "../src/index.js";

const TEST_OPERATOR_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const TEST_OWNER_KEY =
  "0x59c6995e998f97a5a0044966f0945382d7d6d3f6aa3dbe8b6f2a68d4d5f7d9e7";

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
      OWNER_PRIVATE_KEY: TEST_OWNER_KEY,
      AGENT_SALT: "intentguard-demo-agent-v1",
    });

    expect(runtime.account).toBeDefined();
    expect(runtime.agentId).toBe(
      deriveAgentId(runtime.account!.address, "intentguard-demo-agent-v1")
    );
  });

  it("uses the default metadata URI when unset", () => {
    const runtime = loadRuntimeEnv({
      OPERATOR_PRIVATE_KEY: TEST_OPERATOR_KEY,
      OWNER_PRIVATE_KEY: TEST_OWNER_KEY,
    });

    expect(runtime.agentMetadataUri).toBe(DEFAULT_AGENT_METADATA_URI);
  });

  it("falls back to the local demo owner on hardhat when OWNER_PRIVATE_KEY is unset", () => {
    const runtime = loadRuntimeEnv({
      OPERATOR_PRIVATE_KEY: TEST_OPERATOR_KEY,
      CHAIN_ID: "31337",
    });

    expect(runtime.account).toBeDefined();
    expect(runtime.ownerAccount.address).not.toBe(runtime.account!.address);
  });

  describe("signer provider selection", () => {
    it("defaults to local when no CDP creds are present", () => {
      expect(resolveSignerProvider({})).toBe("local");
    });

    it("auto-detects cdp when all three CDP env vars are present", () => {
      expect(
        resolveSignerProvider({
          CDP_API_KEY_ID: "id",
          CDP_API_KEY_SECRET: "secret",
          CDP_WALLET_SECRET: "wallet",
        })
      ).toBe("cdp");
    });

    it("respects explicit AGENT_SIGNER override", () => {
      expect(
        resolveSignerProvider({
          AGENT_SIGNER: "local",
          CDP_API_KEY_ID: "id",
          CDP_API_KEY_SECRET: "secret",
          CDP_WALLET_SECRET: "wallet",
        })
      ).toBe("local");
      expect(resolveSignerProvider({ AGENT_SIGNER: "cdp" })).toBe("cdp");
    });

    it("does not require OPERATOR_PRIVATE_KEY in cdp mode and leaves account/agentId undefined", () => {
      const runtime = loadRuntimeEnv({
        AGENT_SIGNER: "cdp",
        OWNER_PRIVATE_KEY: TEST_OWNER_KEY,
        CDP_API_KEY_ID: "id",
        CDP_API_KEY_SECRET: "secret",
        CDP_WALLET_SECRET: "wallet",
      });
      expect(runtime.signerProvider).toBe("cdp");
      expect(runtime.account).toBeUndefined();
      expect(runtime.agentId).toBeUndefined();
      expect(runtime.operatorKey).toBeUndefined();
      expect(runtime.ownerAccount.address).toBeDefined();
    });

    it("still throws when local mode is selected and OPERATOR_PRIVATE_KEY is missing", () => {
      expect(() =>
        loadRuntimeEnv({
          AGENT_SIGNER: "local",
          OWNER_PRIVATE_KEY: TEST_OWNER_KEY,
        })
      ).toThrow(/OPERATOR_PRIVATE_KEY/);
    });
  });
});
