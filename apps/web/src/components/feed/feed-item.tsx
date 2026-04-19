"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatUsdc, truncateAddress } from "@/lib/constants";
import type {
  FeedItem as FeedItemType,
  FeedItemIntent,
  FeedItemReceipt,
  FeedItemBlocked,
  FeedItemChallenge,
} from "@/lib/types";

interface FeedItemProps {
  item: FeedItemType;
  index: number;
}

/**
 * Single ledger row. Grid columns:
 *   [time] [glyph] [headline + meta] [amount] [status + action]
 */
export function FeedItem({ item, index }: FeedItemProps) {
  switch (item.type) {
    case "intent":
      return <IntentRow item={item} index={index} />;
    case "receipt":
      return <ReceiptRow item={item} index={index} />;
    case "blocked":
      return <BlockedRow item={item} index={index} />;
    case "challenge":
      return <ChallengeRow item={item} index={index} />;
  }
}

function Row({
  index,
  glyph,
  glyphTone,
  headline,
  meta,
  amount,
  amountTone = "text-text-primary",
  trailing,
  tinted,
}: {
  index: number;
  glyph: string;
  glyphTone: string;
  headline: React.ReactNode;
  meta: React.ReactNode;
  amount?: React.ReactNode;
  amountTone?: string;
  trailing: React.ReactNode;
  tinted?: "warn" | "danger" | "ok";
}) {
  const tintClass =
    tinted === "warn"
      ? "bg-warning-dim/15"
      : tinted === "danger"
        ? "bg-danger-dim/15"
        : tinted === "ok"
          ? "bg-success-dim/10"
          : "";
  return (
    <div
      className={`
        grid items-center gap-x-5
        grid-cols-[44px_18px_1fr_auto_auto]
        py-3 px-4 -mx-4
        border-b border-rule-subtle
        transition-colors duration-[--duration-fast]
        hover:bg-bg-surface
        ${tintClass}
      `}
    >
      <div className="font-mono text-[11px] tnum text-text-quat tracking-wider">
        {String(index).padStart(3, "0")}
      </div>
      <div
        className={`text-[14px] leading-none text-center ${glyphTone}`}
        aria-hidden
      >
        {glyph}
      </div>
      <div className="min-w-0 flex flex-col gap-0.5">
        <div className="text-[13px] text-text-primary truncate">{headline}</div>
        <div className="text-[11px] text-text-tertiary tnum font-mono truncate">
          {meta}
        </div>
      </div>
      <div className={`text-[14px] tnum tabular-nums font-medium font-display ${amountTone} text-right`}>
        {amount}
      </div>
      <div className="flex items-center gap-2.5 justify-end">{trailing}</div>
    </div>
  );
}

function IntentRow({ item, index }: { item: FeedItemIntent; index: number }) {
  return (
    <Row
      index={index}
      glyph="❖"
      glyphTone="text-info"
      headline={
        <>
          Intent {item.active ? "committed" : "revoked"}{" "}
          <span className="text-text-tertiary">·</span>{" "}
          <span className="text-text-secondary">
            {truncateAddress(item.intentHash, 6)}
          </span>
        </>
      }
      meta={`${formatTime(item.timestamp)} · manifest pinned`}
      amount={<span className="text-text-tertiary">—</span>}
      trailing={<StatusBadge variant="info">{item.active ? "Active" : "Revoked"}</StatusBadge>}
    />
  );
}

function ReceiptRow({ item, index }: { item: FeedItemReceipt; index: number }) {
  const isOver = item.status === "overspend";
  return (
    <Row
      index={index}
      glyph={isOver ? "△" : "●"}
      glyphTone={isOver ? "text-warning" : "text-success"}
      headline={
        <>
          Payment to{" "}
          <span className="font-mono text-text-secondary">
            {truncateAddress(item.target)}
          </span>
        </>
      }
      meta={`${formatTime(item.timestamp)} · receipt ${truncateAddress(item.receiptId, 4)}`}
      amount={
        <>
          {formatUsdc(item.amount)}
          <span className="text-text-tertiary font-normal ml-1.5">USDC</span>
        </>
      }
      amountTone={isOver ? "text-warning" : "text-text-primary"}
      tinted={isOver ? "warn" : undefined}
      trailing={
        isOver ? (
          <>
            <StatusBadge variant="warning">Exceeds cap</StatusBadge>
            <Link href={`/receipt/${item.receiptId}`}>
              <Button variant="danger" size="sm">
                File challenge →
              </Button>
            </Link>
          </>
        ) : (
          <>
            <StatusBadge variant="success">Confirmed</StatusBadge>
            <Link href={`/receipt/${item.receiptId}`}>
              <Button variant="ghost" size="sm">
                View
              </Button>
            </Link>
          </>
        )
      }
    />
  );
}

function BlockedRow({ item, index }: { item: FeedItemBlocked; index: number }) {
  const hasAmount = BigInt(item.amount) > 0n;
  return (
    <Row
      index={index}
      glyph="✕"
      glyphTone="text-danger"
      tinted="danger"
      headline={
        <>
          Blocked at executor{" "}
          <span className="text-text-tertiary">·</span>{" "}
          <span className="font-mono text-text-secondary">
            {truncateAddress(item.target)}
          </span>
        </>
      }
      meta={`${item.reasonCode.replace(/_/g, " ").toLowerCase()} · ${formatTime(item.timestamp)}`}
      amount={
        hasAmount ? (
          <>
            {formatUsdc(item.amount)}
            <span className="text-text-tertiary font-normal ml-1.5">USDC</span>
          </>
        ) : (
          <span className="text-text-tertiary">—</span>
        )
      }
      amountTone="text-danger"
      trailing={<StatusBadge variant="danger">Blocked</StatusBadge>}
    />
  );
}

function ChallengeRow({ item, index }: { item: FeedItemChallenge; index: number }) {
  const isUpheld = item.status === "UPHELD";
  const isPending = item.status === "PENDING" || item.status === "FILED";
  return (
    <Row
      index={index}
      glyph={isUpheld ? "◆" : "◇"}
      glyphTone={isUpheld ? "text-success" : "text-info"}
      tinted={isUpheld ? "ok" : undefined}
      headline={
        <>
          Challenge #{item.challengeId} <span className="text-text-tertiary">·</span>{" "}
          {item.challengeType}
        </>
      }
      meta={
        isUpheld && item.payoutAmount
          ? `Resolved ${formatTime(item.timestamp)}`
          : `Filed ${formatTime(item.timestamp)}`
      }
      amount={
        isUpheld && item.payoutAmount ? (
          <>
            +{formatUsdc(item.payoutAmount)}
            <span className="text-text-tertiary font-normal ml-1.5">USDC</span>
          </>
        ) : (
          <span className="text-text-tertiary">—</span>
        )
      }
      amountTone={isUpheld ? "text-success" : "text-text-primary"}
      trailing={
        <StatusBadge variant={isUpheld ? "success" : isPending ? "info" : "danger"}>
          {isPending ? "Pending" : item.status}
        </StatusBadge>
      }
    />
  );
}

function formatTime(timestamp: number): string {
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}
