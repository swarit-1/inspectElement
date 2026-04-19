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
import { prepareChallenge, pollChallengeIdForReceipt } from "@/lib/api";
import { CONTRACT_ADDRESSES, formatUsdc } from "@/lib/constants";
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
  | "submitted"
  | "error";

export function ChallengeCTA({ receipt, onChallengeSubmitted }: ChallengeCTAProps) {
  const { address } = useAccount();
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
      const prep = await prepareChallenge(receipt.receiptId, address);

      if (!prep.eligible || !prep.to || !prep.data) {
        setError(prep.reason ?? "Challenge not eligible");
        setStep("error");
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
      }

      setStep("filing");
      const txHash = await sendTransactionAsync({
        to: prep.to,
        data: prep.data,
      });
      await waitForTransactionReceipt(config, { hash: txHash });

      const challengeId = await pollChallengeIdForReceipt(
        address,
        receipt.receiptId as Hex
      );
      setStep("submitted");
      onChallengeSubmitted(challengeId ?? "pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Challenge failed");
      setStep("error");
    }
  }

  if (!canChallenge) return null;

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
            This receipt of {formatUsdc(receipt.amount)} USDC exceeds the
            per-tx cap. Posting the bond opens a 24h dispute window; if upheld,
            you&apos;re refunded from operator stake.
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[12px] tnum">
        <dt className="eyebrow">Bond required</dt>
        <dd className="font-mono text-text-secondary">
          {bondAmount ? `${formatUsdc(bondAmount)} USDC` : "Computing…"}
          <span className="text-text-quat ml-2">refunded on success</span>
        </dd>
        <dt className="eyebrow">Refund source</dt>
        <dd className="font-mono text-text-secondary">Operator stake</dd>
      </dl>

      {error && (
        <div className="text-[12px] text-danger font-mono tnum">✕ {error}</div>
      )}

      {step === "submitted" ? (
        <div className="flex items-center gap-3 hairline-top pt-4">
          <StatusBadge variant="success">Filed</StatusBadge>
          <span className="font-mono text-[12px] tnum text-text-secondary">
            Awaiting arbiter resolution…
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-4 hairline-top pt-4">
          <Button
            variant="danger"
            size="md"
            onClick={() => void handleFileChallenge()}
            loading={
              step === "preparing" || step === "approving" || step === "filing"
            }
            disabled={step !== "idle" && step !== "error"}
          >
            {step === "preparing"
              ? "Preparing…"
              : step === "approving"
                ? "Approving bond…"
                : step === "filing"
                  ? "Filing challenge…"
                  : "File challenge"}
          </Button>
          <span className="font-mono text-[11px] tnum text-text-quat">
            requires USDC approval + tx signature
          </span>
        </div>
      )}
    </section>
  );
}
