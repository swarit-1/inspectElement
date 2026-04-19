"use client";

import { formatUsdc } from "@/lib/constants";

interface BudgetGaugeProps {
  /** Today's confirmed USDC spend in raw 6-decimals. */
  spentToday: bigint;
  /** Daily cap in raw 6-decimals. */
  maxPerDay: bigint;
  /** Per-tx cap in raw 6-decimals (drawn as a tick mark on the axis). */
  maxPerTx: bigint;
  /** Optional last receipt amount, drawn as a "last tx" indicator. */
  lastTx?: bigint | null;
}

/**
 * The vault dial — a horizontal proportional meter showing today's spend
 * against the daily cap, with the per-tx limit marked as a notch on the axis.
 */
export function BudgetGauge({
  spentToday,
  maxPerDay,
  maxPerTx,
  lastTx,
}: BudgetGaugeProps) {
  const spent = Number(spentToday) / 1e6;
  const cap = Number(maxPerDay) / 1e6;
  const txCap = Number(maxPerTx) / 1e6;
  const remaining = Math.max(0, cap - spent);
  const fillPct = Math.min(100, (spent / cap) * 100);
  const txMarkPct = Math.min(100, (txCap / cap) * 100);
  const lastPct = lastTx ? Math.min(100, (Number(lastTx) / 1e6 / cap) * 100) : null;

  const bandColor =
    fillPct < 60
      ? "bg-success"
      : fillPct < 90
        ? "bg-warning"
        : "bg-danger";

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-end gap-x-10 gap-y-5">
      {/* Left readout: today's spend */}
      <div>
        <div className="eyebrow mb-2">Spent today</div>
        <div
          className="font-display font-semibold tracking-tight tnum text-text-primary leading-none"
          style={{ fontSize: "var(--t-3xl)" }}
        >
          {formatUsdc(spentToday)}
          <span
            className="font-body font-normal text-text-tertiary ml-2 tracking-normal"
            style={{ fontSize: "var(--t-md)" }}
          >
            USDC
          </span>
        </div>
      </div>

      {/* Middle column: daily cap */}
      <div className="text-right">
        <div className="eyebrow mb-2">Daily cap</div>
        <div
          className="font-display font-medium tnum text-text-secondary tracking-tight leading-none"
          style={{ fontSize: "var(--t-lg)" }}
        >
          {formatUsdc(maxPerDay)}
        </div>
      </div>

      {/* Right column: per-tx cap */}
      <div className="text-right">
        <div className="eyebrow mb-2">Per tx</div>
        <div
          className="font-display font-medium tnum text-text-secondary tracking-tight leading-none"
          style={{ fontSize: "var(--t-lg)" }}
        >
          {formatUsdc(maxPerTx)}
        </div>
      </div>

      {/* Gauge spans full width */}
      <div className="col-span-3">
        <div className="relative h-2.5 w-full bg-bg-inset overflow-hidden">
          {/* Filled spend */}
          <div
            className={`absolute inset-y-0 left-0 ${bandColor} transition-[width] duration-[--duration-slow] ease-[--ease-out-expo]`}
            style={{ width: `${fillPct}%` }}
          />
          {/* Per-tx cap notch */}
          <div
            className="absolute top-0 bottom-0 w-px bg-accent"
            style={{ left: `${txMarkPct}%` }}
            aria-label={`Per-transaction cap at ${txCap} USDC`}
          />
          {/* Last tx tick */}
          {lastPct !== null && (
            <div
              className="absolute -top-1 -bottom-1 w-px bg-text-secondary"
              style={{ left: `${lastPct}%` }}
              aria-label="Last transaction"
            />
          )}
        </div>

        {/* Axis legend */}
        <div className="relative mt-2 h-4 text-[10px] tnum font-mono text-text-quat">
          <span className="absolute left-0">0</span>
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${txMarkPct}%` }}
            title="Per-tx cap"
          >
            <span className="text-accent">▲</span>
            <span className="ml-1 uppercase tracking-wider">tx cap</span>
          </span>
          <span className="absolute right-0">{formatUsdc(maxPerDay)}</span>
        </div>
      </div>

      {/* Bottom row: remaining headroom */}
      <div className="col-span-3 flex items-baseline justify-between border-t border-rule-subtle pt-3">
        <span className="eyebrow">Remaining headroom</span>
        <span
          className="font-mono tnum text-text-secondary"
          style={{ fontSize: "var(--t-sm)" }}
        >
          {formatUsdc(BigInt(Math.round(remaining * 1e6)))}{" "}
          <span className="text-text-quat">USDC</span>
          <span className="text-text-quat ml-3">
            {(100 - fillPct).toFixed(1)}%
          </span>
        </span>
      </div>
    </div>
  );
}
