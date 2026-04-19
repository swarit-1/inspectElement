"use client";

import { useAccount, useConnect, useConnectors, useDisconnect } from "wagmi";
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
  const connectors = useConnectors();
  const { connect, isPending: isConnecting, error: connectError, reset } =
    useConnect();
  const { disconnect } = useDisconnect();

  function handleConnect() {
    reset();
    const connector =
      connectors.find((c) => c.id === "injected" || c.type === "injected") ??
      connectors[0] ??
      injected();
    connect(
      { connector },
      { onSuccess: () => onStepChange("deployed") }
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between bg-bg-surface border border-border rounded-[--radius-lg] p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success-dim flex items-center justify-center">
              <CheckIcon className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">
                Wallet Connected
              </p>
              <p className="text-xs text-text-secondary font-mono">
                {truncateAddress(address, 6)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => disconnect()}>
            Disconnect
          </Button>
        </div>

        <GuardStatus step={step} onStepChange={onStepChange} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8 py-16">
      <div className="flex flex-col items-center gap-3 text-center max-w-md">
        <div className="w-16 h-16 rounded-[--radius-lg] bg-accent-subtle flex items-center justify-center mb-2">
          <ShieldIcon className="w-8 h-8 text-accent" />
        </div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          IntentGuard
        </h1>
        <p className="text-text-secondary text-sm leading-relaxed">
          Guard-and-recourse layer for AI agents that move USDC.
          Connect your wallet to set agent constraints, monitor activity,
          and file disputes.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 w-full max-w-sm">
        <Button size="lg" onClick={handleConnect} loading={isConnecting}>
          Connect Wallet
        </Button>
        {connectError ? (
          <p className="text-xs text-danger text-center leading-relaxed">
            {String(connectError.name) === "ProviderNotFoundError"
              ? "No wallet found. Install a browser wallet (e.g. MetaMask) or enable this site in your wallet."
              : connectError.message}
          </p>
        ) : null}
      </div>
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
    <div className="bg-bg-surface border border-border rounded-[--radius-lg] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isDeployed ? "bg-success-dim" : "bg-warning-dim"
            }`}
          >
            {isDeployed ? (
              <CheckIcon className="w-5 h-5 text-success" />
            ) : (
              <ClockIcon className="w-5 h-5 text-warning" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">
              GuardedExecutor
            </p>
            <p className="text-xs text-text-secondary">
              {isDeployed
                ? "Active on smart account"
                : "Not deployed yet"}
            </p>
          </div>
        </div>
        {!isDeployed && (
          <Button
            size="sm"
            onClick={() => {
              onStepChange("deploying");
              setTimeout(() => onStepChange("deployed"), 2000);
            }}
          >
            Deploy
          </Button>
        )}
      </div>
    </div>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  );
}
