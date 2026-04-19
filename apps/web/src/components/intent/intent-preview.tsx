import { useState } from "react";
import {
  CONTRACT_ADDRESSES,
  formatCounterpartyLabel,
  formatUsdc,
  truncateAddress,
} from "@/lib/constants";
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
  const [previewStartedAt] = useState(() => Date.now());
  const expiryDate = new Date(previewStartedAt + expiryDays * 86400_000);

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between hairline-bottom pb-3">
        <span className="eyebrow">Manifest spec</span>
        <span className="font-mono text-[10px] tnum text-text-quat">
          EIP-712 / pinned to infra
        </span>
      </div>

      {/* Definition list */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 py-4 text-[12px] tnum">
        <DT>token</DT>
        <DD mono>USDC · {truncateAddress(CONTRACT_ADDRESSES.usdc, 4)}</DD>

        <DT>maxSpendPerTx</DT>
        <DD mono accent>{formatUsdc(maxSpendPerTx)} USDC</DD>

        <DT>maxSpendPerDay</DT>
        <DD mono accent>{formatUsdc(maxSpendPerDay)} USDC</DD>

        <DT>allowedCounterparties</DT>
        <DD mono>
          [{counterparties.length}]
          {counterparties.length > 0 && (
            <span className="block text-text-tertiary mt-1">
              {counterparties
                .map((c) => `${formatCounterpartyLabel(c)} · ${truncateAddress(c, 4)}`)
                .join(", ")}
            </span>
          )}
        </DD>

        <DT>expiry</DT>
        <DD>
          <span className="text-text-secondary">{expiryDays}d</span>
          <span className="text-text-quat ml-2">
            ({expiryDate.toLocaleDateString()})
          </span>
        </DD>

        <DT>nonce</DT>
        <DD mono>auto · ts</DD>
      </dl>

      {intentHash ? (
        <div className="hairline-top pt-3 mt-1">
          <div className="eyebrow text-success mb-1.5">● Intent hash</div>
          <code className="block font-mono text-[11px] tnum text-accent break-all leading-relaxed">
            {intentHash}
          </code>
        </div>
      ) : (
        <div className="hairline-top pt-3 mt-1">
          <div className="eyebrow mb-1.5">○ Intent hash</div>
          <span className="font-mono text-[11px] text-text-quat">
            — pending sign &amp; commit —
          </span>
        </div>
      )}
    </div>
  );
}

function DT({ children }: { children: React.ReactNode }) {
  return (
    <dt className="font-mono text-text-quat text-[11px] uppercase tracking-wider self-start pt-px">
      {children}
    </dt>
  );
}

function DD({
  children,
  mono,
  accent,
}: {
  children: React.ReactNode;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <dd
      className={`${mono ? "font-mono" : ""} ${accent ? "text-text-primary font-semibold" : "text-text-secondary"} break-all`}
    >
      {children}
    </dd>
  );
}
