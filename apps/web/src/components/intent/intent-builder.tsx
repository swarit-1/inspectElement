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
  CONTRACT_ADDRESSES,
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

  const { writeContract, data: txHash } = useWriteContract();
  useWaitForTransactionReceipt({ hash: txHash });

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

      setStep("confirming");
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
      index="01"
      kicker="Manifest"
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
            />
          </div>

          {error && (
            <div className="text-[12px] text-danger font-mono tnum hairline-top pt-3">
              ✕ {error}
            </div>
          )}

          <div className="flex items-center gap-4 pt-2">
            <Button
              size="lg"
              onClick={handleSignAndCommit}
              loading={isProcessing}
              disabled={isProcessing || step === "done"}
            >
              {step === "signing"
                ? "Pinning manifest…"
                : step === "confirming"
                  ? "Confirming on-chain…"
                  : step === "done"
                    ? "✓ Intent committed"
                    : "Sign & commit"}
            </Button>
            {step === "done" && (
              <span className="font-mono text-[12px] tnum text-success">
                ● Active on-chain
              </span>
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
