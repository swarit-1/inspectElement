import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const EnvSchema = z.object({
  RPC_URL: z.string().url().default("https://sepolia.base.org"),
  CHAIN_ID: z.coerce.number().int().positive().default(84532),

  PORT: z.coerce.number().int().positive().default(8787),
  HOST: z.string().default("0.0.0.0"),
  CORS_ORIGIN: z.string().default("*"),

  DATABASE_URL: z.string().default("./data/infra.db"),

  TRACE_ACK_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "TRACE_ACK_PRIVATE_KEY must be a 32-byte hex string"),
  REVIEWER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "REVIEWER_PRIVATE_KEY must be a 32-byte hex string")
    .optional(),

  IPFS_TOKEN: z.string().optional(),
  IPFS_API_URL: z.string().url().default("https://api.web3.storage"),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:8787"),

  TRACE_ACK_TTL_SECONDS: z.coerce.number().int().positive().default(600),

  DEPLOYMENTS_PATH: z.string().optional(),

  INDEXER_POLL_MS: z.coerce.number().int().positive().default(2500),
  INDEXER_BATCH_BLOCKS: z.coerce.number().int().positive().default(2000),
  INDEXER_START_BLOCK: z.coerce.bigint().optional(),

  REVIEWER_BROADCAST: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export interface DeploymentManifest {
  chainId: number;
  contracts: {
    IntentRegistry: `0x${string}`;
    AgentRegistry: `0x${string}`;
    GuardedExecutor: `0x${string}`;
    ChallengeArbiter: `0x${string}`;
    StakeVault: `0x${string}`;
    USDC: `0x${string}`;
  };
  traceAckSigner: `0x${string}`;
  reviewerSigner: `0x${string}`;
  startBlock?: number | string;
  constants: {
    chainId: number;
    maxSpendPerTx: string;
    maxSpendPerDay: string;
    agentStake: string;
    challengeBond: string;
    challengeWindowSec: number;
  };
}

export function loadDeployments(env: Env): DeploymentManifest | null {
  const candidates = [
    env.DEPLOYMENTS_PATH,
    resolve(process.cwd(), "deployments/base-sepolia.json"),
    resolve(process.cwd(), "../../deployments/base-sepolia.json"),
    resolve(process.cwd(), "../deployments/base-sepolia.json"),
  ].filter(Boolean) as string[];

  for (const path of candidates) {
    if (existsSync(path)) {
      const raw = readFileSync(path, "utf-8");
      return JSON.parse(raw) as DeploymentManifest;
    }
  }
  return null;
}
