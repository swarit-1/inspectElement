"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Shell } from "@/components/ui/shell";
import { BudgetGauge } from "@/components/ui/budget-gauge";
import { WalletGate } from "@/components/ui/wallet-gate";
import { OwnerSpendApproval } from "@/components/approval/owner-spend-approval";
import { IntentBuilder } from "@/components/intent/intent-builder";
import { AgentDelegate } from "@/components/delegation/agent-delegate";
import { ActivityFeed } from "@/components/feed/activity-feed";
import { useFeed } from "@/hooks/use-feed";
import {
  DEMO_MAX_SPEND_PER_DAY,
  DEMO_MAX_SPEND_PER_TX,
} from "@/lib/constants";
import type { FeedItemReceipt } from "@/lib/types";

export default function DashboardPage() {
  const { address } = useAccount();
  const { data: feed } = useFeed();
  const [dayStart] = useState(() => Math.floor(Date.now() / 1000) - 86400);

  // Today's confirmed-receipt total in raw 6-decimals
  const { spentToday, lastTx } = useMemo(() => {
    if (!feed) return { spentToday: 0n, lastTx: null as bigint | null };
    const todays = feed
      .filter(
        (e): e is FeedItemReceipt =>
          e.type === "receipt" &&
          e.status === "confirmed" &&
          e.timestamp >= dayStart
      )
      .sort((a, b) => b.timestamp - a.timestamp);
    const total = todays.reduce((acc, e) => acc + BigInt(e.amount), 0n);
    return {
      spentToday: total,
      lastTx: todays[0] ? BigInt(todays[0].amount) : null,
    };
  }, [dayStart, feed]);

  return (
    <Shell>
      <WalletGate
        caption="DASHBOARD LOCKED"
        body="Connect a wallet to read your vault's perimeter, commit an intent, and watch the ledger in real time."
      >
        <div className="flex flex-col gap-14">
          {/* ── Headline: vault status ── */}
          <header className="flex flex-col gap-7">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div>
                <span className="eyebrow block mb-2">Vault status</span>
                <h1
                  className="font-display font-semibold tracking-tight text-text-primary leading-[1.05]"
                  style={{ fontSize: "var(--t-2xl)" }}
                >
                  Today&apos;s perimeter.
                </h1>
              </div>
              <div className="text-right">
                <div className="eyebrow mb-1">Window</div>
                <div className="font-mono text-[13px] tnum text-text-secondary">
                  {new Date().toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · 24h rolling
                </div>
              </div>
            </div>

            <BudgetGauge
              spentToday={spentToday}
              maxPerDay={DEMO_MAX_SPEND_PER_DAY}
              maxPerTx={DEMO_MAX_SPEND_PER_TX}
              lastTx={lastTx}
            />
          </header>

          {/* ── Setup steps ── */}
          <SetupIntro />
          <SetupFlow key={address ?? "disconnected"} />

          {/* ── Ledger ── */}
          <ActivityFeed />
        </div>
      </WalletGate>
    </Shell>
  );
}

function SetupIntro() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 hairline-top hairline-bottom py-6">
      <div className="flex flex-col gap-3 max-w-[66ch]">
        <span className="eyebrow text-accent">Where Rules Are Set</span>
        <h2
          className="font-display font-semibold tracking-tight text-text-primary"
          style={{ fontSize: "var(--t-lg)" }}
        >
          Start below in “Set payment rules.”
        </h2>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          Users do not deploy their own contracts in this flow. The shared
          protocol contracts are already live on Base Sepolia. This setup area
          is where the owner chooses who the agent may pay, what token it may
          spend, the spending limits, and how long that permission lasts.
        </p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12px]">
        <dt className="eyebrow">Step I</dt>
        <dd className="text-text-secondary">Set payment rules</dd>
        <dt className="eyebrow">Step II</dt>
        <dd className="text-text-secondary">Approve owner USDC</dd>
        <dt className="eyebrow">Step III</dt>
        <dd className="text-text-secondary">Authorize the server wallet</dd>
      </dl>
    </section>
  );
}

function SetupFlow() {
  const [intentCommitted, setIntentCommitted] = useState(false);
  const [ownerApproved, setOwnerApproved] = useState(false);
  const [, setDelegated] = useState(false);

  return (
    <>
      <IntentBuilder onCommitted={() => setIntentCommitted(true)} />

      {intentCommitted && (
        <OwnerSpendApproval onApproved={() => setOwnerApproved(true)} />
      )}

      {intentCommitted && ownerApproved && (
        <AgentDelegate onDelegated={() => setDelegated(true)} />
      )}
    </>
  );
}
