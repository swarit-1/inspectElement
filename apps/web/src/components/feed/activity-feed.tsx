"use client";

import { Section } from "@/components/ui/section";
import { FeedItem } from "./feed-item";
import { useFeed } from "@/hooks/use-feed";

export function ActivityFeed() {
  const { data: items, isLoading, error } = useFeed();

  return (
    <Section title="Activity Feed" subtitle="Recent agent actions and disputes">
      <div className="flex flex-col gap-1">
        {isLoading && (
          <div className="text-sm text-text-tertiary py-8 text-center">
            Loading feed...
          </div>
        )}

        {error && (
          <div className="text-sm text-danger bg-danger-dim rounded-[--radius-md] px-4 py-3">
            Failed to load feed: {error.message}
          </div>
        )}

        {items && items.length === 0 && (
          <EmptyFeed />
        )}

        {items?.sort((a, b) => b.timestamp - a.timestamp).map((item) => (
          <FeedItem key={item.id} item={item} />
        ))}
      </div>
    </Section>
  );
}

function EmptyFeed() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-bg-raised flex items-center justify-center">
        <svg
          className="w-6 h-6 text-text-tertiary"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            d="M12 8v4l3 3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="10" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-text-secondary">
          No activity yet
        </p>
        <p className="text-xs text-text-tertiary mt-0.5">
          Run a demo scenario to see agent actions here
        </p>
      </div>
    </div>
  );
}
