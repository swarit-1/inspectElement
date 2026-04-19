"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

function ReviewContent() {
  const { address } = useAccount();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: feed, isLoading, error } = useQuery({
    queryKey: ["feed-review", address],
    queryFn: () => (address ? getFeed(address) : Promise.resolve([])),
    enabled: !!address,
    refetchInterval: 3000,
  });

  const challenges =
    feed?.filter((e): e is FeedItemChallenge => e.type === "challenge") ?? [];
  const pending = challenges.filter(
    (c) => c.status === "PENDING" || c.status === "FILED"
  );

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
          ? "Stub mode — no on-chain side effect."
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
      <Section
        kicker="Reviewer"
        title="Arbitration queue"
        subtitle={
          USE_MOCKS
            ? "Stub mode — decisions post to local state only."
            : "Decisions post to Dev 3 /v1/reviewer/resolve (assistive; not on the live slash path)."
        }
        action={
          <div className="font-mono text-[11px] tnum text-text-tertiary">
            {pending.length} pending · {challenges.length} total
          </div>
        }
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

        {!isLoading && !error && challenges.length === 0 && (
          <EmptyState
            glyph="○"
            caption="QUEUE EMPTY"
            headline="No challenges filed."
            body="When an owner files a challenge against an overspend receipt, it appears here for arbiter review."
            primary={{ label: "Run overspend scenario", href: "/demo" }}
          />
        )}

        {challenges.length > 0 && (
          <div className="flex flex-col">
            {/* Header row */}
            <div className="hidden md:grid grid-cols-[80px_1fr_120px_120px_140px_auto] gap-x-5 px-4 -mx-4 pb-2 border-b border-rule">
              <span className="eyebrow">ID</span>
              <span className="eyebrow">Receipt</span>
              <span className="eyebrow text-right">Payout</span>
              <span className="eyebrow">Status</span>
              <span className="eyebrow">Filed</span>
              <span className="eyebrow text-right">Decision</span>
            </div>

            {challenges.map((item) => (
              <ReviewRow
                key={item.id}
                item={item}
                busy={busyId === item.challengeId}
                onDecision={handleDecision}
              />
            ))}
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
