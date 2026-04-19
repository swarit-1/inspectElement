"use client";

import { useMemo, useState } from "react";
import { Shell } from "@/components/ui/shell";
import { BudgetGauge } from "@/components/ui/budget-gauge";
import { IntentBuilder } from "@/components/intent/intent-builder";
import { AgentDelegate } from "@/components/delegation/agent-delegate";
import { ActivityFeed } from "@/components/feed/activity-feed";
import { useFeed } from "@/hooks/use-feed";
import {
  DEMO_MAX_SPEND_PER_DAY,
  DEMO_MAX_SPEND_PER_TX,
} from "@/lib/constants";
import type { Hex } from "viem";
import type { FeedItemReceipt } from "@/lib/types";

export default function DashboardPage() {
  const [intentCommitted, setIntentCommitted] = useState(false);
  const [, setDelegated] = useState(false);
  const { data: feed } = useFeed();

  // Today's confirmed-receipt total in raw 6-decimals
  const { spentToday, lastTx } = useMemo(() => {
    if (!feed) return { spentToday: 0n, lastTx: null as bigint | null };
    const dayStart = Math.floor(Date.now() / 1000) - 86400;
    const todays = feed
      .filter(
        (e): e is FeedItemReceipt =>
          e.type === "receipt" &&
          e.status === "confirmed" &&
          e.timestamp >= dayStart
      )
      .sort((a, b) => b.timestamp - a.timestamp);
    const total = todays.reduce((acc, e) => acc + BigInt(e.amount), 0n);
    return {
      spentToday: total,
      lastTx: todays[0] ? BigInt(todays[0].amount) : null,
    };
  }, [feed]);

  return (
    <Shell>
      <div className="flex flex-col gap-14">
        {/* ── Headline: vault status ── */}
        <header className="flex flex-col gap-7">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="eyebrow block mb-2">Vault status</span>
              <h1
                className="font-display font-semibold tracking-tight text-text-primary leading-[1.05]"
                style={{ fontSize: "var(--t-2xl)" }}
              >
                Today&apos;s perimeter.
              </h1>
            </div>
            <div className="text-right">
              <div className="eyebrow mb-1">Window</div>
              <div className="font-mono text-[13px] tnum text-text-secondary">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}{" "}
                · 24h rolling
              </div>
            </div>
          </div>

          <BudgetGauge
            spentToday={spentToday}
            maxPerDay={DEMO_MAX_SPEND_PER_DAY}
            maxPerTx={DEMO_MAX_SPEND_PER_TX}
            lastTx={lastTx}
          />
        </header>

        {/* ── Setup steps ── */}
        <IntentBuilder onCommitted={(_hash: Hex) => setIntentCommitted(true)} />

        {intentCommitted && (
          <AgentDelegate onDelegated={() => setDelegated(true)} />
        )}

        {/* ── Ledger ── */}
        <ActivityFeed />
      </div>
    </Shell>
  );
}
