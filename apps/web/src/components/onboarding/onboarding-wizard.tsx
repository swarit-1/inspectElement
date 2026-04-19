"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import {
  useAccount,
  useChainId,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { WizardStepper, type WizardStep } from "@/components/ui/wizard-stepper";
import { Button } from "@/components/ui/button";
import { IntentBuilder } from "@/components/intent/intent-builder";
import { OwnerSpendApproval } from "@/components/approval/owner-spend-approval";
import { AgentDelegate } from "@/components/delegation/agent-delegate";
import {
  ONBOARDING_STEP_ORDER,
  useOnboardingProgress,
  type OnboardingStepId,
  type StepProgress,
} from "@/hooks/use-onboarding-progress";
import { CHAIN_ID, truncateAddress } from "@/lib/constants";
import { easeOutExpo } from "@/lib/motion";

const FLAGS_STORAGE_KEY = "intentguard.onboarding.flags.v1";

interface Flags {
  policyCommitted: boolean;
  ownerApproved: boolean;
  delegated: boolean;
  firstRunDone: boolean;
}

const DEFAULT_FLAGS: Flags = {
  policyCommitted: false,
  ownerApproved: false,
  delegated: false,
  firstRunDone: false,
};

const STEP_LABELS: Record<OnboardingStepId, string> = {
  wallet: "Connect wallet",
  network: "Select network",
  policy: "Commit policy",
  delegate: "Delegate agent",
  "first-run": "First run",
};

const STEP_CAPTIONS: Record<OnboardingStepId, string> = {
  wallet: "Authenticate and attach a wallet.",
  network: "Base Sepolia is the only supported chain.",
  policy: "Pin an intent manifest and commit it on-chain.",
  delegate: "Authorize an agent key, approve the spend allowance.",
  "first-run": "Watch the first scenario run end-to-end.",
};

