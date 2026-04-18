"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatUsdc, truncateAddress } from "@/lib/constants";
import type {
  FeedItem as FeedItemType,
  FeedItemReceipt,
  FeedItemBlocked,
  FeedItemChallenge,
} from "@/lib/types";

interface FeedItemProps {
  item: FeedItemType;
}

export function FeedItem({ item }: FeedItemProps) {
  switch (item.type) {
    case "receipt":
      return <ReceiptRow item={item} />;
    case "blocked":
      return <BlockedRow item={item} />;
    case "challenge":
      return <ChallengeRow item={item} />;
  }
}

function ReceiptRow({ item }: { item: FeedItemReceipt }) {
  const isOverspend = item.status === "overspend";

  return (
    <div
      className={`
        flex items-center gap-4 px-4 py-3.5 rounded-[--radius-md]
        transition-colors duration-[--duration-fast]
        hover:bg-bg-surface
        ${isOverspend ? "bg-warning-dim/20" : ""}
      `}
    >
      {/* Icon */}
      <div
        className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center ${
          isOverspend ? "bg-warning-dim" : "bg-success-dim"
        }`}
      >
        {isOverspend ? (
          <WarningIcon className="w-4 h-4 text-warning" />
        ) : (
          <CheckIcon className="w-4 h-4 text-success" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            {formatUsdc(item.amount)} USDC
          </span>
          <span className="text-text-tertiary text-xs">to</span>
          <span className="text-xs font-mono text-text-secondary">
            {truncateAddress(item.target)}
          </span>
        </div>
        <div className="text-xs text-text-tertiary mt-0.5">
          {formatTime(item.timestamp)}
        </div>
      </div>

      {/* Status + action */}
      <div className="flex items-center gap-3 shrink-0">
        {isOverspend ? (
          <>
            <StatusBadge variant="warning">Exceeds cap</StatusBadge>
            <Link href={`/receipt/${item.receiptId}`}>
              <Button variant="danger" size="sm">
                File challenge
              </Button>
            </Link>
          </>
        ) : (
          <StatusBadge variant="success">Confirmed</StatusBadge>
        )}
      </div>
    </div>
  );
}

function BlockedRow({ item }: { item: FeedItemBlocked }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 rounded-[--radius-md] bg-danger-dim/10">
      {/* Icon */}
      <div className="w-9 h-9 rounded-full bg-danger-dim shrink-0 flex items-center justify-center">
        <BlockIcon className="w-4 h-4 text-danger" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            {formatUsdc(item.amount)} USDC
          </span>
          <span className="text-text-tertiary text-xs">to</span>
          <span className="text-xs font-mono text-text-secondary">
            {truncateAddress(item.target)}
          </span>
          <StatusBadge variant="danger">Blocked</StatusBadge>
        </div>
        <div className="text-xs text-text-tertiary mt-0.5">
          {item.reasonCode.replace(/_/g, " ")} &middot;{" "}
          {formatTime(item.timestamp)}
        </div>
      </div>
    </div>
  );
}

function ChallengeRow({ item }: { item: FeedItemChallenge }) {
  const isUpheld = item.status === "UPHELD";

  return (
    <div
      className={`
        flex items-center gap-4 px-4 py-3.5 rounded-[--radius-md]
        ${isUpheld ? "bg-success-dim/10" : "bg-bg-surface"}
      `}
    >
      {/* Icon */}
      <div
        className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center ${
          isUpheld ? "bg-success-dim" : "bg-info-dim"
        }`}
      >
        <ScaleIcon
          className={`w-4 h-4 ${isUpheld ? "text-success" : "text-info"}`}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            Challenge {item.challengeType}
          </span>
          <StatusBadge variant={isUpheld ? "success" : "info"}>
            {item.status}
          </StatusBadge>
        </div>
        <div className="text-xs text-text-tertiary mt-0.5">
          {isUpheld && item.payoutAmount
            ? `${formatUsdc(item.payoutAmount)} USDC returned`
            : `Filed ${formatTime(item.timestamp)}`}
        </div>
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

// ── Inline icons ──

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function BlockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18" />
      <path d="M4 7l8-4 8 4" />
      <path d="M4 7l-2 8h8L4 7z" />
      <path d="M20 7l2 8h-8l6-8z" />
    </svg>
  );
}
