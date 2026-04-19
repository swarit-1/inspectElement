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
      <Section
        title="Reviewer Console"
        subtitle={
          USE_MOCKS
            ? "Stub mode — buttons update local state only"
            : "Calls Dev 3 POST /v1/reviewer/resolve (assistive; not on live slash path)"
        }
      >
        {!address && (
          <p className="text-sm text-text-tertiary py-8 text-center">
            Connect a wallet to load challenges from the feed.
          </p>
        )}

        {address && isLoading && (
          <p className="text-sm text-text-tertiary py-8 text-center">
            Loading challenges...
          </p>
        )}

        {address && !isLoading && challenges.length === 0 && (
          <p className="text-sm text-text-tertiary py-8 text-center">
            No challenges in feed for this owner.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {challenges.map((item) => (
            <div
              key={item.id}
              className="bg-bg-surface border border-border rounded-[--radius-lg] p-5 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-text-primary">
                    Challenge #{item.challengeId}
                  </span>
                  <span className="text-xs text-text-tertiary ml-2">
                    {item.challengeType}
                  </span>
                </div>
                <StatusBadge
                  variant={
                    item.status === "UPHELD"
                      ? "success"
                      : item.status === "REJECTED"
                        ? "danger"
                        : "info"
                  }
                >
                  {item.status === "FILED" ? "PENDING" : item.status}
                </StatusBadge>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="text-text-tertiary uppercase tracking-wider">
                    Payout
                  </span>
                  <span className="text-text-secondary font-mono">
                    {item.payoutAmount
                      ? `${formatUsdc(item.payoutAmount)} USDC`
                      : "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-text-tertiary uppercase tracking-wider">
                    Receipt
                  </span>
                  <span className="text-text-secondary font-mono">
                    {truncateAddress(item.receiptId)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-text-tertiary uppercase tracking-wider">
                    Time
                  </span>
                  <span className="text-text-secondary">
                    {new Date(item.timestamp * 1000).toLocaleString()}
                  </span>
                </div>
              </div>

              {item.status === "FILED" && (
                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={busyId === item.challengeId}
                    onClick={() => void handleDecision(item.challengeId, true)}
                  >
                    Uphold
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === item.challengeId}
                    onClick={() => void handleDecision(item.challengeId, false)}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </Shell>
  );
}