export function OnboardingWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const [flags, setFlags] = useState<Flags>(DEFAULT_FLAGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FLAGS_STORAGE_KEY);
      if (raw) setFlags({ ...DEFAULT_FLAGS, ...JSON.parse(raw) });
    } catch {}
    setHydrated(true);
  }, []);

  const persistFlags = useCallback((next: Flags) => {
    setFlags(next);
    try {
      localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const progress = useOnboardingProgress({
    policyCommitted: flags.policyCommitted,
    delegated: flags.delegated,
    firstRunDone: flags.firstRunDone,
  });

  const requestedStep = params.get("step") as OnboardingStepId | null;
  const activeStep: OnboardingStepId =
    requestedStep && ONBOARDING_STEP_ORDER.includes(requestedStep)
      ? requestedStep
      : progress.firstIncomplete;

  const goTo = useCallback(
    (id: OnboardingStepId) => {
      router.replace(`/onboarding?step=${id}`, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    if (!hydrated) return;
    if (!requestedStep) {
      router.replace(`/onboarding?step=${progress.firstIncomplete}`, {
        scroll: false,
      });
    }
  }, [hydrated, requestedStep, progress.firstIncomplete, router]);

  const steps: WizardStep[] = useMemo(
    () =>
      ONBOARDING_STEP_ORDER.map((id, i) => {
        const base: StepProgress = progress.stepStates[id];
        const state: StepProgress =
          base === "complete"
            ? "complete"
            : id === activeStep
              ? "active"
              : base;
        return {
          id,
          index: i + 1,
          label: STEP_LABELS[id],
          caption: STEP_CAPTIONS[id],
          state,
        };
      }),
    [activeStep, progress.stepStates],
  );

  const clickableSteps = useMemo(() => {
    const set = new Set<string>();
    for (const s of steps) {
      if (s.state === "complete" || s.state === "active") set.add(s.id);
    }
    return set;
  }, [steps]);

  const enterDashboard = () => router.push("/dashboard");

  return (
    <div className="relative min-h-screen bg-bg-root">
      <BackdropGrid />
      <div className="relative z-10 max-w-[1080px] mx-auto px-6 md:px-10 py-10">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, ease: easeOutExpo }}
          className="flex items-center justify-between mb-10"
        >
          <Link href="/" className="flex items-baseline gap-1.5">
            <VaultMark />
            <span
              className="font-display font-semibold tracking-tight text-accent leading-none"
              style={{ fontSize: "14px" }}
            >
              VAULT
            </span>
          </Link>
          <div className="flex items-center gap-5">
            <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-tertiary">
              onboarding · {progress.percentComplete}%
            </span>
            {progress.isFullyConfigured && (
              <Button size="sm" onClick={enterDashboard}>
                Enter dashboard →
              </Button>
            )}
          </div>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.52, ease: easeOutExpo, delay: 0.1 }}
          className="flex flex-col gap-3 mb-8"
        >
          <div className="flex items-center gap-3">
            <span className="seq tabular-nums text-accent">02 / SET UP</span>
            <span className="h-px w-12 bg-rule" />
          </div>
          <h1
            className="font-display font-semibold tracking-tight text-text-primary"
            style={{
              fontSize: "clamp(36px, 5.2vw, 60px)",
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
            }}
          >
            Arm the vault in five steps.
          </h1>
          <p
            className="text-text-secondary max-w-[56ch]"
            style={{ fontSize: "var(--t-md)", lineHeight: 1.55 }}
          >
            Each step confirms one guarantee: you&apos;re in, you&apos;re on the
            right chain, the envelope is signed, the agent is authorized, the
            loop works end-to-end.
          </p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-[300px_1fr] items-start">
          <div className="hairline-top hairline-bottom">
            <WizardStepper
              steps={steps}
              orientation="vertical"
              onSelect={(id) => {
                if (clickableSteps.has(id)) goTo(id as OnboardingStepId);
              }}
            />
          </div>

          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.42, ease: easeOutExpo }}
                className="hairline-top hairline-bottom"
              >
                <StepSurface
                  step={activeStep}
                  flags={flags}
                  onFlagsChange={persistFlags}
                  onAdvance={(next) => goTo(next)}
                  onEnterDashboard={enterDashboard}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepSurface({
  step,
  flags,
  onFlagsChange,
  onAdvance,
  onEnterDashboard,
}: {
  step: OnboardingStepId;
  flags: Flags;
  onFlagsChange: (f: Flags) => void;
  onAdvance: (next: OnboardingStepId) => void;
  onEnterDashboard: () => void;
}) {
  switch (step) {
    case "wallet":
      return <StepWallet onAdvance={() => onAdvance("network")} />;
    case "network":
      return <StepNetwork onAdvance={() => onAdvance("policy")} />;
    case "policy":
      return (
        <StepPolicy
          flags={flags}
          onFlagsChange={onFlagsChange}
          onAdvance={() => onAdvance("delegate")}
        />
      );
    case "delegate":
      return (
        <StepDelegate
          flags={flags}
          onFlagsChange={onFlagsChange}
          onAdvance={() => onAdvance("first-run")}
        />
      );
    case "first-run":
      return (
        <StepFirstRun
          flags={flags}
          onFlagsChange={onFlagsChange}
          onEnterDashboard={onEnterDashboard}
        />
      );
    default:
      return null;
  }
}

