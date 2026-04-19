import type { Address } from "viem";
import { getDeploymentAddresses } from "./deployments";

// ── Chain ──
export const CHAIN_ID = 84532; // Base Sepolia

// ── Demo intent constants (frozen) ──
export const DEMO_MAX_SPEND_PER_TX = 10_000_000n; // 10 USDC (6 decimals)
export const DEMO_MAX_SPEND_PER_DAY = 50_000_000n; // 50 USDC
export const DEMO_AGENT_STAKE = 50_000_000n; // 50 USDC
export const DEMO_CHALLENGE_BOND = 1_000_000n; // 1 USDC
export const DEMO_EXPIRY_DAYS = 7;

/** On-chain contract addresses (from `deployments/base-sepolia.json` + optional NEXT_PUBLIC_* overrides). */
export const CONTRACT_ADDRESSES = getDeploymentAddresses();

/** @deprecated alias — use CONTRACT_ADDRESSES */
export const PLACEHOLDER_ADDRESSES = CONTRACT_ADDRESSES;

// ── Default counterparties for demo ──
/** First address matches `fixtures/legit.json` / `overspend.json` `expectedTarget` (EIP-55 checksummed). */
export const DEFAULT_COUNTERPARTY_OPTIONS: Array<{
  label: string;
  description: string;
  address: Address;
}> = [
  {
    label: "API Merchant",
    description: "Primary allowlisted merchant for agent payments within policy caps.",
    address: "0x0000000000000000000000000000000000000a01",
  },
  {
    label: "Ops Vendor",
    description: "Secondary allowlisted vendor for recurring operational payments.",
    address: "0x1111111111111111111111111111111111111111",
  },
  {
    label: "Data Backup Vendor",
    description: "Tertiary allowlisted vendor kept here as a fallback counterparty.",
    address: "0x2222222222222222222222222222222222222222",
  },
];

export const DEFAULT_COUNTERPARTIES: Address[] = DEFAULT_COUNTERPARTY_OPTIONS.map(
  (option) => option.address
);

// ── API base URLs ──
export const INFRA_API_BASE =
  process.env.NEXT_PUBLIC_INFRA_API_URL ?? "http://localhost:8787";
/** Demo control (IF-10) — default matches `npm run demo` (services/demo-control, port 7402). */
export const RUNTIME_API_BASE =
  process.env.NEXT_PUBLIC_RUNTIME_API_URL ?? "http://localhost:7402";

// ── Feature flags ──
export const USE_MOCKS =
  process.env.NEXT_PUBLIC_USE_MOCKS === "true"; // default false

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

export function getCounterpartyOption(address: string): {
  label: string;
  description: string;
  address: Address;
} | null {
  const normalized = address.toLowerCase();
  return (
    DEFAULT_COUNTERPARTY_OPTIONS.find(
      (option) => option.address.toLowerCase() === normalized
    ) ?? null
  );
}

export function formatCounterpartyLabel(address: string): string {
  const option = getCounterpartyOption(address);
  return option ? option.label : truncateAddress(address, 4);
}
