"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useSendTransaction,
  useWriteContract,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { maxUint256, type Hex } from "viem";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressRail } from "@/components/ui/loading";
import { useToast } from "@/components/ui/toast";
import { prepareChallenge, pollChallengeIdForReceipt } from "@/lib/api";
import { CONTRACT_ADDRESSES, USE_MOCKS, formatUsdc, truncateAddress } from "@/lib/constants";
import { config } from "@/lib/wagmi";
import { erc20Abi } from "@/abi/erc20";
import type { ReceiptDetail } from "@/lib/types";

interface ChallengeCTAProps {
  receipt: ReceiptDetail;
  onChallengeSubmitted: (challengeId: string) => void;
}

type ChallengeStep =
  | "idle"
  | "preparing"
  | "approving"
  | "filing"
  | "indexing"
  | "submitted"
  | "error";

const FLOW_STEPS = [
  { id: "prep", label: "Prepare" },
  { id: "approve", label: "Approve" },
  { id: "file", label: "File" },
  { id: "index", label: "Index" },
  { id: "done", label: "Open" },
];

function stepToIndex(s: ChallengeStep): number {
  switch (s) {
    case "preparing":
      return 0;
    case "approving":
      return 1;
    case "filing":
      return 2;
    case "indexing":
      return 3;
    case "submitted":
      return 4;
    default:
      return 0;
  }
}

function stepLabel(step: ChallengeStep): string {
  switch (step) {
    case "preparing":
      return "Building calldata from the infra API…";
    case "approving":
      return "Requesting stablecoin bond approval for the arbiter…";
    case "filing":
      return "Awaiting on-chain confirmation of fileChallenge…";
    case "indexing":
      return "Waiting for indexer to attach challenge id to the receipt…";
    case "submitted":
      return "Challenge filed. Arbiter will resolve within the 24h window.";
    case "error":
      return "Challenge pipeline halted. Review the error below and retry.";
    default:
      return "";
  }
}

