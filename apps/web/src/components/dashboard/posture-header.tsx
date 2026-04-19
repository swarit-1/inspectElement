"use client";

import { motion } from "framer-motion";
import { HeroKpi } from "@/components/ui/hero-kpi";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DEMO_MAX_SPEND_PER_DAY,
  DEMO_MAX_SPEND_PER_TX,
  formatUsdc,
  truncateAddress,
} from "@/lib/constants";
import { easeStage } from "@/lib/motion";

interface PostureHeaderProps {
  address?: `0x${string}`;
  spentToday: bigint;
  activeToday: number;
  needsAttention: number;
  network: string;
  isReady: boolean;
}

export function PostureHeader({
  address,
  spentToday,
  activeToday,
  needsAttention,
  network,
  isReady,
}: PostureHeaderProps) {
  const remaining = DEMO_MAX_SPEND_PER_DAY - spentToday;
  const remainingPct = Math.max(
    0,
    100 - Number((spentToday * 10_000n) / DEMO_MAX_SPEND_PER_DAY) / 100,
  );

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <header className="flex flex-col gap-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.48, ease: easeStage }}
        className="flex flex-wrap items-start justify-between gap-6"
      >
        <div className="flex flex-col gap-2 min-w-0">
          <span className="eyebrow">Vault posture · {dateLabel}</span>
          <h1
            className="font-display font-semibold tracking-tight text-text-primary leading-[1.02]"
            style={{ fontSize: "var(--t-2xl)", letterSpacing: "-0.025em" }}
          >
            Today&apos;s perimeter.
          </h1>
          <p className="text-text-secondary max-w-xl">
            The live state of your agent&apos;s authority — exposure, run count, and
            anything that needs your attention in the next 24 hours.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 pt-1">
          <StatusBadge variant={isReady ? "success" : "warning"}>
            {isReady ? "Ready" : "Setup incomplete"}
          </StatusBadge>
          <div className="font-mono text-[11px] tnum text-text-tertiary">
            {network} · {address ? truncateAddress(address) : "disconnected"}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 hairline-top hairline-bottom py-8">
        <HeroKpi
          kicker="Exposure · 24h"
          value={formatUsdc(remaining)}
          unit="USDC headroom"
          tone={remainingPct < 20 ? "warning" : "default"}
          caption={
            <>
              Of{" "}
              <span className="font-mono tnum text-text-primary">
                {formatUsdc(DEMO_MAX_SPEND_PER_DAY)}
              </span>{" "}
              daily cap · per-tx ≤{" "}
              <span className="font-mono tnum text-text-primary">
                {formatUsdc(DEMO_MAX_SPEND_PER_TX)}
              </span>
            </>
          }
        />
        <HeroKpi
          kicker="Active · today"
          value={activeToday.toString().padStart(2, "0")}
          unit="runs settled"
          tone="accent"
          caption={
            <>
              Every confirmed or blocked agent attempt in the last 24 hours —
              tracked on-chain as receipts.
            </>
          }
        />
        <HeroKpi
          kicker="Needs attention"
          value={needsAttention.toString().padStart(2, "0")}
          unit={needsAttention === 1 ? "item open" : "items open"}
          tone={needsAttention > 0 ? "danger" : "default"}
          caption={
            needsAttention > 0
              ? "Overspend receipts and filed challenges awaiting your review."
              : "No pending challenges or out-of-policy receipts."
          }
        />
      </div>
    </header>
  );
}
