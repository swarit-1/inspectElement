"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { CONTRACT_ADDRESSES } from "@/lib/constants";
import { guardedExecutorAbi } from "@/abi/guarded-executor";
import type { Address, Hex } from "viem";

interface AgentDelegateProps {
  onDelegated: () => void;
}

const DEFAULT_AGENT =
  process.env.NEXT_PUBLIC_DEFAULT_AGENT_ID ??
  "0x00000000000000000000000000000000000000000000000000000000deadbeef";
const DEFAULT_DELEGATE = process.env.NEXT_PUBLIC_DEFAULT_DELEGATE ?? "";

export function AgentDelegate({ onDelegated }: AgentDelegateProps) {
  const [agentId, setAgentId] = useState(DEFAULT_AGENT);
  const [delegate, setDelegate] = useState(DEFAULT_DELEGATE);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  function handleDelegate() {
    if (!agentId || !delegate) return;
    setError(null);

    writeContract(
      {
        address: CONTRACT_ADDRESSES.guardedExecutor,
        abi: guardedExecutorAbi,
        functionName: "setAgentDelegate",
        args: [agentId as Hex, delegate as Address, true],
      },
      {
        onSuccess: () => {
          setIsDone(true);
          onDelegated();
        },
        onError: (err) => setError(err.message),
      }
    );
  }

  const isProcessing = isPending || isConfirming;

  return (
    <Section
      index="02"
      kicker="Authorization"
      title="Delegate agent key"
      subtitle="Authorize a signing key to invoke executePayment on your behalf"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-x-12 gap-y-6 max-w-[820px]">
        <div className="flex flex-col gap-5">
          <Input
            label="Agent ID (bytes32)"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="0x…"
            className="font-mono text-[12px]"
          />
          <Input
            label="Delegate address"
            value={delegate}
            onChange={(e) => setDelegate(e.target.value)}
            placeholder="0x… (agent's signing key)"
            className="font-mono text-[12px]"
          />

          {error && (
            <div className="text-[12px] text-danger font-mono tnum hairline-top pt-3">
              ✕ {error}
            </div>
          )}

          <div className="flex items-center gap-4 pt-2">
            <Button
              size="lg"
              onClick={handleDelegate}
              loading={isProcessing}
              disabled={isProcessing || isDone || !agentId || !delegate}
            >
              {isDone ? "✓ Delegate authorized" : "Approve delegate"}
            </Button>
            {isDone && (
              <span className="font-mono text-[12px] tnum text-success">
                ● On-chain ACL updated
              </span>
            )}
          </div>
        </div>

        {/* Side note — what this does */}
        <aside className="flex flex-col gap-3 text-[12px] text-text-tertiary leading-relaxed max-w-[40ch]">
          <div className="eyebrow text-text-secondary">What this does</div>
          <p>
            Sets <code className="font-mono text-text-secondary">agentDelegates[agentId][delegate] = true</code> on
            the GuardedExecutor. Only this address can submit payment intents
            for this agent.
          </p>
          <p>
            Revoke at any time by calling the same function with{" "}
            <code className="font-mono text-text-secondary">authorized = false</code>.
          </p>
        </aside>
      </div>
    </Section>
  );
}
