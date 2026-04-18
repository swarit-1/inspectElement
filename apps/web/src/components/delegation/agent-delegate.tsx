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
      title="Delegate Agent"
      subtitle="Authorize an agent key to execute guarded payments"
    >
      <div className="bg-bg-surface border border-border rounded-[--radius-lg] p-5 flex flex-col gap-4 max-w-xl">
        <Input
          label="Agent ID"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="0x... (bytes32)"
          className="font-mono text-xs"
        />
        <Input
          label="Delegate Address"
          value={delegate}
          onChange={(e) => setDelegate(e.target.value)}
          placeholder="0x... (agent's signing key)"
          className="font-mono text-xs"
        />

        {error && (
          <p className="text-sm text-danger bg-danger-dim rounded-[--radius-md] px-3 py-2">
            {error}
          </p>
        )}

        <Button
          onClick={handleDelegate}
          loading={isProcessing}
          disabled={isProcessing || isDone || !agentId || !delegate}
        >
          {isDone ? "Agent delegated" : "Approve Delegate"}
        </Button>
      </div>
    </Section>
  );
}
