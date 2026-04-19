"use client";

import { motion } from "framer-motion";
import { DEMO_MAX_SPEND_PER_TX, formatUsdc } from "@/lib/constants";
import { easeOutExpo } from "@/lib/motion";

interface DeltaVizProps {
  amount: string;
}

export function DeltaViz({ amount }: DeltaVizProps) {
  const actual = BigInt(amount);
  const cap = DEMO_MAX_SPEND_PER_TX;
  const over = actual > cap ? actual - cap : 0n;
  const total = actual > cap ? actual : cap;

  const allowedPct = Number((cap * 10_000n) / total) / 100;
  const overPct = 100 - allowedPct;

  return (
    <section className="flex flex-col gap-5 hairline-top hairline-bottom py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow text-warning">Cap breach analysis</span>
          <h3
            className="font-display font-semibold tracking-tight text-text-primary mt-1.5"
            style={{ fontSize: "var(--t-lg)", letterSpacing: "-0.02em" }}
          >
            {formatUsdc(over)} USD over policy
          </h3>
          <p className="text-[12.5px] text-text-tertiary mt-1 max-w-[56ch]">
            The per-transaction cap is{" "}
            <span className="font-mono text-text-secondary">
              {formatUsdc(cap)} USD
            </span>
            . This receipt exceeds that cap by the amount below.
          </p>
        </div>
        <div className="flex items-center gap-6 font-mono text-[11px] tnum uppercase tracking-[0.2em]">
          <span className="flex items-center gap-2 text-success">
            <span aria-hidden className="h-2 w-2 bg-success" />
            allowed
          </span>
          <span className="flex items-center gap-2 text-warning">
            <span aria-hidden className="h-2 w-2 bg-warning" />
            overage
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <div className="relative h-4 w-full bg-bg-inset overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${allowedPct}%` }}
            transition={{ duration: 0.7, ease: easeOutExpo }}
            className="absolute inset-y-0 left-0 bg-success-dim"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${overPct}%` }}
            transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.15 }}
            className="absolute inset-y-0 bg-warning"
            style={{ left: `${allowedPct}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-px bg-accent"
            style={{ left: `${allowedPct}%` }}
            aria-hidden
          />
        </div>

        <div className="relative h-4 text-[10px] tnum font-mono text-text-quat uppercase tracking-wider">
          <span className="absolute left-0">0</span>
          <span
            className="absolute -translate-x-1/2 text-accent"
            style={{ left: `${allowedPct}%` }}
          >
            ▲ cap
          </span>
          <span className="absolute right-0 text-warning">
            {formatUsdc(actual)}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-1 md:grid-cols-3 gap-px bg-rule-subtle">
        <Stat label="Allowed" value={`${formatUsdc(cap)} USD`} tone="success" />
        <Stat
          label="Actual"
          value={`${formatUsdc(actual)} USD`}
          tone="warning"
        />
        <Stat
          label="Excess (claimable)"
          value={`${formatUsdc(over)} USD`}
          tone="warning"
        />
      </dl>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning";
}) {
  const toneClass = tone === "success" ? "text-success" : "text-warning";
  return (
    <div className="flex flex-col gap-1 p-4 bg-bg-surface">
      <span className="eyebrow">{label}</span>
      <span
        className={`font-display font-semibold tracking-tight tnum ${toneClass}`}
        style={{ fontSize: "var(--t-md)", letterSpacing: "-0.015em" }}
      >
        {value}
      </span>
    </div>
  );
}
