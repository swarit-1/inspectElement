"use client";

import { useState } from "react";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useAccount, useWriteContract } from "wagmi";
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
  DEFAULT_COUNTERPARTY_OPTIONS,
  CONTRACT_ADDRESSES,
  getCounterpartyOption,
  formatUsdc,
  truncateAddress,
  USE_MOCKS,
} from "@/lib/constants";
import { intentRegistryAbi } from "@/abi/intent-registry";
import { config } from "@/lib/wagmi";
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
  const [showAdvancedCounterparties, setShowAdvancedCounterparties] = useState(false);
  const [expiryDays, setExpiryDays] = useState(DEMO_EXPIRY_DAYS);
  const [step, setStep] = useState<Step>("form");
  const [intentHash, setIntentHash] = useState<Hex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);

  const { writeContractAsync } = useWriteContract();

  function updateCounterparty(index: number, value: string) {
    setCounterparties((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function isPresetSelected(candidate: string): boolean {
    return counterparties.some(
      (counterparty) =>
        counterparty.trim().toLowerCase() === candidate.toLowerCase()
    );
  }

  function togglePreset(addressToToggle: Address) {
    const alreadySelected = isPresetSelected(addressToToggle);
    if (!alreadySelected && counterparties.every((counterparty) => counterparty.trim())) {
      toast({
        variant: "warning",
        title: "Counterparty list full",
        description: "Remove one merchant or switch to advanced mode before adding another address.",
      });
      return;
    }

    setCounterparties((prev) => {
      const next = [...prev];
      const existingIndex = next.findIndex(
        (counterparty) =>
          counterparty.trim().toLowerCase() === addressToToggle.toLowerCase()
      );

      if (existingIndex >= 0) {
        next[existingIndex] = "";
        return next;
      }

      const blankIndex = next.findIndex((counterparty) => !counterparty.trim());
      if (blankIndex >= 0) {
        next[blankIndex] = addressToToggle;
      }
      return next;
    });
  }

  async function handleSignAndCommit() {
    if (!address) return;
    setError(null);
    setTxHash(undefined);
    setStep("pinning");

    const expiry = Math.floor(Date.now() / 1000) + expiryDays * 86400;
    const nonce = Date.now();
    const allowedCounterparties = counterparties
      .map((counterparty) => counterparty.trim())
      .filter(Boolean);

    if (allowedCounterparties.length === 0) {
      const msg = "Choose at least one allowed merchant before committing rules.";
      setError(msg);
      setStep("failed");
      toast({ variant: "warning", title: "No merchants selected", description: msg });
      return;
    }

    const invalidCounterparty = allowedCounterparties.find(
      (counterparty) => !/^0x[0-9a-fA-F]{40}$/.test(counterparty)
    );
    if (invalidCounterparty) {
      const msg = "Each merchant address must be a valid 42-character 0x address.";
      setError(msg);
      setStep("failed");
      toast({ variant: "warning", title: "Address needs attention", description: msg });
      return;
    }

    let phase: Step = "pinning";
    try {
      const manifest = {
        owner: address,
        token: CONTRACT_ADDRESSES.usdc,
        maxSpendPerTx: DEMO_MAX_SPEND_PER_TX.toString(),
        maxSpendPerDay: DEMO_MAX_SPEND_PER_DAY.toString(),
        allowedCounterparties,
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

      phase = "signing";
      setStep("signing");
      const submittedTxHash = await writeContractAsync({
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
            allowedCounterparties: allowedCounterparties as Address[],
            expiry: BigInt(expiry),
            nonce: BigInt(nonce),
          },
          manifestURI,
        ],
      });
      setTxHash(submittedTxHash);
      phase = "confirming";
      setStep("confirming");
      await waitForTransactionReceipt(config, { hash: submittedTxHash });
      setStep("confirmed");
      onCommitted(hash);
      toast({
        variant: "success",
        title: "Rules committed",
        description: `Manifest pinned and registered on-chain · ${truncateAddress(hash, 6)}`,
        action: {
          label: "View tx",
          href: `https://sepolia.basescan.org/tx/${submittedTxHash}`,
        },
      });
    } catch (err) {
      const msg =
        phase === "pinning"
          ? err instanceof Error
            ? err.message
            : "Unknown error"
          : formatChainError(err);
      setError(msg);
      setStep("failed");
      toast({
        variant: "danger",
        title:
          phase === "pinning"
            ? "Manifest pin failed"
            : phase === "confirming"
              ? "Transaction reverted"
              : "Signature rejected",
        description: msg,
      });
    }
  }

  const isProcessing =
    step === "pinning" || step === "signing" || step === "confirming";
  const selectedCounterparties = counterparties
    .map((counterparty) => counterparty.trim())
    .filter(Boolean) as Address[];

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
      kicker="Step I · Rules"
      title="Set payment rules"
      subtitle="Choose who the agent may pay; the shared protocol contracts are already deployed for you"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-x-12 gap-y-8">
        {/* Form column */}
        <div className="flex flex-col gap-7">
          <div className="border border-rule-subtle bg-bg-raised/40 px-4 py-4 flex flex-col gap-3">
            <span className="eyebrow text-accent">This Is The Rules Screen</span>
            <p className="text-[13px] text-text-secondary leading-relaxed">
              Start here to define the owner&apos;s guardrails. You are not deploying
              a new contract. You are telling the live protocol which merchants the
              server wallet may pay, how much it may spend, and how long those
              permissions stay active.
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px] tnum font-mono">
              <dt className="text-text-quat">Token</dt>
              <dd className="text-text-secondary">USDC</dd>
              <dt className="text-text-quat">Registry</dt>
              <dd className="text-text-secondary">
                {truncateAddress(CONTRACT_ADDRESSES.intentRegistry, 6)}
              </dd>
              <dt className="text-text-quat">Executor</dt>
              <dd className="text-text-secondary">
                {truncateAddress(CONTRACT_ADDRESSES.guardedExecutor, 6)}
              </dd>
            </dl>
          </div>

          {/* Caps — read-only spec values */}
          <div className="grid grid-cols-2">
            <ReadValue label="Per-tx cap" value={formatUsdc(DEMO_MAX_SPEND_PER_TX)} unit="USDC" />
            <ReadValue label="Daily cap" value={formatUsdc(DEMO_MAX_SPEND_PER_DAY)} unit="USDC" />
          </div>

          {/* Counterparties */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Allowed merchants</span>
              <span className="font-mono text-[11px] tnum text-text-quat">
                {selectedCounterparties.length} / 3
              </span>
            </div>

            <p className="text-[12px] text-text-tertiary leading-relaxed">
              Most users should use named merchant presets instead of raw addresses.
              Advanced address editing is still available below when needed.
            </p>

            <div className="flex flex-col gap-3">
              {DEFAULT_COUNTERPARTY_OPTIONS.map((option) => {
                const selected = isPresetSelected(option.address);
                return (
                  <div
                    key={option.address}
                    className={`
                      border px-4 py-3 flex items-start justify-between gap-4
                      ${selected ? "border-accent/45 bg-accent-subtle/25" : "border-rule-subtle bg-bg-raised/20"}
                    `}
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] text-text-primary font-medium">
                          {option.label}
                        </span>
                        <span className="font-mono text-[10.5px] tnum text-text-quat">
                          {truncateAddress(option.address, 6)}
                        </span>
                      </div>
                      <p className="text-[12px] text-text-tertiary leading-relaxed">
                        {option.description}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={selected ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => togglePreset(option.address)}
                      disabled={isProcessing || step === "confirmed"}
                    >
                      {selected ? "Included" : "Allow"}
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap hairline-top pt-4">
              <div className="text-[12px] text-text-tertiary leading-relaxed max-w-[46ch]">
                Advanced mode is only for teams that need to paste a custom merchant
                address. Leaving a slot blank removes it from the rules.
              </div>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setShowAdvancedCounterparties((current) => !current)}
                disabled={isProcessing || step === "confirmed"}
              >
                {showAdvancedCounterparties
                  ? "Hide raw addresses"
                  : "Edit raw addresses"}
              </Button>
            </div>

            {showAdvancedCounterparties && (
              <div className="flex flex-col gap-3">
                {counterparties.map((cp, i) => {
                  const option = cp ? getCounterpartyOption(cp) : null;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <span className="seq tabular-nums w-5 shrink-0 text-text-quat pt-3">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 flex flex-col gap-1.5">
                        <Input
                          label={`Merchant address ${i + 1}`}
                          value={cp}
                          onChange={(e) => updateCounterparty(i, e.target.value)}
                          placeholder={`0x… merchant address ${i + 1}`}
                          className="font-mono text-[12px]"
                          disabled={isProcessing || step === "confirmed"}
                        />
                        {option && (
                          <p className="text-[11px] text-text-tertiary">
                            Matches preset merchant: {option.label}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Expiry */}
          <div className="max-w-[240px]">
            <Input
              label="How long these rules stay active"
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
                      : "Save rules on-chain"}
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
          counterparties={selectedCounterparties}
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
