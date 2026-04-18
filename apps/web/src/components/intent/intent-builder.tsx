"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { IntentPreview } from "./intent-preview";
import { postManifest } from "@/lib/api";
import {
  DEMO_MAX_SPEND_PER_TX,
  DEMO_MAX_SPEND_PER_DAY,
  DEMO_EXPIRY_DAYS,
  DEFAULT_COUNTERPARTIES,
  PLACEHOLDER_ADDRESSES,
  USDC_DECIMALS,
  formatUsdc,
} from "@/lib/constants";
import { intentRegistryAbi } from "@/abi/intent-registry";
import type { Address, Hex } from "viem";

interface IntentBuilderProps {
  onCommitted: (intentHash: Hex) => void;
}

export function IntentBuilder({ onCommitted }: IntentBuilderProps) {
  const { address } = useAccount();
  const [counterparties, setCounterparties] = useState<string[]>(
    DEFAULT_COUNTERPARTIES.map(String)
  );
  const [expiryDays, setExpiryDays] = useState(DEMO_EXPIRY_DAYS);
  const [step, setStep] = useState<"form" | "signing" | "confirming" | "done">(
    "form"
  );
  const [intentHash, setIntentHash] = useState<Hex | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending: isSigning } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

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
    setStep("signing");

    const expiry = Math.floor(Date.now() / 1000) + expiryDays * 86400;
    const nonce = Date.now();

    try {
      // Step 1: Pin manifest with infra (IF-01)
      const manifest = {
        owner: address,
        token: PLACEHOLDER_ADDRESSES.usdc,
        maxSpendPerTx: DEMO_MAX_SPEND_PER_TX.toString(),
        maxSpendPerDay: DEMO_MAX_SPEND_PER_DAY.toString(),
        allowedCounterparties: counterparties.filter(Boolean),
        expiry,
        nonce,
      };

      const { manifestURI, intentHash: hash } = await postManifest(manifest);
      setIntentHash(hash);

      // Step 2: Commit on-chain (IF-02)
      setStep("confirming");
      writeContract(
        {
          address: PLACEHOLDER_ADDRESSES.intentRegistry,
          abi: intentRegistryAbi,
          functionName: "commitIntent",
          args: [
            hash,
            {
              owner: address,
              token: PLACEHOLDER_ADDRESSES.usdc,
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
            setStep("done");
            onCommitted(hash);
          },
          onError: (err) => {
            setError(err.message);
            setStep("form");
          },
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStep("form");
    }
  }

  const isProcessing = step === "signing" || step === "confirming";

  return (
    <Section
      title="Commit Intent"
      subtitle="Define what your agent is allowed to do with USDC"
    >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-5 bg-bg-surface border border-border rounded-[--radius-lg] p-5">
          {/* Fixed fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Per-TX Cap
              </span>
              <div className="bg-bg-raised border border-border-subtle rounded-[--radius-md] px-3 py-2 text-sm font-mono text-text-primary">
                {formatUsdc(DEMO_MAX_SPEND_PER_TX)} USDC
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Daily Cap
              </span>
              <div className="bg-bg-raised border border-border-subtle rounded-[--radius-md] px-3 py-2 text-sm font-mono text-text-primary">
                {formatUsdc(DEMO_MAX_SPEND_PER_DAY)} USDC
              </div>
            </div>
          </div>

          {/* Editable counterparties */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              Allowed Counterparties
            </span>
            {counterparties.map((cp, i) => (
              <Input
                key={i}
                value={cp}
                onChange={(e) => updateCounterparty(i, e.target.value)}
                placeholder={`0x... (counterparty ${i + 1})`}
                className="font-mono text-xs"
              />
            ))}
          </div>

          {/* Expiry */}
          <Input
            label="Expiry (days from now)"
            type="number"
            min={1}
            max={365}
            value={expiryDays}
            onChange={(e) => setExpiryDays(Number(e.target.value))}
          />

          {error && (
            <p className="text-sm text-danger bg-danger-dim rounded-[--radius-md] px-3 py-2">
              {error}
            </p>
          )}

          <Button
            onClick={handleSignAndCommit}
            loading={isProcessing}
            disabled={isProcessing || step === "done"}
          >
            {step === "signing"
              ? "Pinning manifest..."
              : step === "confirming"
                ? "Confirming on-chain..."
                : step === "done"
                  ? "Intent committed"
                  : "Sign & Commit Intent"}
          </Button>
        </div>

        {/* Preview (2 cols) */}
        <div className="lg:col-span-2">
          <IntentPreview
            maxSpendPerTx={DEMO_MAX_SPEND_PER_TX}
            maxSpendPerDay={DEMO_MAX_SPEND_PER_DAY}
            counterparties={counterparties.filter(Boolean) as Address[]}
            expiryDays={expiryDays}
            intentHash={intentHash}
          />
        </div>
      </div>
    </Section>
  );
}
