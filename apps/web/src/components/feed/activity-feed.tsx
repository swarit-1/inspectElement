"use client";

import { Section } from "@/components/ui/section";
import { LoadingPulse } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
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
      kicker="Ledger"
      title="Activity feed"
      subtitle="Every executor receipt, blocked attempt, and challenge — chronological"
      action={
        sorted.length > 0 ? (
          <div className="flex gap-4 tnum text-[11px] font-mono text-text-tertiary">
            <span className="text-success">● {counts.receipt ?? 0} confirmed</span>
            <span className="text-danger">✕ {counts.blocked ?? 0} blocked</span>
            <span className="text-info">◆ {counts.challenge ?? 0} disputed</span>
          </div>
        ) : null
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

        {isLoading && <LoadingPulse label="SYNCING LEDGER" />}

        {error && (
          <EmptyState
            glyph="✕"
            tone="danger"
            caption="FEED OFFLINE"
            body={
              <>
                Could not fetch the ledger:{" "}
                <span className="text-danger font-mono text-[12px]">
                  {error.message}
                </span>
              </>
            }
          />
        )}

        {!isLoading && !error && items && items.length === 0 && (
          <EmptyState
            glyph="○"
            caption="NO EVENTS YET"
            headline="The ledger is clean."
            body="Once an agent attempts a payment, you'll see receipts (allowed spends), blocked attempts (guard rejected), and challenges (disputes) appear here in order."
            primary={{ label: "Run a scripted scenario", href: "/demo" }}
          />
        )}

        {sorted.map((item, i) => (
          <FeedItem key={item.id} item={item} index={i + 1} />
        ))}
      </div>
    </Section>
  );
}
