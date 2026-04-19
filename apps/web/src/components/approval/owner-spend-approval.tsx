"use client";

import { useEffect, useRef, useState } from "react";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { ProgressRail } from "@/components/ui/loading";
import { Section } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import {
  CONTRACT_ADDRESSES,
  DEMO_MAX_SPEND_PER_DAY,
  USE_MOCKS,
  formatUsdc,
  truncateAddress,
} from "@/lib/constants";
import { erc20Abi } from "@/abi/erc20";
import { config } from "@/lib/wagmi";
import type { Hex } from "viem";

interface OwnerSpendApprovalProps {
  onApproved: () => void;
}

type Step = "idle" | "signing" | "confirming" | "confirmed" | "failed";

const STEPS = [
  { id: "sign", label: "Sign" },
  { id: "confirm", label: "Confirm" },
  { id: "live", label: "Live" },
];

export function OwnerSpendApproval({
  onApproved,
}: OwnerSpendApprovalProps) {
  const { address } = useAccount();
  const { toast } = useToast();
  const approvalNotified = useRef(false);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);

  const { data: allowance = 0n, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      address && !USE_MOCKS
        ? [address, CONTRACT_ADDRESSES.guardedExecutor]
        : undefined,
    query: { enabled: !!address && !USE_MOCKS },
  });

  const { writeContractAsync } = useWriteContract();

  useEffect(() => {
    if (USE_MOCKS) return;
    const approved =
      allowance >= DEMO_MAX_SPEND_PER_DAY || step === "confirmed";
    if (approved && !approvalNotified.current) {
      approvalNotified.current = true;
      onApproved();
      return;
    }
    if (!approved) {
      approvalNotified.current = false;
    }
  }, [allowance, onApproved, step]);

  async function handleApprove() {
    if (!address) return;
    setError(null);
    setTxHash(undefined);

    if (USE_MOCKS) {
      setStep("confirming");
      setTimeout(() => {
        if (!approvalNotified.current) {
          approvalNotified.current = true;
          onApproved();
        }
        setStep("confirmed");
        toast({
          variant: "success",
          title: "Stablecoin allowance live (mock)",
          description: `GuardedExecutor may spend up to ${formatUsdc(DEMO_MAX_SPEND_PER_DAY)} USD.`,
        });
      }, 900);
      return;
    }

    let phase: Step = "signing";
    try {
      setStep("signing");
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.usdc,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACT_ADDRESSES.guardedExecutor, DEMO_MAX_SPEND_PER_DAY],
      });
      setTxHash(hash);
      phase = "confirming";
      setStep("confirming");
      await waitForTransactionReceipt(config, { hash });
      await refetchAllowance();
      if (!approvalNotified.current) {
        approvalNotified.current = true;
        onApproved();
      }
      setStep("confirmed");
      toast({
        variant: "success",
        title: "Stablecoin allowance live",
        description: `GuardedExecutor may pull up to ${formatUsdc(DEMO_MAX_SPEND_PER_DAY)} USD per day.`,
        action: {
          label: "View tx",
          href: `https://sepolia.basescan.org/tx/${hash}`,
        },
      });
    } catch (err) {
      const msg = formatChainError(err);
      setError(msg);
      setStep("failed");
      toast({
        variant: "danger",
        title: phase === "confirming" ? "Allowance revert" : "Signature rejected",
        description: msg,
      });
    }
  }

  const isProcessing = step === "signing" || step === "confirming";
  const isApproved = USE_MOCKS
    ? step === "confirmed"
    : allowance >= DEMO_MAX_SPEND_PER_DAY || step === "confirmed";

  const stepIndex =
    step === "signing"
      ? 0
      : step === "confirming"
        ? 1
        : step === "confirmed"
          ? 2
          : 0;
  const failedIndex = step === "failed" ? stepIndex : undefined;

  return (
    <Section
      kicker="Step II · Spending Rail"
      title="Approve owner stablecoin"
      subtitle="Let GuardedExecutor pull up to the daily cap from this wallet during live demo runs"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-x-12 gap-y-6 max-w-[820px]">
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[12px] tnum">
            <dt className="eyebrow">Spender</dt>
            <dd className="font-mono text-text-secondary break-all">
              {CONTRACT_ADDRESSES.guardedExecutor}
            </dd>
            <dt className="eyebrow">Allowance target</dt>
            <dd className="font-mono text-text-secondary">
              {formatUsdc(DEMO_MAX_SPEND_PER_DAY)} USD
            </dd>
            {!USE_MOCKS && (
              <>
                <dt className="eyebrow">Current allowance</dt>
                <dd className="font-mono text-text-secondary">
                  {formatUsdc(allowance)} USD
                </dd>
              </>
            )}
          </dl>

          {(isProcessing || step === "confirmed" || step === "failed") && (
            <div className="hairline-top pt-5">
              <ProgressRail
                steps={STEPS}
                currentIndex={stepIndex}
                failedIndex={failedIndex}
              />
              <div className="mt-3 font-mono text-[11px] tnum text-text-tertiary tracking-wider uppercase">
                {stepLabel(step, txHash, isApproved)}
              </div>
            </div>
          )}

          {error && step === "failed" && (
            <div className="text-[12px] text-danger font-mono tnum hairline-top pt-3 break-words">
              ✕ {error}
            </div>
          )}

          <div className="flex items-center gap-4 pt-2 flex-wrap">
            <Button
              size="lg"
              onClick={handleApprove}
              loading={isProcessing}
              disabled={isProcessing || isApproved}
            >
              {step === "signing"
                ? "Awaiting signature…"
                : step === "confirming"
                  ? "Awaiting confirmation…"
                  : isApproved
                    ? "✓ Allowance live"
                    : "Approve GuardedExecutor"}
            </Button>
            {isApproved && (
              <span className="font-mono text-[12px] tnum text-success">
                ● {truncateAddress(CONTRACT_ADDRESSES.guardedExecutor, 6)} is approved
              </span>
            )}
            {step === "failed" && (
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setStep("idle");
                  setError(null);
                }}
              >
                Retry
              </Button>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-3 text-[12px] text-text-tertiary leading-relaxed max-w-[40ch]">
          <div className="eyebrow text-text-secondary">What this does</div>
          <p>
            Approves the protocol executor to transfer stablecoin from the connected
            owner wallet when the server wallet submits a guarded payment.
          </p>
          <p>
            The approval is capped at the demo&apos;s daily limit, so the live
            runtime cannot pull more than {formatUsdc(DEMO_MAX_SPEND_PER_DAY)} USD
            without a fresh signature.
          </p>
        </aside>
      </div>
    </Section>
  );
}

function stepLabel(step: Step, tx: Hex | undefined, isApproved: boolean): string {
  if (isApproved && step === "confirmed") {
    return "Owner allowance is live. Server wallet can now execute within the committed policy.";
  }
  switch (step) {
    case "signing":
      return "Open your wallet and sign approve(GuardedExecutor, maxSpendPerDay).";
    case "confirming":
      return tx
        ? `Awaiting receipt for tx ${truncateAddress(tx, 6)}…`
        : "Awaiting on-chain confirmation…";
    case "failed":
      return "Allowance update failed. Review and retry.";
    default:
      return "";
  }
}

function formatChainError(err: unknown): string {
  if (!err) return "Unknown error";
  const anyErr = err as { shortMessage?: string; message?: string };
  const msg = (anyErr.shortMessage ?? anyErr.message ?? "").trim();
  const lower = msg.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user denied")) {
    return "Signature rejected in wallet";
  }
  return msg || "Transaction failed";
}
