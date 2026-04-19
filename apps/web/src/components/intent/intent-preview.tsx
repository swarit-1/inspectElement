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
    <aside className="flex min-w-0 flex-col gap-4 2xl:pl-2">
      <div className="flex flex-col gap-2 hairline-bottom pb-4 md:flex-row md:items-baseline md:justify-between md:gap-4">
        <span className="eyebrow">Manifest spec</span>
        <span className="font-mono text-[10px] tnum text-text-quat md:text-right">
          EIP-712 / pinned to infra
        </span>
      </div>

      <dl className="flex flex-col gap-4 text-[12px] tnum">
        <Row label="token">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-text-secondary whitespace-nowrap">
              USDC
            </span>
            <span className="font-mono text-[11px] text-text-quat whitespace-nowrap">
              {truncateAddress(CONTRACT_ADDRESSES.usdc, 4)}
            </span>
          </div>
        </Row>

        <Row label="maxSpendPerTx">
          <span className="font-mono font-semibold text-text-primary whitespace-nowrap">
            {formatUsdc(maxSpendPerTx)} USDC
          </span>
        </Row>

        <Row label="maxSpendPerDay">
          <span className="font-mono font-semibold text-text-primary whitespace-nowrap">
            {formatUsdc(maxSpendPerDay)} USDC
          </span>
        </Row>

        <Row label="allowedCounterparties">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-text-secondary whitespace-nowrap">
              [{counterparties.length}]
            </span>
            {counterparties.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {counterparties.map((counterparty) => (
                  <CounterpartyPill key={counterparty} address={counterparty} />
                ))}
              </div>
            )}
          </div>
        </Row>

        <Row label="expiry">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-text-secondary whitespace-nowrap">
              {expiryDays}d
            </span>
            <span className="text-text-quat whitespace-nowrap">
              ({expiryDate.toLocaleDateString()})
            </span>
          </div>
        </Row>

        <Row label="nonce">
          <span className="font-mono text-text-secondary whitespace-nowrap">
            auto · ts
          </span>
        </Row>
      </dl>

      {intentHash ? (
        <div className="hairline-top pt-3 mt-1">
          <div className="eyebrow text-success mb-1.5">● Intent hash</div>
          <code className="block font-mono text-[11px] tnum text-accent break-words leading-relaxed overflow-hidden">
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
    </aside>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 border-b border-rule-subtle pb-4 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,9.75rem)_minmax(0,1fr)] sm:items-start sm:gap-x-5 sm:gap-y-1.5">
      <dt className="font-mono text-text-quat text-[11px] uppercase tracking-wider self-start pt-px">
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function CounterpartyPill({ address }: { address: Address }) {
  return (
    <div className="min-w-0 border border-rule-subtle bg-bg-raised/20 px-3 py-2">
      <div className="text-[12px] text-text-primary">
        {formatCounterpartyLabel(address)}
      </div>
      <div className="font-mono text-[10.5px] text-text-quat mt-1 whitespace-nowrap">
        {truncateAddress(address, 4)}
      </div>
    </div>
  );
}
