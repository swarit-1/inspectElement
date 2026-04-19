"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { Button } from "@/components/ui/button";
import { truncateAddress } from "@/lib/constants";
import type { OnboardingStep } from "@/lib/types";

interface WalletConnectProps {
  step: OnboardingStep;
  onStepChange: (step: OnboardingStep) => void;
}

export function WalletConnect({ step, onStepChange }: WalletConnectProps) {
  const { address, isConnected } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  function handleConnect() {
    connect(
      { connector: injected() },
      { onSuccess: () => onStepChange("deployed") }
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex flex-col gap-7">
        <ConnectedKey address={address} onDisconnect={() => disconnect()} />
        <GuardStatus step={step} onStepChange={onStepChange} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      {/* Brand stamp + tagline — left-aligned editorial */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="seq tabular-nums">00 / IDENTIFY</span>
          <span className="h-px flex-1 bg-rule" />
        </div>

        <div>
          <h1
            className="font-display font-semibold tracking-tight text-text-primary leading-[0.95]"
            style={{ fontSize: "var(--t-4xl)" }}
          >
            Intent
            <span className="text-accent">Guard</span>
          </h1>
          <p
            className="mt-5 text-text-secondary leading-relaxed max-w-[42ch]"
            style={{ fontSize: "var(--t-md)" }}
          >
            A vault door between your USDC and an autonomous agent. Set the
            spend envelope, monitor every action, dispute what shouldn&apos;t
            have happened.
          </p>
        </div>
      </div>

      {/* Three pillars — flat, no cards */}
      <ul className="flex flex-col">
        <Pillar
          seq="01"
          name="Commit intent"
          desc="Per-tx and per-day caps, allowed counterparties, expiry. Pinned and signed."
        />
        <Pillar
          seq="02"
          name="Delegate agent"
          desc="Authorize a single signing key. Revoke at will. Stake-backed."
        />
        <Pillar
          seq="03"
          name="Recourse"
          desc="Every overspend is challengeable. Operator stake covers the difference."
        />
      </ul>

      {/* Action bar */}
      <div className="flex items-center gap-5 hairline-top pt-6">
        <Button size="lg" onClick={handleConnect} loading={isConnecting}>
          Connect wallet →
        </Button>
        <span className="font-mono text-[11px] tnum text-text-tertiary">
          Base Sepolia · injected wallet
        </span>
      </div>
    </div>
  );
}

function Pillar({ seq, name, desc }: { seq: string; name: string; desc: string }) {
  return (
    <li className="grid grid-cols-[40px_140px_1fr] gap-x-5 py-4 hairline-bottom border-rule-subtle items-baseline">
      <span className="seq tabular-nums">{seq}</span>
      <span
        className="font-display font-semibold text-text-primary tracking-tight"
        style={{ fontSize: "var(--t-md)" }}
      >
        {name}
      </span>
      <span className="text-[13px] text-text-tertiary leading-relaxed max-w-[60ch]">
        {desc}
      </span>
    </li>
  );
}

function ConnectedKey({
  address,
  onDisconnect,
}: {
  address: string;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex items-end justify-between hairline-bottom pb-5">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="led-pulse h-1.5 w-1.5 rounded-full bg-success" />
          <span className="eyebrow text-success">Wallet connected</span>
        </div>
        <div
          className="font-mono tnum text-text-primary"
          style={{ fontSize: "var(--t-lg)" }}
        >
          {truncateAddress(address, 6)}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onDisconnect}>
        Disconnect
      </Button>
    </div>
  );
}

function GuardStatus({
  step,
  onStepChange,
}: {
  step: OnboardingStep;
  onStepChange: (s: OnboardingStep) => void;
}) {
  const isDeployed = step !== "connect" && step !== "deploying";

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">GuardedExecutor module</span>
        <div className="flex items-center gap-3">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isDeployed ? "bg-success led-pulse" : "bg-warning"
            }`}
          />
          <span
            className="font-display font-semibold tracking-tight text-text-primary"
            style={{ fontSize: "var(--t-md)" }}
          >
            {isDeployed ? "Active on smart account" : "Not deployed"}
          </span>
        </div>
      </div>
      {!isDeployed && (
        <Button
          size="md"
          onClick={() => {
            onStepChange("deploying");
            setTimeout(() => onStepChange("deployed"), 2000);
          }}
        >
          Deploy module
        </Button>
      )}
    </div>
  );
}
