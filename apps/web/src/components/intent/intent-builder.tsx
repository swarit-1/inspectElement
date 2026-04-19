"use client";

import { useEffect, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { ProgressRail } from "@/components/ui/loading";
import { useToast } from "@/components/ui/toast";
import { IntentPreview } from "./intent-preview";
import { postManifest } from "@/lib/api";
import {
  DEMO_MAX_SPEND_PER_TX,
  DEMO_MAX_SPEND_PER_DAY,
  DEMO_EXPIRY_DAYS,
  DEFAULT_COUNTERPARTIES,
  CONTRACT_ADDRESSES,
  formatUsdc,
  truncateAddress,
  USE_MOCKS,
} from "@/lib/constants";
import { intentRegistryAbi } from "@/abi/intent-registry";
import type { Address, Hex } from "viem";

interface IntentBuilderProps {
  onCommitted: (intentHash: Hex) => void;
}

type Step = "form" | "pinning" | "signing" | "confirming" | "confirmed" | "failed";

const STEPS = [
  { id: "pin", label: "Pin" },
  { id: "sign", label: "Sign" },
  { id: "confirm", label: "Confirm" },
  { id: "done", label: "Live" },
];

export function IntentBuilder({ onCommitted }: IntentBuilderProps) {
  const { address } = useAccount();
  const { toast } = useToast();
  const [counterparties, setCounterparties] = useState<string[]>(
    DEFAULT_COUNTERPARTIES.map(String)
  );
  const [expiryDays, setExpiryDays] = useState(DEMO_EXPIRY_DAYS);
  const [step, setStep] = useState<Step>("form");
  const [intentHash, setIntentHash] = useState<Hex | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { writeContract, data: txHash, reset: resetWrite } = useWriteContract();
  const {
    isSuccess: isConfirmed,
    isLoading: isReceiptLoading,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  // Transition to "confirmed" only when the on-chain receipt actually lands.
  useEffect(() => {
    if (!txHash || !intentHash) return;
    if (isConfirmed && step === "confirming") {
      setStep("confirmed");
      onCommitted(intentHash);
      toast({
        variant: "success",
        title: "Intent committed",
        description: `Manifest pinned and registered on-chain · ${truncateAddress(intentHash, 6)}`,
        action: txHash
          ? {
              label: "View tx",
              href: `https://sepolia.basescan.org/tx/${txHash}`,
            }
          : undefined,
      });
    }
  }, [isConfirmed, step, txHash, intentHash, onCommitted, toast]);

  useEffect(() => {
    if (isReceiptError && step === "confirming") {
      const msg = formatChainError(receiptError);
      setError(msg);
      setStep("failed");
      toast({ variant: "danger", title: "Transaction reverted", description: msg });
    }
  }, [isReceiptError, receiptError, step, toast]);

  function updateCounterparty(index: number, value: string) {
    setCounterparties((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function handleSignAndCommit() {
    if (!address) return;
    setError(null);
    resetWrite();
    setStep("pinning");

    const expiry = Math.floor(Date.now() / 1000) + expiryDays * 86400;
    const nonce = Date.now();

    try {
      const manifest = {
        owner: address,
        token: CONTRACT_ADDRESSES.usdc,
        maxSpendPerTx: DEMO_MAX_SPEND_PER_TX.toString(),
        maxSpendPerDay: DEMO_MAX_SPEND_PER_DAY.toString(),
        allowedCounterparties: counterparties.filter(Boolean),
        expiry,
        nonce,
      };

      const { manifestURI, intentHash: hash } = await postManifest(manifest);
      setIntentHash(hash);

      // In mock mode, skip wallet/chain and finalize directly.
      if (USE_MOCKS) {
        setStep("confirming");
        await new Promise((r) => setTimeout(r, 900));
        setStep("confirmed");
        onCommitted(hash);
        toast({
          variant: "success",
          title: "Intent committed (mock)",
          description: `Manifest ${truncateAddress(hash, 6)} pinned to in-browser ledger.`,
        });
        return;
      }

      setStep("signing");
      writeContract(
        {
          address: CONTRACT_ADDRESSES.intentRegistry,
          abi: intentRegistryAbi,
          functionName: "commitIntent",
          args: [
            hash,
            {
              owner: address,
              token: CONTRACT_ADDRESSES.usdc,
              maxSpendPerTx: DEMO_MAX_SPEND_PER_TX,
              maxSpendPerDay: DEMO_MAX_SPEND_PER_DAY,
              allowedCounterparties: counterparties.filter(Boolean) as Address[],
              expiry: BigInt(expiry),
              nonce: BigInt(nonce),
            },
            manifestURI,
          ],
        },
        {
          onSuccess: () => {
            // Wallet submitted the tx — now await receipt confirmation.
            setStep("confirming");
          },
          onError: (err) => {
            const msg = formatChainError(err);
            setError(msg);
            setStep("failed");
            toast({
              variant: "danger",
              title: "Signature rejected",
              description: msg,
            });
          },
        }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setStep("failed");
      toast({ variant: "danger", title: "Manifest pin failed", description: msg });
    }
  }

  const isProcessing =
    step === "pinning" || step === "signing" || step === "confirming" || isReceiptLoading;

  const stepIndex =
    step === "pinning"
      ? 0
      : step === "signing"
        ? 1
        : step === "confirming"
          ? 2
          : step === "confirmed"
            ? 3
            : 0;
  const failedIndex = step === "failed" ? stepIndex : undefined;

  return (
    <Section
      kicker="Step I · Manifest"
      title="Commit intent"
      subtitle="Define the spend envelope your agent must operate within"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-x-12 gap-y-8">
        {/* Form column */}
        <div className="flex flex-col gap-7">
          {/* Caps — read-only spec values */}
          <div className="grid grid-cols-2">
            <ReadValue label="Per-tx cap" value={formatUsdc(DEMO_MAX_SPEND_PER_TX)} unit="USDC" />
            <ReadValue label="Daily cap" value={formatUsdc(DEMO_MAX_SPEND_PER_DAY)} unit="USDC" />
          </div>

          {/* Counterparties */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Allowed counterparties</span>
              <span className="font-mono text-[11px] tnum text-text-quat">
                {counterparties.filter(Boolean).length} / 3
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {counterparties.map((cp, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="seq tabular-nums w-5 shrink-0 text-text-quat">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1">
                    <Input
                      value={cp}
                      onChange={(e) => updateCounterparty(i, e.target.value)}
                      placeholder={`0x… address ${i + 1}`}
                      className="font-mono text-[12px]"
                      disabled={isProcessing || step === "confirmed"}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expiry */}
          <div className="max-w-[240px]">
            <Input
              label="Expiry window"
              type="number"
              min={1}
              max={365}
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              suffix="days"
              disabled={isProcessing || step === "confirmed"}
            />
          </div>

          {(isProcessing || step === "confirmed" || step === "failed") && (
            <div className="hairline-top pt-5">
              <ProgressRail
                steps={STEPS}
                currentIndex={stepIndex}
                failedIndex={failedIndex}
              />
              <div className="mt-3 font-mono text-[11px] tnum text-text-tertiary tracking-wider uppercase">
                {stepLabel(step, txHash)}
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
              onClick={handleSignAndCommit}
              loading={isProcessing}
              disabled={isProcessing || step === "confirmed" || !address}
            >
              {step === "pinning"
                ? "Pinning manifest…"
                : step === "signing"
                  ? "Awaiting signature…"
                  : step === "confirming"
                    ? "Awaiting confirmation…"
                    : step === "confirmed"
                      ? "✓ Intent committed"
                      : "Sign & commit"}
            </Button>
            {step === "confirmed" && (
              <span className="font-mono text-[12px] tnum text-success">
                ● Active on-chain
              </span>
            )}
            {step === "failed" && (
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setStep("form");
                  setError(null);
                }}
              >
                Retry
              </Button>
            )}
          </div>
        </div>

        {/* Preview column */}
        <IntentPreview
          maxSpendPerTx={DEMO_MAX_SPEND_PER_TX}
          maxSpendPerDay={DEMO_MAX_SPEND_PER_DAY}
          counterparties={counterparties.filter(Boolean) as Address[]}
          expiryDays={expiryDays}
          intentHash={intentHash}
        />
      </div>
    </Section>
  );
}

function stepLabel(step: Step, tx: Hex | undefined): string {
  switch (step) {
    case "pinning":
      return "Pinning manifest to infra (IPFS + signer)…";
    case "signing":
      return "Open your wallet and sign the commitIntent call.";
    case "confirming":
      return tx
        ? `Awaiting receipt for tx ${truncateAddress(tx, 6)}…`
        : "Awaiting on-chain confirmation…";
    case "confirmed":
      return "Intent is active. Agent delegation is next.";
    case "failed":
      return "Run interrupted. Review the error below and retry.";
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
    return "Signature declined in wallet.";
  }
  if (lower.includes("insufficient funds") || lower.includes("gas required")) {
    return "Insufficient gas — top up the signer's ETH on Base Sepolia.";
  }
  if (lower.includes("nonce")) {
    return "Nonce conflict — the last tx is still pending. Wait and retry.";
  }
  if (lower.length > 180) return lower.slice(0, 180) + "…";
  return msg || "Transaction failed.";
}

function ReadValue({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-rule-subtle pb-3">
      <span className="eyebrow">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span
          className="font-display font-semibold tnum text-text-primary leading-none tracking-tight"
          style={{ fontSize: "var(--t-xl)" }}
        >
          {value}
        </span>
        <span className="text-[11px] text-text-tertiary tnum font-mono uppercase tracking-wider">
          {unit}
        </span>
      </div>
    </div>
  );
}
