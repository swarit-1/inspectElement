"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Shell } from "@/components/ui/shell";
import { WalletGate } from "@/components/ui/wallet-gate";
import { ActivityFeed } from "@/components/feed/activity-feed";
import { PostureHeader } from "@/components/dashboard/posture-header";
import { SetupCompletion } from "@/components/dashboard/setup-completion";
import { ExposurePanel } from "@/components/dashboard/exposure-panel";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { useFeed } from "@/hooks/use-feed";
import { useOnboardingProgress } from "@/hooks/use-onboarding-progress";
import type { FeedItemReceipt } from "@/lib/types";

const FLAGS_STORAGE_KEY = "intentguard.onboarding.flags.v1";

interface Flags {
  policyCommitted: boolean;
  ownerApproved: boolean;
  delegated: boolean;
  firstRunDone: boolean;
}

const DEFAULT_FLAGS: Flags = {
  policyCommitted: false,
  ownerApproved: false,
  delegated: false,
  firstRunDone: false,
};

function useOnboardingFlags(): Flags {
  const [flags, setFlags] = useState<Flags>(DEFAULT_FLAGS);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(FLAGS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Flags>;
      setFlags({ ...DEFAULT_FLAGS, ...parsed });
    } catch {
      // ignore malformed state
    }
  }, []);

  return flags;
}

export default function DashboardPage() {
  const { address } = useAccount();
  const { data: feed } = useFeed();
  const flags = useOnboardingFlags();
  const progress = useOnboardingProgress({
    policyCommitted: flags.policyCommitted,
    delegated: flags.delegated,
    firstRunDone: flags.firstRunDone,
  });

  const [dayStart] = useState(() => Math.floor(Date.now() / 1000) - 86400);

  const summary = useMemo(() => {
    const activeFeed = feed ?? [];
    const todays = activeFeed.filter((e) => e.timestamp >= dayStart);

    const confirmedReceipts = todays.filter(
      (e): e is FeedItemReceipt =>
        e.type === "receipt" && e.status === "confirmed",
    );
    const overspendReceipts = todays.filter(
      (e): e is FeedItemReceipt =>
        e.type === "receipt" && e.status === "overspend",
    );
    const blockedToday = todays.filter((e) => e.type === "blocked");
    const pendingChallenges = activeFeed.filter(
      (e) =>
        e.type === "challenge" &&
        (e.status === "PENDING" || e.status === "FILED"),
    );

    const spentToday = confirmedReceipts.reduce(
      (acc, e) => acc + BigInt(e.amount),
      0n,
    );
    const lastReceipt = confirmedReceipts.sort(
      (a, b) => b.timestamp - a.timestamp,
    )[0];

    return {
      spentToday,
      lastTx: lastReceipt ? BigInt(lastReceipt.amount) : null,
      activeToday:
        confirmedReceipts.length +
        overspendReceipts.length +
        blockedToday.length,
      needsAttention: overspendReceipts.length + pendingChallenges.length,
    };
  }, [dayStart, feed]);

  return (
    <Shell>
      <WalletGate
        caption="DASHBOARD LOCKED"
        body="Connect a wallet to read your vault's perimeter, commit an intent, and watch the ledger in real time."
      >
        <div className="flex flex-col gap-14">
          <PostureHeader
            address={address}
            spentToday={summary.spentToday}
            activeToday={summary.activeToday}
            needsAttention={summary.needsAttention}
            network="Base Sepolia"
            isReady={progress.isFullyConfigured}
          />

          <SetupCompletion progress={progress} />

          <ExposurePanel
            spentToday={summary.spentToday}
            lastTx={summary.lastTx}
            allowedCount={3}
          />

          <QuickActions />

          <ActivityFeed />
        </div>
      </WalletGate>
    </Shell>
  );
}
