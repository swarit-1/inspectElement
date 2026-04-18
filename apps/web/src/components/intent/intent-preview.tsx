import { formatUsdc, truncateAddress, PLACEHOLDER_ADDRESSES } from "@/lib/constants";
import type { Address, Hex } from "viem";

interface IntentPreviewProps {
  maxSpendPerTx: bigint;
  maxSpendPerDay: bigint;
  counterparties: Address[];
  expiryDays: number;
  intentHash: Hex | null;
}

export function IntentPreview({
  maxSpendPerTx,
  maxSpendPerDay,
  counterparties,
  expiryDays,
  intentHash,
}: IntentPreviewProps) {
  const expiry = Math.floor(Date.now() / 1000) + expiryDays * 86400;

  const manifest = {
    token: PLACEHOLDER_ADDRESSES.usdc,
    maxSpendPerTx: maxSpendPerTx.toString(),
    maxSpendPerDay: maxSpendPerDay.toString(),
    allowedCounterparties: counterparties,
    expiry,
    nonce: "auto",
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
        Manifest Preview
      </span>
      <pre className="bg-bg-raised border border-border-subtle rounded-[--radius-md] p-4 text-xs text-text-secondary font-mono leading-relaxed overflow-x-auto">
        {JSON.stringify(manifest, null, 2)}
      </pre>
      {intentHash && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-text-tertiary uppercase tracking-wider">
            Intent Hash
          </span>
          <span className="text-xs font-mono text-accent break-all">
            {intentHash}
          </span>
        </div>
      )}
    </div>
  );
}
