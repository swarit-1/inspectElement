"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingPulse } from "@/components/ui/loading";
import { useToast } from "@/components/ui/toast";
import { getChallenge, NotFoundError } from "@/lib/api";
import { formatUsdc, truncateAddress } from "@/lib/constants";
import type { ChallengeDetail } from "@/lib/types";

interface ChallengeStatusProps {
  challengeId: string;
}

export function ChallengeStatus({ challengeId }: ChallengeStatusProps) {
  const { toast } = useToast();
  const notifiedRef = useRef(false);

  const { data: challenge, isLoading, error } = useQuery<ChallengeDetail>({
    queryKey: ["challenge", challengeId],
    queryFn: () => getChallenge(challengeId),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "PENDING" || s === "FILED" ? 2500 : false;
    },
    retry: (count, err) => !(err instanceof NotFoundError) && count < 2,
  });

  useEffect(() => {
    if (challenge?.status === "UPHELD" && !notifiedRef.current) {
      notifiedRef.current = true;
      toast({
        variant: "success",
        title: "Challenge upheld",
        description: challenge.payoutAmount
          ? `${formatUsdc(challenge.payoutAmount)} USDC paid from operator stake.`
          : "Operator stake slashed to the owner.",
        action: challenge.txHash
          ? {
              label: "View tx",
              href: `https://sepolia.basescan.org/tx/${challenge.txHash}`,
            }
          : undefined,
      });
    }
    if (challenge?.status === "REJECTED" && !notifiedRef.current) {
      notifiedRef.current = true;
      toast({
        variant: "danger",
        title: "Challenge rejected",
        description: "The arbiter declined the dispute. Bond forfeited.",
      });
    }
  }, [challenge, toast]);

  if (error instanceof NotFoundError) {
    return (
      <section className="hairline-top pt-5">
        <div className="eyebrow text-text-tertiary mb-2">○ Indexer pending</div>
        <p className="text-[12px] text-text-tertiary leading-relaxed max-w-[60ch]">
          Your challenge tx has been broadcast but the indexer hasn&apos;t
          surfaced it yet. This panel will update automatically once the id
          appears in the feed.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return <LoadingPulse label="AWAITING ARBITER" pad={false} align="left" />;
  }

  if (!challenge) return null;

  const isUpheld = challenge.status === "UPHELD";
  const isPending =
    challenge.status === "PENDING" || challenge.status === "FILED";

  return (
    <section className="flex flex-col">
      <header className="flex items-center justify-between hairline-top hairline-bottom py-4">
        <div className="flex items-baseline gap-3">
          <span className="seq tabular-nums">CHL · #{challenge.challengeId}</span>
          <span
            className="font-display font-semibold text-text-primary tracking-tight"
            style={{ fontSize: "var(--t-md)" }}
          >
            {challenge.challengeType}
          </span>
        </div>
        <StatusBadge
          variant={
            isUpheld ? "success" : challenge.status === "REJECTED" ? "danger" : "info"
          }
        >
          {isPending ? "Awaiting arbiter" : challenge.status}
        </StatusBadge>
      </header>

      {isPending && (
        <div className="flex items-center gap-3 py-4 font-mono text-[11px] tnum text-text-tertiary tracking-wider uppercase">
          <span className="led-pulse h-1.5 w-1.5 rounded-full bg-info" />
          Polling for resolution… next check in 2.5s
        </div>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 py-5 text-[12px] tnum">
        <dt className="eyebrow">Bond posted</dt>
        <dd className="font-mono text-text-secondary">
          {formatUsdc(challenge.bondAmount)} USDC
        </dd>
        <dt className="eyebrow">Challenger</dt>
        <dd className="font-mono text-text-secondary">
          {truncateAddress(challenge.challenger, 6)}
        </dd>
        <dt className="eyebrow">Receipt</dt>
        <dd className="font-mono text-text-secondary">
          {truncateAddress(challenge.receiptId, 6)}
        </dd>
        {challenge.resolvedAt && (
          <>
            <dt className="eyebrow">Resolved at</dt>
            <dd className="text-text-secondary">
              {new Date(challenge.resolvedAt * 1000).toLocaleString()}
            </dd>
          </>
        )}
        {isUpheld && challenge.payoutAmount && (
          <>
            <dt className="eyebrow text-success">Payout</dt>
            <dd className="font-mono text-success font-semibold">
              +{formatUsdc(challenge.payoutAmount)} USDC
            </dd>
          </>
        )}
      </dl>

      {isUpheld && (
        <div className="hairline-top pt-4 text-[13px] text-success">
          ● Challenge upheld.{" "}
          {challenge.payoutAmount && (
            <>
              <span className="font-mono tnum font-semibold">
                {formatUsdc(challenge.payoutAmount)} USDC
              </span>{" "}
              returned to owner from operator stake.
            </>
          )}
        </div>
      )}

      {challenge.txHash && (
        <a
          href={`https://sepolia.basescan.org/tx/${challenge.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 font-mono text-[11px] tnum text-text-tertiary hover:text-accent-bright underline-offset-4 hover:underline"
        >
          tx · {truncateAddress(challenge.txHash, 6)} ↗
        </a>
      )}
    </section>
  );
}