function StepShell({
  kicker,
  title,
  body,
  children,
}: {
  kicker: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <span className="eyebrow text-accent">{kicker}</span>
        <h2
          className="font-display font-semibold tracking-tight text-text-primary"
          style={{
            fontSize: "clamp(26px, 3.4vw, 36px)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h2>
        <p
          className="text-text-secondary max-w-[60ch]"
          style={{ fontSize: "14px", lineHeight: 1.6 }}
        >
          {body}
        </p>
      </div>
      <div className="hairline-top pt-6">{children}</div>
    </div>
  );
}

function StepWallet({ onAdvance }: { onAdvance: () => void }) {
  const { authenticated, login, logout, connectWallet, ready } = usePrivy();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (authenticated && isConnected) onAdvance();
  }, [authenticated, isConnected, onAdvance]);

  return (
    <StepShell
      kicker="Step 01"
      title="Attach the owner wallet."
      body="The wallet you connect now will own every policy you commit next. You can link additional wallets later from the dashboard."
    >
      {!authenticated ? (
        <div className="flex items-center gap-5 flex-wrap">
          <Button size="lg" onClick={() => login()} loading={!ready}>
            {ready ? "Sign in →" : "Loading…"}
          </Button>
          <span className="font-mono text-[11px] tnum text-text-tertiary">
            Email or wallet · Privy
          </span>
        </div>
      ) : !isConnected ? (
        <div className="flex items-center gap-5 flex-wrap">
          <Button size="lg" onClick={() => connectWallet()}>
            Connect wallet →
          </Button>
          <button
            type="button"
            onClick={() => void logout()}
            className="font-mono text-[11px] tnum text-text-tertiary hover:text-text-primary underline-offset-4 hover:underline cursor-pointer"
          >
            sign out
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-5 flex-wrap">
          <span
            className="inline-flex items-center gap-2 font-mono text-[11px] tnum tracking-wider uppercase"
            style={{ color: "var(--status-success)" }}
          >
            <span
              aria-hidden
              className="led-pulse block"
              style={{
                width: 6,
                height: 6,
                background: "var(--status-success)",
              }}
            />
            connected · {address ? truncateAddress(address, 6) : ""}
          </span>
          <button
            type="button"
            onClick={() => {
              disconnect();
              void logout();
            }}
            className="font-mono text-[11px] tnum text-text-tertiary hover:text-text-primary underline-offset-4 hover:underline cursor-pointer"
          >
            disconnect
          </button>
        </div>
      )}
    </StepShell>
  );
}

function StepNetwork({ onAdvance }: { onAdvance: () => void }) {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const { isConnected } = useAccount();
  const correct = isConnected && chainId === CHAIN_ID;

  useEffect(() => {
    if (correct) onAdvance();
  }, [correct, onAdvance]);

  return (
    <StepShell
      kicker="Step 02"
      title="Switch to Base Sepolia."
      body="All Vault contracts live on Base Sepolia (chain 84532). Your wallet will prompt you to add or switch; approve once."
    >
      <div className="flex items-center gap-5 flex-wrap">
        {!isConnected ? (
          <span className="font-mono text-[11.5px] tnum text-text-tertiary">
            Connect a wallet first.
          </span>
        ) : correct ? (
          <span
            className="inline-flex items-center gap-2 font-mono text-[11px] tnum tracking-wider uppercase"
            style={{ color: "var(--status-success)" }}
          >
            <span
              aria-hidden
              className="block"
              style={{
                width: 6,
                height: 6,
                background: "var(--status-success)",
              }}
            />
            Base Sepolia · {CHAIN_ID}
          </span>
        ) : (
          <>
            <Button
              size="lg"
              onClick={() => switchChain({ chainId: CHAIN_ID })}
              loading={isPending}
              variant="secondary"
            >
              {isPending ? "Switching…" : "Switch network →"}
            </Button>
            <span className="font-mono text-[11px] tnum text-warning">
              Current · {chainId}
            </span>
          </>
        )}
      </div>
    </StepShell>
  );
}

function StepPolicy({
  flags,
  onFlagsChange,
  onAdvance,
}: {
  flags: Flags;
  onFlagsChange: (f: Flags) => void;
  onAdvance: () => void;
}) {
  return (
    <StepShell
      kicker="Step 03"
      title="Commit the spend policy."
      body="Pin the manifest to storage and register the intent hash on-chain. Approve the executor's spending allowance for USDC."
    >
      <div className="flex flex-col gap-10">
        <IntentBuilder
          onCommitted={() =>
            onFlagsChange({ ...flags, policyCommitted: true })
          }
        />
        {flags.policyCommitted && (
          <OwnerSpendApproval
            onApproved={() => onFlagsChange({ ...flags, ownerApproved: true })}
          />
        )}
        {flags.policyCommitted && flags.ownerApproved && (
          <div className="hairline-top pt-6 flex items-center gap-5 flex-wrap">
            <Button size="md" onClick={onAdvance}>
              Continue · Delegate agent →
            </Button>
          </div>
        )}
      </div>
    </StepShell>
  );
}

