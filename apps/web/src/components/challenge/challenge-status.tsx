"use client";

import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/ui/status-badge";
import { getChallenge } from "@/lib/api";
import { formatUsdc, truncateAddress } from "@/lib/constants";
import type { ChallengeDetail } from "@/lib/types";

interface ChallengeStatusProps {
  challengeId: string;
}

export function ChallengeStatus({ challengeId }: ChallengeStatusProps) {
  const { data: challenge, isLoading } = useQuery<ChallengeDetail>({
    queryKey: ["challenge", challengeId],
    queryFn: () => getChallenge(challengeId),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "PENDING" || s === "FILED" ? 3000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="text-sm text-text-tertiary py-4">
        Loading challenge status...
      </div>
    );
  }

  if (!challenge) return null;

  const isUpheld = challenge.status === "UPHELD";
  const isPending =
    challenge.status === "PENDING" || challenge.status === "FILED";

  return (
    <div className="bg-bg-surface border border-border rounded-[--radius-lg] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          Challenge #{challenge.challengeId}
        </h3>
        <StatusBadge
          variant={
            isUpheld ? "success" : challenge.status === "REJECTED" ? "danger" : "info"
          }
        >
          {isPending ? "PENDING" : challenge.status}
        </StatusBadge>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <DataRow label="Type" value={challenge.challengeType} />
        <DataRow label="Bond" value={`${formatUsdc(challenge.bondAmount)} USDC`} />
        <DataRow
          label="Challenger"
          value={truncateAddress(challenge.challenger)}
          mono
        />
        <DataRow
          label="Receipt"
          value={truncateAddress(challenge.receiptId)}
          mono
        />
        {challenge.resolvedAt && (
          <DataRow
            label="Resolved"
            value={new Date(challenge.resolvedAt * 1000).toLocaleString()}
          />
        )}
        {isUpheld && challenge.payoutAmount && (
          <DataRow
            label="Payout"
            value={`${formatUsdc(challenge.payoutAmount)} USDC`}
            highlight
          />
        )}
      </div>

      {isUpheld && (
        <div className="bg-success-dim rounded-[--radius-md] px-4 py-3 text-sm text-success font-medium">
          Challenge upheld. {challenge.payoutAmount && `${formatUsdc(challenge.payoutAmount)} USDC`} returned to owner from operator stake.
        </div>
      )}

      {challenge.txHash && (
        <a
          href={`https://sepolia.basescan.org/tx/${challenge.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:underline"
        >
          View on BaseScan
        </a>
      )}
    </div>
  );
}

function DataRow({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-text-tertiary uppercase tracking-wider">
        {label}
      </span>
      <span
        className={`${mono ? "font-mono" : ""} ${
          highlight ? "text-success font-semibold" : "text-text-secondary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
