"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shell } from "@/components/ui/shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingPulse } from "@/components/ui/loading";
import { ChallengeCTA } from "@/components/challenge/challenge-cta";
import { ChallengeStatus } from "@/components/challenge/challenge-status";
import { GeminiSummaryCard } from "@/components/gemini/gemini-summary-card";
import { DeltaViz } from "@/components/receipt/delta-viz";
import { easeStage } from "@/lib/motion";
import { getReceipt, NotFoundError } from "@/lib/api";
import {
  formatUsdc,
  truncateAddress,
  DEMO_MAX_SPEND_PER_TX,
  USE_MOCKS,
} from "@/lib/constants";
import type { ReceiptDetail } from "@/lib/types";

export default function ReceiptPage() {
  const params = useParams();
  const receiptId = typeof params.id === "string" ? params.id : "";
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const {
    data: receipt,
    isLoading,
    error,
  } = useQuery<ReceiptDetail>({
    queryKey: ["receipt", receiptId],
    queryFn: () => getReceipt(receiptId),
    retry: (count, err) => !(err instanceof NotFoundError) && count < 2,
    enabled: !!receiptId,
  });

  return (
    <Shell>
      <div className="flex flex-col gap-10">
        {/* Breadcrumb */}
        <div>
          <Link
            href="/dashboard"
            className="font-mono text-[11px] tnum text-text-tertiary hover:text-text-primary tracking-wider uppercase"
          >
            ← back to dashboard
          </Link>
        </div>

        {isLoading && <LoadingPulse label="FETCHING RECEIPT" />}

        {error instanceof NotFoundError && (
          <EmptyState
            glyph="✕"
            tone="warning"
            caption="RECEIPT NOT FOUND"
            headline="No receipt under that id."
            body={
              <>
                The indexer has no record of{" "}
                <code className="font-mono text-text-secondary break-all">
                  {receiptId || "(empty)"}
                </code>
                . It may have been pruned, or the id may be malformed. If the
                run just landed, give the indexer a moment to catch up.
              </>
            }
            primary={{ label: "Open activity feed", href: "/dashboard" }}
            secondary={{ label: "Open live runs", href: "/theater" }}
          />
        )}

        {error && !(error instanceof NotFoundError) && (
          <EmptyState
            glyph="✕"
            tone="danger"
            caption="RECEIPT UNREACHABLE"
            body={
              <>
                {USE_MOCKS
                  ? "The in-browser ledger rejected the lookup."
                  : "Could not reach the indexer."}
                {" "}
                <span className="text-danger font-mono text-[12px]">
                  {(error as Error).message}
                </span>
              </>
            }
            primary={{ label: "Back to dashboard", href: "/dashboard" }}
          />
        )}

        {receipt && (
          <>
            {/* ── Hero: amount-first ── */}
            <motion.header
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.48, ease: easeStage }}
              className="flex flex-col gap-5"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="seq tabular-nums">
                  RECEIPT · {truncateAddress(receipt.receiptId, 4)}
                </span>
                <span className="h-px flex-1 min-w-4 bg-rule" />
                <StatusBadge
                  variant={receipt.status === "overspend" ? "warning" : "success"}
                >
                  {receipt.status === "overspend" ? "Exceeds cap" : "Confirmed"}
                </StatusBadge>
              </div>

              <div className="flex items-end justify-between gap-8 flex-wrap">
                <div>
                  <span className="eyebrow block mb-2">Amount transferred</span>
                  <div className="flex items-baseline gap-3">
                    <span
                      className={`font-display font-semibold tabular-nums tracking-tight leading-none ${
                        receipt.status === "overspend"
                          ? "text-warning"
                          : "text-text-primary"
                      }`}
                      style={{ fontSize: "var(--t-4xl)" }}
                    >
                      {formatUsdc(receipt.amount)}
                    </span>
                    <span
                      className="font-display font-medium text-text-tertiary tracking-tight"
                      style={{ fontSize: "var(--t-lg)" }}
                    >
                      USD
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-[12px] tnum font-mono text-text-tertiary">
                    <span>→</span>
                    <span className="text-text-secondary">
                      {truncateAddress(receipt.target, 6)}
                    </span>
                    <span className="text-text-quat">·</span>
                    <span>{new Date(receipt.timestamp * 1000).toLocaleString()}</span>
                  </div>
                </div>

                {receipt.status === "overspend" && (
                  <div className="flex flex-col items-end gap-2">
                    <span className="eyebrow text-warning">Cap delta</span>
                    <span
                      className="font-display font-semibold tnum text-warning tracking-tight"
                      style={{ fontSize: "var(--t-2xl)" }}
                    >
                      +{formatUsdc(BigInt(receipt.amount) - DEMO_MAX_SPEND_PER_TX)}
                    </span>
                  </div>
                )}
              </div>
            </motion.header>

            {receipt.status === "overspend" && (
              <DeltaViz amount={receipt.amount} />
            )}

            {/* ── Receipt details — definition list, no card ── */}
            <section className="grid grid-cols-[180px_1fr] gap-y-3 gap-x-8 hairline-top hairline-bottom py-6">
              <Field label="Agent ID" value={truncateAddress(receipt.agentId, 8)} />
              <Field
                label="Intent hash"
                value={truncateAddress(receipt.intentHash, 8)}
                accent
              />
              <Field
                label="Context digest"
                value={truncateAddress(receipt.contextDigest, 8)}
              />
              <Field label="Nonce" value={receipt.nonce} />
              <Field label="Trace URI" value={receipt.traceURI || "—"} truncate />
              <Field
                label="Tx hash"
                value={truncateAddress(receipt.txHash, 8)}
                href={`https://sepolia.basescan.org/tx/${receipt.txHash}`}
              />
            </section>

            {/* ── Gemini advisory summary ── */}
            <GeminiSummaryCard kind="receipt" referenceId={receipt.receiptId} />

            {/* ── Challenge action / status ── */}
            <ChallengeCTA
              receipt={receipt}
              onChallengeSubmitted={(id) => setChallengeId(id)}
            />

            {challengeId && <ChallengeStatus challengeId={challengeId} />}
          </>
        )}
      </div>
    </Shell>
  );
}

function Field({
  label,
  value,
  accent,
  truncate,
  href,
}: {
  label: string;
  value: string;
  accent?: boolean;
  truncate?: boolean;
  href?: string;
}) {
  const v = (
    <span
      className={`font-mono text-[12px] tnum ${
        accent ? "text-accent" : "text-text-secondary"
      } ${truncate ? "truncate inline-block max-w-[60ch] align-bottom" : "break-all"}`}
    >
      {value}
    </span>
  );
  return (
    <>
      <dt className="eyebrow self-start pt-px">{label}</dt>
      <dd>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent-bright underline-offset-4 hover:underline"
          >
            {v} <span className="text-text-tertiary text-[11px]">↗</span>
          </a>
        ) : (
          v
        )}
      </dd>
    </>
  );
}
