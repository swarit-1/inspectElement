"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Shell } from "@/components/ui/shell";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { WalletGate } from "@/components/ui/wallet-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingPulse } from "@/components/ui/loading";
import { useToast } from "@/components/ui/toast";
import { GeminiSummaryCard } from "@/components/gemini/gemini-summary-card";
import { getFeed, postReviewerResolve } from "@/lib/api";
import { USE_MOCKS, formatUsdc, truncateAddress } from "@/lib/constants";
import { easeStage } from "@/lib/motion";
import type { FeedItemChallenge } from "@/lib/types";

export default function ReviewPage() {
  return (
    <Shell>
      <WalletGate
        caption="REVIEW LOCKED"
        body="The arbitration queue is keyed by your owner address. Connect a wallet to see your pending challenges."
      >
        <ReviewContent />
      </WalletGate>
    </Shell>
  );
}

type FilterKey = "pending" | "resolved" | "all";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

function ReviewContent() {
  const { address } = useAccount();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("pending");

  const { data: feed, isLoading, error } = useQuery({
    queryKey: ["feed-review", address],
    queryFn: () => (address ? getFeed(address) : Promise.resolve([])),
    enabled: !!address,
    refetchInterval: 3000,
  });

  const challenges = useMemo(
    () =>
      feed?.filter(
        (e): e is FeedItemChallenge => e.type === "challenge",
      ) ?? [],
    [feed],
  );

  const counts = useMemo(() => {
    const pending = challenges.filter(
      (c) => c.status === "PENDING" || c.status === "FILED",
    );
    const resolved = challenges.filter(
      (c) => c.status === "UPHELD" || c.status === "REJECTED",
    );
    return { pending, resolved, all: challenges };
  }, [challenges]);

  const visible = useMemo(() => {
    const list =
      filter === "pending"
        ? counts.pending
        : filter === "resolved"
          ? counts.resolved
          : counts.all;
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  }, [counts, filter]);

  async function handleDecision(challengeId: string, uphold: boolean) {
    setBusyId(challengeId);
    try {
      await postReviewerResolve({
        challengeId,
        uphold,
        slashAmount: uphold ? "15000000" : "0",
      });
      toast({
        variant: uphold ? "success" : "warning",
        title: uphold ? "Decision broadcast · UPHOLD" : "Decision broadcast · REJECT",
        description: USE_MOCKS
          ? "Recorded to local state in this build."
          : "Arbiter will pick this up on its next poll.",
      });
      qc.invalidateQueries({ queryKey: ["feed-review"] });
    } catch (err) {
      toast({
        variant: "danger",
        title: "Reviewer API failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.46, ease: easeStage }}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">Arbiter · triage queue</span>
            <h1
              className="font-display font-semibold tracking-tight text-text-primary mt-2 leading-[1.02]"
              style={{ fontSize: "var(--t-2xl)", letterSpacing: "-0.025em" }}
            >
              Resolve open disputes.
            </h1>
            <p className="text-text-secondary mt-2 max-w-[60ch]">
              {USE_MOCKS
                ? "Decisions post to local state in this build."
                : "Decisions post to the reviewer endpoint (assistive; not on the live slash path)."}
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] tnum text-text-tertiary">
            <span className="text-info">
              ◆ {counts.pending.length} pending
            </span>
            <span className="text-text-quat">·</span>
            <span className="text-success">
              ● {counts.resolved.length} resolved
            </span>
          </div>
        </div>

        <nav
          role="tablist"
          aria-label="Filter challenges"
          className="relative flex items-center gap-1 border-b border-rule"
        >
          {FILTERS.map((f) => {
            const isActive = f.key === filter;
            const count = counts[f.key].length;
            return (
              <button
                key={f.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilter(f.key)}
                className={`relative px-4 py-3 font-mono text-[11px] tnum tracking-[0.2em] uppercase transition-colors ${
                  isActive
                    ? "text-text-primary"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`ml-2 ${
                    isActive ? "text-accent" : "text-text-quat"
                  }`}
                >
                  {count.toString().padStart(2, "0")}
                </span>
                {isActive && (
                  <motion.span
                    layoutId="review-filter-underline"
                    className="absolute -bottom-px left-0 right-0 h-px bg-accent"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </motion.header>

      <Section
        kicker="Queue"
        title={
          filter === "pending"
            ? "Pending challenges"
            : filter === "resolved"
              ? "Resolved challenges"
              : "All challenges"
        }
        subtitle="Each row is a bonded dispute against an agent receipt — uphold to slash operator stake and refund the owner."
      >
        {isLoading && <LoadingPulse label="LOADING QUEUE" />}

        {error && (
          <EmptyState
            glyph="✕"
            tone="danger"
            caption="FEED UNREACHABLE"
            body={
              <>
                Could not reach the indexer:{" "}
                <span className="text-danger font-mono">{error.message}</span>.{" "}
                Start the infra service or flip{" "}
                <code className="font-mono text-text-secondary">
                  NEXT_PUBLIC_USE_MOCKS=true
                </code>{" "}
                to retry.
              </>
            }
          />
        )}

        {!isLoading && !error && visible.length === 0 && (
          <EmptyState
            glyph="○"
            caption={
              filter === "pending"
                ? "NOTHING TO REVIEW"
                : filter === "resolved"
                  ? "NO RESOLUTIONS YET"
                  : "QUEUE EMPTY"
            }
            headline={
              filter === "pending"
                ? "Inbox zero."
                : filter === "resolved"
                  ? "Nothing has been decided yet."
                  : "No challenges filed."
            }
            body={
              filter === "pending"
                ? "Every filed challenge has been resolved. File one from an overspend receipt to populate this queue."
                : filter === "resolved"
                  ? "Resolutions appear here once the arbiter issues a decision."
                  : "When an owner files a challenge against an overspend receipt, it appears here."
            }
            primary={{ label: "See an overspend run", href: "/theater" }}
          />
        )}

        {visible.length > 0 && (
          <div className="flex flex-col">
            <div className="hidden md:grid grid-cols-[80px_1fr_120px_120px_140px_auto] gap-x-5 px-4 -mx-4 pb-2 border-b border-rule">
              <span className="eyebrow">ID</span>
              <span className="eyebrow">Receipt</span>
              <span className="eyebrow text-right">Payout</span>
              <span className="eyebrow">Status</span>
              <span className="eyebrow">Filed</span>
              <span className="eyebrow text-right">Decision</span>
            </div>

            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.28, ease: easeStage }}
                >
                  <ReviewRow
                    item={item}
                    busy={busyId === item.challengeId}
                    onDecision={handleDecision}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Section>
    </div>
  );
}

function ReviewRow({
  item,
  busy,
  onDecision,
}: {
  item: FeedItemChallenge;
  busy: boolean;
  onDecision: (id: string, uphold: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPending = item.status === "FILED" || item.status === "PENDING";
  return (
    <div className="border-b border-rule-subtle">
      <div
        className="grid grid-cols-[80px_1fr_auto] md:grid-cols-[80px_1fr_120px_120px_140px_auto] gap-x-5 gap-y-1 items-center py-3.5 px-4 -mx-4 hover:bg-bg-surface transition-colors duration-[--duration-fast] cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-mono text-[12px] tnum text-text-secondary">
          #{item.challengeId}
        </span>
        <span className="font-mono text-[12px] tnum text-text-tertiary truncate min-w-0">
          {truncateAddress(item.receiptId, 6)}{" "}
          <span className="text-text-quat">· {item.challengeType}</span>
        </span>
        <span className="hidden md:block font-mono text-[12px] tnum text-right text-text-secondary">
          {item.payoutAmount ? `${formatUsdc(item.payoutAmount)}` : "—"}
        </span>
        <span className="hidden md:block">
          <StatusBadge
            variant={
              item.status === "UPHELD"
                ? "success"
                : item.status === "REJECTED"
                  ? "danger"
                  : "info"
            }
          >
            {isPending ? "Pending" : item.status}
          </StatusBadge>
        </span>
        <span className="hidden md:block font-mono text-[11px] tnum text-text-tertiary">
          {new Date(item.timestamp * 1000).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>

        <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
          {isPending ? (
            <>
              <Button
                variant="primary"
                size="sm"
                loading={busy}
                onClick={() => void onDecision(item.challengeId, true)}
              >
                Uphold
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void onDecision(item.challengeId, false)}
              >
                Reject
              </Button>
            </>
          ) : (
            <span className="font-mono text-[11px] tnum text-text-quat">closed</span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 -mx-4 pb-4 pt-1">
          <GeminiSummaryCard kind="challenge" referenceId={item.challengeId} />
        </div>
      )}
    </div>
  );
}
