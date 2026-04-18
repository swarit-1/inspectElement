"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useSendTransaction,
  useWriteContract,
  skipToken,
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
        : skipToken,
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
    <div className="bg-bg-surface border border-border rounded-[--radius-lg] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Amount Violation Detected
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            This receipt ({formatUsdc(receipt.amount)} USDC) exceeds the per-tx cap
          </p>
        </div>
        <StatusBadge variant="warning">Challengeable</StatusBadge>
      </div>

      {bondAmount && (
        <div className="text-xs text-text-secondary">
          Challenge bond: {formatUsdc(bondAmount)} USDC (refunded on success)
        </div>
      )}

      {error && (
        <p className="text-sm text-danger bg-danger-dim rounded-[--radius-md] px-3 py-2">
          {error}
        </p>
      )}

      {step === "submitted" ? (
        <div className="bg-success-dim rounded-[--radius-md] px-4 py-3 text-sm text-success font-medium">
          Challenge filed successfully. Awaiting resolution...
        </div>
      ) : (
        <Button
          variant="danger"
          onClick={() => void handleFileChallenge()}
          loading={
            step === "preparing" || step === "approving" || step === "filing"
          }
          disabled={step !== "idle" && step !== "error"}
        >
          {step === "preparing"
            ? "Preparing..."
            : step === "approving"
              ? "Approving bond..."
              : step === "filing"
                ? "Filing challenge..."
                : "File AmountViolation"}
        </Button>
      )}
    </div>
  );
}
