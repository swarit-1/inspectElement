"use client";

import { useState } from "react";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { ProgressRail } from "@/components/ui/loading";
import { useToast } from "@/components/ui/toast";
import { CONTRACT_ADDRESSES, USE_MOCKS, truncateAddress } from "@/lib/constants";
import { useDemoRuntimeConfig } from "@/hooks/use-demo-runtime-config";
import { guardedExecutorAbi } from "@/abi/guarded-executor";
import { config } from "@/lib/wagmi";
import type { Address, Hex } from "viem";

interface AgentDelegateProps {
  onDelegated: () => void;
}

type Step = "idle" | "signing" | "confirming" | "confirmed" | "failed";

const DEFAULT_AGENT =
  process.env.NEXT_PUBLIC_DEFAULT_AGENT_ID ??
  "0x00000000000000000000000000000000000000000000000000000000deadbeef";
const DEFAULT_DELEGATE = process.env.NEXT_PUBLIC_DEFAULT_DELEGATE ?? "";

const STEPS = [
  { id: "sign", label: "Sign" },
  { id: "confirm", label: "Confirm" },
  { id: "live", label: "Live" },
];

export function AgentDelegate({ onDelegated }: AgentDelegateProps) {
  const { toast } = useToast();
  const { data: runtimeConfig, isLoading: isRuntimeConfigLoading, error: runtimeConfigError } =
    useDemoRuntimeConfig();
  const [agentIdInput, setAgentIdInput] = useState<string | null>(null);
  const [delegateInput, setDelegateInput] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);

  const { writeContractAsync } = useWriteContract();
  const agentId = agentIdInput ?? runtimeConfig?.agentId ?? DEFAULT_AGENT;
  const delegate =
    delegateInput ?? runtimeConfig?.operatorAddress ?? DEFAULT_DELEGATE;

  async function handleDelegate() {
    if (!agentId || !delegate) return;
    setError(null);
    setTxHash(undefined);

    if (USE_MOCKS) {
      setStep("confirming");
      setTimeout(() => {
        setStep("confirmed");
        onDelegated();
        toast({
          variant: "success",
          title: "Delegate authorized",
          description: `Agent key linked to ${truncateAddress(delegate, 6)}.`,
        });
      }, 900);
      return;
    }

    let phase: Step = "signing";
    try {
      setStep("signing");
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.guardedExecutor,
        abi: guardedExecutorAbi,
        functionName: "setAgentDelegate",
        args: [agentId as Hex, delegate as Address, true],
      });
      setTxHash(hash);
      phase = "confirming";
      setStep("confirming");
      await waitForTransactionReceipt(config, { hash });
      setStep("confirmed");
      onDelegated();
      toast({
        variant: "success",
        title: "Delegate authorized",
        description: `On-chain ACL updated · ${truncateAddress(delegate, 6)}`,
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
        title: phase === "confirming" ? "Delegate revert" : "Signature rejected",
        description: msg,
      });
    }
  }

  const isProcessing = step === "signing" || step === "confirming";

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
      kicker="Step III · Authorization"
      title="Delegate agent key"
      subtitle="Authorize the server wallet signer to invoke executePayment on your behalf"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-x-12 gap-y-6 max-w-[820px]">
        <div className="flex flex-col gap-5">
          <Input
            label="Agent ID (bytes32)"
            value={agentId}
            onChange={(e) => setAgentIdInput(e.target.value)}
            placeholder="0x…"
            className="font-mono text-[12px]"
            disabled={isProcessing || step === "confirmed"}
          />
          <Input
            label="Delegate address"
            value={delegate}
            onChange={(e) => setDelegateInput(e.target.value)}
            placeholder="0x… (agent's signing key)"
            className="font-mono text-[12px]"
            disabled={isProcessing || step === "confirmed"}
          />

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
              onClick={handleDelegate}
              loading={isProcessing}
              disabled={
                isProcessing || step === "confirmed" || !agentId || !delegate
              }
            >
              {step === "signing"
                ? "Awaiting signature…"
                : step === "confirming"
                  ? "Awaiting confirmation…"
                  : step === "confirmed"
                    ? "✓ Delegate authorized"
                    : "Approve delegate"}
            </Button>
            {step === "confirmed" && (
              <span className="font-mono text-[12px] tnum text-success">
                ● On-chain ACL updated
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

        {/* Side note — what this does */}
        <aside className="flex flex-col gap-3 text-[12px] text-text-tertiary leading-relaxed max-w-[40ch]">
          <div className="eyebrow text-text-secondary">What this does</div>
          {runtimeConfig && (
            <p>
              Runtime config resolved live:{" "}
              <code className="font-mono text-text-secondary">
                {runtimeConfig.signerProvider}
              </code>{" "}
              signer at{" "}
              <code className="font-mono text-text-secondary">
                {truncateAddress(runtimeConfig.operatorAddress, 6)}
              </code>
              .
            </p>
          )}
          {!USE_MOCKS && isRuntimeConfigLoading && (
            <p>Loading operator and agent defaults from the runtime…</p>
          )}
          {!USE_MOCKS && runtimeConfigError && (
            <p>
              Live runtime defaults are unavailable right now. You can still
              paste the agent id and delegate manually.
            </p>
          )}
          <p>
            Sets{" "}
            <code className="font-mono text-text-secondary">
              agentDelegates[agentId][delegate] = true
            </code>{" "}
            on the GuardedExecutor. Only this address can submit payment intents
            for this agent.
          </p>
          <p>
            Revoke at any time by calling the same function with{" "}
            <code className="font-mono text-text-secondary">
              authorized = false
            </code>
            .
          </p>
        </aside>
      </div>
    </Section>
  );
}

function stepLabel(step: Step, tx: Hex | undefined): string {
  switch (step) {
    case "signing":
      return "Open your wallet and sign setAgentDelegate.";
    case "confirming":
      return tx
        ? `Awaiting receipt for tx ${truncateAddress(tx, 6)}…`
        : "Awaiting on-chain confirmation…";
    case "confirmed":
      return "ACL is live. Agent may now call executePayment.";
    case "failed":
      return "Authorization failed. Review and retry.";
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
  if (lower.includes("insufficient funds")) {
    return "Insufficient gas — top up the signer's ETH on Base Sepolia.";
  }
  if (lower.length > 180) return lower.slice(0, 180) + "…";
  return msg || "Transaction failed.";
}
