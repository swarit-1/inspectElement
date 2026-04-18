import { createPublicClient, http, type PublicClient } from "viem";
import { baseSepolia } from "viem/chains";
import { loadEnv, type Env } from "../config/env.js";

export function createIndexerClient(env: Env = loadEnv()): PublicClient {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(env.RPC_URL, { retryCount: 3, timeout: 15_000 }),
  }) as PublicClient;
}
