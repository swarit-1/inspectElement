import type { Address } from "viem";

// ── Chain ──
export const CHAIN_ID = 84532; // Base Sepolia

// ── Demo intent constants (frozen) ──
export const DEMO_MAX_SPEND_PER_TX = 10_000_000n; // 10 USDC (6 decimals)
export const DEMO_MAX_SPEND_PER_DAY = 50_000_000n; // 50 USDC
export const DEMO_AGENT_STAKE = 50_000_000n; // 50 USDC
export const DEMO_CHALLENGE_BOND = 1_000_000n; // 1 USDC
export const DEMO_EXPIRY_DAYS = 7;

// ── Placeholder addresses (replaced by deployments/base-sepolia.json) ──
export const PLACEHOLDER_ADDRESSES = {
  usdc: "0x0000000000000000000000000000000000000001" as Address,
  intentRegistry: "0x0000000000000000000000000000000000000002" as Address,
  guardedExecutor: "0x0000000000000000000000000000000000000003" as Address,
  agentRegistry: "0x0000000000000000000000000000000000000004" as Address,
  challengeArbiter: "0x0000000000000000000000000000000000000005" as Address,
  stakeVault: "0x0000000000000000000000000000000000000006" as Address,
};

// ── Default counterparties for demo ──
export const DEFAULT_COUNTERPARTIES: Address[] = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
];

// ── API base URLs ──
export const INFRA_API_BASE =
  process.env.NEXT_PUBLIC_INFRA_API_URL ?? "http://localhost:4000";
export const RUNTIME_API_BASE =
  process.env.NEXT_PUBLIC_RUNTIME_API_URL ?? "http://localhost:4001";

// ── Feature flags ──
export const USE_MOCKS =
  process.env.NEXT_PUBLIC_USE_MOCKS !== "false"; // default true

// ── Display helpers ──
export const USDC_DECIMALS = 6;

export function formatUsdc(raw: string | bigint): string {
  const value =
    typeof raw === "bigint" ? raw : BigInt(raw);
  const whole = value / 10n ** BigInt(USDC_DECIMALS);
  const frac = value % 10n ** BigInt(USDC_DECIMALS);
  const fracStr = frac.toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}

export function truncateAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}
