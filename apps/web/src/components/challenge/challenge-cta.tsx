"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { prepareChallenge } from "@/lib/api";
import { PLACEHOLDER_ADDRESSES, formatUsdc } from "@/lib/constants";
import { erc20Abi } from "@/abi/erc20";
import { challengeArbiterAbi } from "@/abi/challenge-arbiter";
import type { ReceiptDetail } from "@/lib/types";
import type { Hex } from "viem";

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

  const { writeContract } = useWriteContract();

  async function handleFileChallenge() {
    if (!address) return;
    setError(null);
    setStep("preparing");

    try {
      // Step 1: Prepare challenge (IF-07)
      const prep = await prepareChallenge(receipt.receiptId, address);

      if (!prep.eligible) {
        setError(prep.reason);
        setStep("error");
        return;
      }

      setBondAmount(prep.bondAmount);

      // Step 2: Approve USDC bond
      setStep("approving");
      await new Promise<void>((resolve, reject) => {
        writeContract(
          {
            address: PLACEHOLDER_ADDRESSES.usdc,
            abi: erc20Abi,
            functionName: "approve",
            args: [
              PLACEHOLDER_ADDRESSES.challengeArbiter,
              BigInt(prep.bondAmount),
            ],
          },
          {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          }
        );
      });

      // Step 3: File challenge (IF-08)
      setStep("filing");
      writeContract(
        {
          address: PLACEHOLDER_ADDRESSES.challengeArbiter,
          abi: challengeArbiterAbi,
          functionName: "fileAmountViolation",
          args: [receipt.receiptId],
        },
        {
          onSuccess: () => {
            setStep("submitted");
            onChallengeSubmitted("1"); // mock challenge ID
          },
          onError: (err) => {
            setError(err.message);
            setStep("error");
          },
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Challenge failed");
      setStep("error");
    }
  }

  if (receipt.status !== "overspend") return null;

  return (
    <div className="bg-bg-surface border border-border rounded-[--radius-lg] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Amount Violation Detected
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            This receipt ({formatUsdc(receipt.amount)} USDC) exceeds the 10 USDC per-tx cap
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
          onClick={handleFileChallenge}
          loading={step === "preparing" || step === "approving" || step === "filing"}
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
