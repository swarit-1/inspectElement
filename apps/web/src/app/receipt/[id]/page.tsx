"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Shell } from "@/components/ui/shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { ChallengeCTA } from "@/components/challenge/challenge-cta";
import { ChallengeStatus } from "@/components/challenge/challenge-status";
import { getReceipt } from "@/lib/api";
import { formatUsdc, truncateAddress } from "@/lib/constants";
import type { ReceiptDetail } from "@/lib/types";

export default function ReceiptPage() {
  const params = useParams();
  const receiptId = params.id as string;
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const { data: receipt, isLoading } = useQuery<ReceiptDetail>({
    queryKey: ["receipt", receiptId],
    queryFn: () => getReceipt(receiptId),
  });

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            &larr; Back
          </Link>
        </div>

        {isLoading && (
          <div className="text-sm text-text-tertiary py-8 text-center">
            Loading receipt...
          </div>
        )}

        {receipt && (
          <>
            {/* Receipt header */}
            <div className="flex items-center justify-between">
              <h1 className="font-display text-xl font-bold tracking-tight">
                Receipt
              </h1>
              <StatusBadge
                variant={receipt.status === "overspend" ? "warning" : "success"}
              >
                {receipt.status === "overspend" ? "Exceeds cap" : "Confirmed"}
              </StatusBadge>
            </div>

            {/* Receipt data */}
            <div className="bg-bg-surface border border-border rounded-[--radius-lg] p-5">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-xs">
                <DataRow label="Amount" value={`${formatUsdc(receipt.amount)} USDC`} />
                <DataRow label="Target" value={truncateAddress(receipt.target, 6)} mono />
                <DataRow label="Agent ID" value={truncateAddress(receipt.agentId, 8)} mono />
                <DataRow label="Intent Hash" value={truncateAddress(receipt.intentHash, 8)} mono />
                <DataRow label="Context Digest" value={truncateAddress(receipt.contextDigest, 8)} mono />
                <DataRow label="Nonce" value={receipt.nonce} mono />
                <DataRow
                  label="Timestamp"
                  value={new Date(receipt.timestamp * 1000).toLocaleString()}
                />
                <DataRow
                  label="Trace URI"
                  value={receipt.traceURI || "—"}
                />
              </div>

              <div className="mt-4 pt-4 border-t border-border-subtle">
                <a
                  href={`https://sepolia.basescan.org/tx/${receipt.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  View transaction on BaseScan
                </a>
              </div>
            </div>

            {/* Challenge CTA */}
            <ChallengeCTA
              receipt={receipt}
              onChallengeSubmitted={(id) => setChallengeId(id)}
            />

            {/* Challenge status */}
            {challengeId && <ChallengeStatus challengeId={challengeId} />}
          </>
        )}
      </div>
    </Shell>
  );
}

function DataRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-text-tertiary uppercase tracking-wider">
        {label}
      </span>
      <span
        className={`text-text-secondary ${mono ? "font-mono" : ""} break-all`}
      >
        {value}
      </span>
    </div>
  );
}
