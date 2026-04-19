"use client";

import { useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { CHAIN_ID } from "@/lib/constants";

export type OnboardingStepId =
  | "wallet"
  | "network"
  | "policy"
  | "delegate"
  | "first-run";

export type StepProgress = "locked" | "active" | "complete" | "blocked";

export interface OnboardingProgressSnapshot {
  stepStates: Record<OnboardingStepId, StepProgress>;
  firstIncomplete: OnboardingStepId;
  percentComplete: number;
  walletReady: boolean;
  networkReady: boolean;
  isFullyConfigured: boolean;
}

const STEP_ORDER: OnboardingStepId[] = [
  "wallet",
  "network",
  "policy",
  "delegate",
  "first-run",
];

/**
 * Derives onboarding progress from observable wallet/network state plus
 * opt-in flags the wizard stores via `localStorage` for steps we can't
 * otherwise read on-chain without a dedicated indexer query. The flags are
 * wizard-scoped — production completion is authoritative at protocol level.
 */
export function useOnboardingProgress(flags: {
  policyCommitted: boolean;
  delegated: boolean;
  firstRunDone: boolean;
}): OnboardingProgressSnapshot {
  const { authenticated } = usePrivy();
  const { isConnected } = useAccount();
  const chainId = useChainId();

  return useMemo(() => {
    const walletReady = authenticated && isConnected;
    const networkReady = walletReady && chainId === CHAIN_ID;
    const wrongNetwork = walletReady && chainId !== CHAIN_ID;

    const stepStates: Record<OnboardingStepId, StepProgress> = {
      wallet: walletReady ? "complete" : "active",
      network: !walletReady
        ? "locked"
        : wrongNetwork
          ? "blocked"
          : "complete",
      policy: !networkReady
        ? "locked"
        : flags.policyCommitted
          ? "complete"
          : "active",
      delegate: !flags.policyCommitted
        ? "locked"
        : flags.delegated
          ? "complete"
          : "active",
      "first-run": !flags.delegated
        ? "locked"
        : flags.firstRunDone
          ? "complete"
          : "active",
    };

    const firstIncomplete =
      STEP_ORDER.find(
        (id) => stepStates[id] === "active" || stepStates[id] === "blocked",
      ) ?? "first-run";

    const completeCount = STEP_ORDER.filter(
      (id) => stepStates[id] === "complete",
    ).length;

    const percentComplete = Math.round(
      (completeCount / STEP_ORDER.length) * 100,
    );

    return {
      stepStates,
      firstIncomplete,
      percentComplete,
      walletReady,
      networkReady,
      isFullyConfigured: completeCount === STEP_ORDER.length,
    };
  }, [
    authenticated,
    isConnected,
    chainId,
    flags.policyCommitted,
    flags.delegated,
    flags.firstRunDone,
  ]);
}

export const ONBOARDING_STEP_ORDER = STEP_ORDER;
