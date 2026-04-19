"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { Shell } from "@/components/ui/shell";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getFeed, postReviewerResolve } from "@/lib/api";
import { USE_MOCKS, formatUsdc, truncateAddress } from "@/lib/constants";
import type { FeedItemChallenge } from "@/lib/types";

export default function ReviewPage() {
  const { address } = useAccount();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: feed, isLoading } = useQuery({
    queryKey: ["feed-review", address],
    queryFn: () => (address ? getFeed(address) : Promise.resolve([])),
    enabled: !!address,
    refetchInterval: 5000,
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
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Shell>
      <div className="flex flex-col gap-10">
        <Section
          index="03"
          kicker="Reviewer"
          title="Arbitration queue"
          subtitle={
            USE_MOCKS
              ? "Stub mode — actions update local state only"
              : "Decisions post to Dev 3 /v1/reviewer/resolve (assistive; not on live slash path)"
          }
          action={
            <div className="font-mono text-[11px] tnum text-text-tertiary">
              {pending.length} pending · {challenges.length} total
            </div>
          }
        >
          {!address && (
            <p className="py-12 text-center font-mono text-[12px] tnum text-text-tertiary">
              Connect a wallet to load the queue.
            </p>
          )}

          {address && isLoading && (
            <div className="py-12 grid place-items-center">
              <div className="flex items-center gap-3 font-mono text-[12px] tnum text-text-tertiary">
                <span className="led-pulse h-1.5 w-1.5 rounded-full bg-text-tertiary" />
                LOADING QUEUE…
              </div>
            </div>
          )}

          {address && !isLoading && challenges.length === 0 && (
            <p className="py-12 text-center font-mono text-[12px] tnum text-text-tertiary">
              ○ Queue empty — no challenges in feed for this owner.
            </p>
          )}

          {challenges.length > 0 && (
            <div className="flex flex-col">
              {/* Header row */}
              <div className="grid grid-cols-[80px_1fr_120px_120px_140px_auto] gap-x-5 px-4 -mx-4 pb-2 border-b border-rule">
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
    </Shell>
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
  const isPending = item.status === "FILED" || item.status === "PENDING";
  return (
    <div className="grid grid-cols-[80px_1fr_120px_120px_140px_auto] gap-x-5 items-center py-3.5 px-4 -mx-4 border-b border-rule-subtle hover:bg-bg-surface transition-colors duration-[--duration-fast]">
      <span className="font-mono text-[12px] tnum text-text-secondary">
        #{item.challengeId}
      </span>
      <span className="font-mono text-[12px] tnum text-text-tertiary truncate">
        {truncateAddress(item.receiptId, 6)}{" "}
        <span className="text-text-quat">· {item.challengeType}</span>
      </span>
      <span className="font-mono text-[12px] tnum text-right text-text-secondary">
        {item.payoutAmount ? `${formatUsdc(item.payoutAmount)}` : "—"}
      </span>
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
      <span className="font-mono text-[11px] tnum text-text-tertiary">
        {new Date(item.timestamp * 1000).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>

      <div className="flex items-center gap-2 justify-end">
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
  );
}
