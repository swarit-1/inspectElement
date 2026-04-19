"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ONBOARDING_STEP_ORDER,
  type OnboardingProgressSnapshot,
  type OnboardingStepId,
} from "@/hooks/use-onboarding-progress";
import { easeStage } from "@/lib/motion";

const STEP_COPY: Record<OnboardingStepId, { title: string; body: string }> = {
  wallet: {
    title: "Connect owner wallet",
    body: "Sign in with the wallet that will own this agent's spend authority.",
  },
  network: {
    title: "Align to Base Sepolia",
    body: "Switch the connected wallet to the Base Sepolia test network.",
  },
  policy: {
    title: "Commit the intent manifest",
    body: "Pin the JSON manifest and approve stablecoin spend for the executor.",
  },
  delegate: {
    title: "Delegate the agent",
    body: "Authorize the agent to act on-chain under your committed policy.",
  },
  "first-run": {
    title: "Run the first scenario",
    body: "Watch the system decide against a legit S-01 payment end-to-end.",
  },
};

interface SetupCompletionProps {
  progress: OnboardingProgressSnapshot;
}

export function SetupCompletion({ progress }: SetupCompletionProps) {
  if (progress.isFullyConfigured) return null;

  const { stepStates, firstIncomplete, percentComplete } = progress;
  const resumeHref = `/onboarding?step=${firstIncomplete}`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.46, ease: easeStage }}
      className="relative overflow-hidden border border-rule bg-bg-surface"
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] bg-accent"
      />
      <div className="flex flex-col gap-8 p-8 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-col gap-2 min-w-0">
            <span className="eyebrow text-accent">Finish setup</span>
            <h2
              className="font-display font-semibold tracking-tight text-text-primary"
              style={{ fontSize: "var(--t-xl)", letterSpacing: "-0.02em" }}
            >
              The vault isn&apos;t armed yet.
            </h2>
            <p className="text-text-secondary max-w-xl">
              Complete the remaining steps to give your agent a policy to run
              under. Progress is saved between visits.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="font-mono text-[11px] tnum text-text-tertiary uppercase tracking-[0.22em]">
              {percentComplete}% complete
            </div>
            <Link href={resumeHref}>
              <Button variant="primary" size="md">
                Resume setup →
              </Button>
            </Link>
          </div>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-5 gap-px bg-rule-subtle hairline-top">
          {ONBOARDING_STEP_ORDER.map((id, idx) => {
            const state = stepStates[id];
            const isDone = state === "complete";
            const isActive = state === "active" || state === "blocked";
            return (
              <li
                key={id}
                className={`relative flex flex-col gap-3 p-5 bg-bg-surface ${
                  isActive ? "bg-bg-raised" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-[10px] tnum tracking-[0.2em] uppercase ${
                      isDone
                        ? "text-success"
                        : isActive
                          ? "text-accent"
                          : "text-text-quat"
                    }`}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${
                      isDone
                        ? "bg-success"
                        : isActive
                          ? "bg-accent led-pulse"
                          : "bg-text-quat"
                    }`}
                  />
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="text-[13px] text-text-primary font-medium">
                    {STEP_COPY[id].title}
                  </div>
                  <div className="text-[11.5px] text-text-tertiary leading-snug">
                    {STEP_COPY[id].body}
                  </div>
                </div>
                <div className="pt-1 mt-auto">
                  <span
                    className={`font-mono text-[10px] tracking-[0.18em] uppercase ${
                      isDone
                        ? "text-success"
                        : isActive
                          ? "text-accent"
                          : "text-text-quat"
                    }`}
                  >
                    {isDone
                      ? "Complete"
                      : isActive
                        ? state === "blocked"
                          ? "Blocked"
                          : "In progress"
                        : "Locked"}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </motion.section>
  );
}