export function ChallengeCTA({ receipt, onChallengeSubmitted }: ChallengeCTAProps) {
  const { address } = useAccount();
  const { toast } = useToast();
  const [step, setStep] = useState<ChallengeStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [bondAmount, setBondAmount] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();

  const { data: allowance = 0n } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      address && CONTRACT_ADDRESSES.challengeArbiter
        ? [address, CONTRACT_ADDRESSES.challengeArbiter]
        : undefined,
    query: { enabled: !!(address && CONTRACT_ADDRESSES.challengeArbiter) },
  });

  const canChallenge =
    (receipt.status === "overspend" || receipt.challengeable) &&
    !receipt.challengeFiled;

  async function handleFileChallenge() {
    if (!address) return;
    setError(null);
    setStep("preparing");

    try {
      // In mock mode, skip on-chain calls and drive the steps on a timer so
      // judges see every phase of the pipeline instead of an instant jump.
      if (USE_MOCKS) {
        await new Promise((r) => setTimeout(r, 700));
        setBondAmount("1000000");
        setStep("approving");
        await new Promise((r) => setTimeout(r, 700));
        setStep("filing");
        await new Promise((r) => setTimeout(r, 900));
        setStep("indexing");
        const challengeId = await pollChallengeIdForReceipt(
          address,
          receipt.receiptId as Hex
        );
        setStep("submitted");
        onChallengeSubmitted(challengeId ?? "pending");
        toast({
          variant: "info",
          title: "Challenge filed",
          description: `Awaiting arbiter resolution (≤ 24h window). Challenge #${challengeId ?? "pending"}.`,
        });
        return;
      }

      const prep = await prepareChallenge(receipt.receiptId, address);

      if (!prep.eligible || !prep.to || !prep.data) {
        const reason = prep.reason ?? "Challenge not eligible";
        setError(reason);
        setStep("error");
        toast({
          variant: "warning",
          title: "Challenge ineligible",
          description: reason,
        });
        return;
      }

      setBondAmount(prep.bondAmount);
      const bond = BigInt(prep.bondAmount);

      if (allowance < bond) {
        setStep("approving");
        const approveHash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.usdc,
          abi: erc20Abi,
          functionName: "approve",
          args: [CONTRACT_ADDRESSES.challengeArbiter, maxUint256],
        });
        await waitForTransactionReceipt(config, { hash: approveHash });
        toast({
          variant: "success",
          title: "Stablecoin approval confirmed",
          description: `Arbiter may now pull up to ${formatUsdc(bond)} USD as bond.`,
        });
      }

      setStep("filing");
      const txHash = await sendTransactionAsync({
        to: prep.to,
        data: prep.data,
      });
      toast({
        variant: "info",
        title: "File tx submitted",
        description: `Awaiting confirmation · ${truncateAddress(txHash, 6)}`,
      });
      await waitForTransactionReceipt(config, { hash: txHash });

      setStep("indexing");
      const challengeId = await pollChallengeIdForReceipt(
        address,
        receipt.receiptId as Hex
      );
      setStep("submitted");
      onChallengeSubmitted(challengeId ?? "pending");
      toast({
        variant: "info",
        title: "Challenge filed",
        description: challengeId
          ? `Tracking #${challengeId}. Arbiter will resolve within 24h.`
          : "Indexer is still catching up. The status panel will update when ready.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Challenge failed";
      setError(formatChainError(msg));
      setStep("error");
      toast({
        variant: "danger",
        title: "Challenge halted",
        description: formatChainError(msg),
      });
    }
  }

  if (!canChallenge) return null;

  const stepIndex = stepToIndex(step);
  const failedIndex = step === "error" ? stepIndex : undefined;
  const showRail = step !== "idle";

  return (
    <section className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-4">
        <div>
          <span className="eyebrow text-warning">● Recourse available</span>
          <h3
            className="font-display font-semibold tracking-tight text-text-primary mt-1.5"
            style={{ fontSize: "var(--t-lg)" }}
          >
            File AmountViolation challenge
          </h3>
          <p className="text-[12px] text-text-tertiary mt-1 max-w-[60ch]">
            This receipt of {formatUsdc(receipt.amount)} USD exceeds the per-tx
            cap. Posting the bond opens a 24h dispute window; if upheld, you&apos;re
            refunded from operator stake.
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[12px] tnum">
        <dt className="eyebrow">Bond required</dt>
        <dd className="font-mono text-text-secondary">
          {bondAmount ? `${formatUsdc(bondAmount)} USD` : "1.0 USD"}
          <span className="text-text-quat ml-2">refunded on success</span>
        </dd>
        <dt className="eyebrow">Refund source</dt>
        <dd className="font-mono text-text-secondary">Operator stake</dd>
      </dl>

      {showRail && (
        <div className="hairline-top pt-5">
          <ProgressRail
            steps={FLOW_STEPS}
            currentIndex={stepIndex}
            failedIndex={failedIndex}
          />
          <div className="mt-3 font-mono text-[11px] tnum text-text-tertiary tracking-wider uppercase">
            {stepLabel(step)}
          </div>
        </div>
      )}

      {error && step === "error" && (
        <div className="text-[12px] text-danger font-mono tnum break-words">
          ✕ {error}
        </div>
      )}

      {step === "submitted" ? (
        <div className="flex items-center gap-3 hairline-top pt-4">
          <StatusBadge variant="info">Filed</StatusBadge>
          <span className="font-mono text-[12px] tnum text-text-secondary">
            Awaiting arbiter resolution…
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-4 hairline-top pt-4 flex-wrap">
          <Button
            variant="danger"
            size="md"
            onClick={() => void handleFileChallenge()}
            loading={
              step === "preparing" ||
              step === "approving" ||
              step === "filing" ||
              step === "indexing"
            }
            disabled={step !== "idle" && step !== "error"}
          >
            {step === "preparing"
              ? "Preparing…"
              : step === "approving"
                ? "Approving bond…"
                : step === "filing"
                  ? "Filing challenge…"
                  : step === "indexing"
                    ? "Indexing…"
                    : step === "error"
                      ? "Retry challenge"
                      : "File challenge"}
          </Button>
          <span className="font-mono text-[11px] tnum text-text-quat">
            requires stablecoin approval + tx signature
          </span>
        </div>
      )}
    </section>
  );
}

function formatChainError(err: unknown): string {
  if (!err) return "Unknown error";
  const msg =
    typeof err === "string"
      ? err
      : ((err as { shortMessage?: string }).shortMessage ??
        (err as { message?: string }).message ??
        "");
  const lower = msg.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user denied")) {
    return "Signature declined in wallet.";
  }
  if (lower.includes("insufficient funds")) {
    return "Insufficient stablecoin or ETH to post the challenge bond.";
  }
  if (lower.includes("allowance")) {
    return "Stablecoin approval missing — try again to re-request allowance.";
  }
  if (lower.length > 180) return msg.slice(0, 180) + "…";
  return msg || "Challenge failed.";
}
