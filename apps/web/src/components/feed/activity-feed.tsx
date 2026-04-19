"use client";

import Link from "next/link";
import { Section } from "@/components/ui/section";
import { FeedItem } from "./feed-item";
import { useFeed } from "@/hooks/use-feed";

export function ActivityFeed() {
  const { data: items, isLoading, error } = useFeed();
  const sorted = items ? [...items].sort((a, b) => b.timestamp - a.timestamp) : [];
  const counts = sorted.reduce(
    (acc, it) => {
      acc[it.type] = (acc[it.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <Section
      index="03"
      kicker="Ledger"
      title="Activity feed"
      subtitle="Every executor receipt, blocked attempt, and challenge — chronological"
      action={
        sorted.length > 0 && (
          <div className="flex gap-4 tnum text-[11px] font-mono text-text-tertiary">
            <span>● {counts.receipt ?? 0} confirmed</span>
            <span>✕ {counts.blocked ?? 0} blocked</span>
            <span>◆ {counts.challenge ?? 0} disputed</span>
          </div>
        )
      }
    >
      <div className="flex flex-col">
        {/* Column legend */}
        {sorted.length > 0 && (
          <div className="grid grid-cols-[44px_18px_1fr_auto_auto] gap-x-5 px-4 -mx-4 pb-2 border-b border-rule">
            <span className="eyebrow">Seq</span>
            <span className="eyebrow text-center">·</span>
            <span className="eyebrow">Event</span>
            <span className="eyebrow text-right">Amount</span>
            <span className="eyebrow text-right">Status</span>
          </div>
        )}

        {isLoading && (
          <div className="py-12 grid place-items-center">
            <div className="flex items-center gap-3 text-[12px] font-mono text-text-tertiary tnum">
              <span className="led-pulse h-1.5 w-1.5 rounded-full bg-text-tertiary" />
              SYNCING LEDGER…
            </div>
          </div>
        )}

        {error && (
          <div className="py-6 text-[13px] text-danger font-mono tnum">
            ✕ Feed offline — {error.message}
          </div>
        )}

        {items && items.length === 0 && <EmptyFeed />}

        {sorted.map((item, i) => (
          <FeedItem key={item.id} item={item} index={i + 1} />
        ))}
      </div>
    </Section>
  );
}

function EmptyFeed() {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-10 py-10">
      <div>
        <div className="font-mono text-[11px] tnum text-text-quat tracking-wider mb-3">
          NO EVENTS YET
        </div>
        <div className="font-display text-text-secondary leading-tight" style={{ fontSize: "var(--t-lg)" }}>
          The ledger is clean.
        </div>
      </div>
      <div className="text-[13px] text-text-tertiary leading-relaxed max-w-[52ch]">
        Once an agent attempts a payment, you&apos;ll see receipts (allowed
        spends), blocked attempts (guard rejected before reaching USDC), and
        challenges (disputes you filed) appear here in order.
        <div className="mt-4">
          <Link
            href="/demo"
            className="text-accent hover:text-accent-bright underline-offset-4 hover:underline"
          >
            Run a scripted scenario →
          </Link>
        </div>
      </div>
    </div>
  );
}