function StepDelegate({
  flags,
  onFlagsChange,
  onAdvance,
}: {
  flags: Flags;
  onFlagsChange: (f: Flags) => void;
  onAdvance: () => void;
}) {
  return (
    <StepShell
      kicker="Step 04"
      title="Delegate the agent key."
      body="Authorize a single signing key for the agent runtime. The delegation is stake-backed and revocable from the dashboard at any time."
    >
      <div className="flex flex-col gap-8">
        <AgentDelegate
          onDelegated={() => onFlagsChange({ ...flags, delegated: true })}
        />
        {flags.delegated && (
          <div className="hairline-top pt-6 flex items-center gap-5 flex-wrap">
            <Button size="md" onClick={onAdvance}>
              Continue · First run →
            </Button>
          </div>
        )}
      </div>
    </StepShell>
  );
}

function StepFirstRun({
  flags,
  onFlagsChange,
  onEnterDashboard,
}: {
  flags: Flags;
  onFlagsChange: (f: Flags) => void;
  onEnterDashboard: () => void;
}) {
  return (
    <StepShell
      kicker="Step 05"
      title="Run the loop end-to-end."
      body="The theater plays three scripted scenarios so you can verify the policy, guard, and receipt path behave exactly like the spec. Mark it seen to finish onboarding."
    >
      <div className="flex flex-col gap-6">
        <div className="grid md:grid-cols-3 gap-0 hairline-top hairline-bottom">
          <MiniScenario
            seq="S-01"
            label="Legit payment"
            tone="success"
            detail="2.0 USDC passes all checks, receipt minted."
          />
          <MiniScenario
            seq="S-02"
            label="Blocked attack"
            tone="danger"
            detail="20.0 USDC to unknown target, guard rejects pre-exec."
          />
          <MiniScenario
            seq="S-03"
            label="Overspend"
            tone="warning"
            detail="15.0 USDC past cap, receipt becomes challengeable."
          />
        </div>
        <div className="hairline-top pt-6 flex items-center gap-5 flex-wrap">
          <Link
            href="/theater"
            className="inline-flex items-center gap-2 font-mono text-[12px] tnum tracking-wider uppercase text-accent hover:text-accent-bright underline-offset-4 hover:underline"
          >
            open theater →
          </Link>
          <Button
            size="md"
            variant={flags.firstRunDone ? "primary" : "secondary"}
            onClick={() => {
              onFlagsChange({ ...flags, firstRunDone: true });
              onEnterDashboard();
            }}
          >
            {flags.firstRunDone
              ? "Enter dashboard →"
              : "Mark as seen · Enter dashboard"}
          </Button>
        </div>
      </div>
    </StepShell>
  );
}

function MiniScenario({
  seq,
  label,
  detail,
  tone,
}: {
  seq: string;
  label: string;
  detail: string;
  tone: "success" | "warning" | "danger";
}) {
  const color =
    tone === "danger"
      ? "var(--status-danger)"
      : tone === "warning"
        ? "var(--status-warning)"
        : "var(--status-success)";
  return (
    <div className="flex flex-col gap-2 p-5 hairline-bottom md:border-b-0 md:border-r md:border-rule-subtle last:border-r-0 last:border-b-0">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat">
          {seq}
        </span>
        <span
          aria-hidden
          className="block"
          style={{ width: 6, height: 6, background: color }}
        />
      </div>
      <div
        className="font-display font-medium text-text-primary tracking-tight"
        style={{ fontSize: "15px" }}
      >
        {label}
      </div>
      <p className="text-[12px] text-text-tertiary leading-relaxed">{detail}</p>
    </div>
  );
}

function BackdropGrid() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none opacity-[0.07]"
      style={{
        backgroundImage:
          "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
        backgroundSize: "72px 72px",
        color: "var(--text-tertiary)",
        maskImage:
          "radial-gradient(ellipse at 50% 20%, #000 0%, #000 50%, transparent 100%)",
      }}
    />
  );
}

function VaultMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="1"
        y="1"
        width="14"
        height="14"
        stroke="currentColor"
        strokeWidth="1"
        className="text-accent"
      />
      <rect
        x="4.5"
        y="4.5"
        width="7"
        height="7"
        transform="rotate(45 8 8)"
        fill="currentColor"
        className="text-accent"
      />
    </svg>
  );
}
