"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { Hex } from "viem";
import { useToast } from "@/components/ui/toast";
import { Section } from "@/components/ui/section";
import { BeatIndicator } from "@/components/ui/beat-indicator";
import {
  EvidenceDrawer,
  EvidenceDrawerHandle,
} from "@/components/ui/evidence-drawer";
import { runDemoScenario, waitForDemoScenario } from "@/lib/api";
import { useDemoRuntimeConfig } from "@/hooks/use-demo-runtime-config";
import { appendScenarioToFeed, resetMockStore } from "@/mocks/mock-store";
import { USE_MOCKS, truncateAddress } from "@/lib/constants";
import type { DemoScenario, DemoStatus } from "@/lib/types";
import {
  useDemoVisualizer,
  type VisualizerState,
} from "@/components/demo/use-demo-visualizer";
import { TheaterStage } from "./theater-stage";
import { ScenarioRail, SCENARIOS } from "./scenario-rail";
import { DecisionPanel } from "./decision-panel";
import { PlaybackBar } from "./playback-bar";
import { buildEvidenceTabs } from "./evidence-content";
import { easeOutExpo } from "@/lib/motion";

let mockTxCounter = 1n;

interface ActiveRun {
  scenario: DemoScenario;
  runKey: number;
  isRunning: boolean;
  realResult: DemoStatus | null;
}

export function TheaterExperience() {
  const { address } = useAccount();
  const { data: runtimeConfig } = useDemoRuntimeConfig();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [active, setActive] = useState<ActiveRun | null>(null);
  const [viewMode, setViewMode] = useState<"story" | "evidence">("story");
  const drawerOpen = viewMode === "evidence";

  function handleViewModeChange(mode: "story" | "evidence") {
    setViewMode(mode);
  }

  function handleDrawerOpenChange(open: boolean) {
    setViewMode(open ? "evidence" : "story");
  }

  async function handleRun(scenario: DemoScenario) {
    if (!address && !USE_MOCKS) {
      toast({
        variant: "warning",
        title: "Wallet required",
        description: "Connect the owner wallet before running a live scenario.",
      });
      return;
    }

    const runKey = Date.now();
    setActive({ scenario, runKey, isRunning: true, realResult: null });

    try {
      if (USE_MOCKS) {
        await new Promise((r) => setTimeout(r, 2800));
        const { receiptId } = appendScenarioToFeed(scenario, address);
        const result: DemoStatus =
          scenario === "blocked"
            ? {
                scenario,
                status: "success",
                reasonCode: "COUNTERPARTY_NOT_ALLOWED",
              }
            : {
                scenario,
                status: "success",
                receiptId,
                txHash: nextMockTxHash(),
              };
        setActive((prev) =>
          prev && prev.runKey === runKey
            ? { ...prev, isRunning: false, realResult: result }
            : prev,
        );
        qc.invalidateQueries({ queryKey: ["feed"] });
        toast({
          variant:
            scenario === "blocked"
              ? "danger"
              : scenario === "overspend"
                ? "warning"
                : "success",
          title:
            scenario === "legit"
              ? "Payment executed"
              : scenario === "blocked"
                ? "Attempt blocked at guard"
                : "Overspend recorded · recourse available",
          description:
            scenario === "overspend" && receiptId
              ? "Open the receipt to file an AmountViolation challenge."
              : scenario === "legit"
                ? "2.0 USD → merchant · receipt added to the ledger."
                : "20.0 USD → non-allowlisted target · stablecoin never moved.",
          action:
            scenario === "overspend" && receiptId
              ? {
                  label: "Open receipt",
                  onClick: () =>
                    window.location.assign(`/receipt/${receiptId}`),
                }
              : undefined,
        });
        return;
      }
      const id = await runDemoScenario(scenario, address ?? undefined);
      const result = await waitForDemoScenario(scenario, id);
      setActive((prev) =>
        prev && prev.runKey === runKey
          ? { ...prev, isRunning: false, realResult: result }
          : prev,
      );
      qc.invalidateQueries({ queryKey: ["feed"] });
      if (result.status === "success") {
        toast({
          variant:
            scenario === "blocked"
              ? "danger"
              : scenario === "overspend"
                ? "warning"
                : "success",
          title:
            scenario === "legit"
              ? "Payment executed"
              : scenario === "blocked"
                ? "Attempt blocked at guard"
                : "Overspend recorded · recourse available",
          description: result.txHash
            ? `tx · ${truncateAddress(result.txHash, 6)}`
            : undefined,
        });
      } else if (result.status === "failed") {
        toast({
          variant: "danger",
          title: "Scenario failed",
          description: result.error ?? "Unknown error",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const failed: DemoStatus = { scenario, status: "failed", error: message };
      setActive((prev) =>
        prev && prev.runKey === runKey
          ? { ...prev, isRunning: false, realResult: failed }
          : prev,
      );
      toast({
        variant: "danger",
        title: "Scenario failed",
        description: message,
      });
    }
  }

  function handleReset() {
    if (!USE_MOCKS) return;
    resetMockStore();
    setActive(null);
    setViewMode("story");
    qc.invalidateQueries({ queryKey: ["feed"] });
    toast({
      variant: "info",
      title: "Theater reset",
      description: "Ledger cleared back to fixtures.",
    });
  }

  return (
    <Section
      kicker="Agent run theater"
      title="Watch the system decide"
      subtitle={
        USE_MOCKS
          ? "Three scripted scenarios play the agent-guard loop in-browser. Every beat is derived from the same policy the production guard enforces."
          : "Live scenarios against demo-control with the connected wallet as owner. Theater visualizes beats; terminal frame mirrors the real outcome."
      }
      action={
        <div className="flex items-center gap-4">
          {USE_MOCKS && (
            <button
              type="button"
              onClick={handleReset}
              className="font-mono text-[11px] tnum tracking-wider uppercase text-text-tertiary hover:text-accent underline-offset-4 hover:underline cursor-pointer"
            >
              ↻ Reset
            </button>
          )}
          <div className="font-mono text-[11px] tnum text-text-tertiary">
            runtime ·{" "}
            <span className="text-text-secondary">
              {USE_MOCKS ? "mock" : "live"}
            </span>
          </div>
          {!USE_MOCKS && address && (
            <div className="font-mono text-[11px] tnum text-text-tertiary">
              owner ·{" "}
              <span className="text-text-secondary">
                {truncateAddress(address, 6)}
              </span>
            </div>
          )}
          {!USE_MOCKS && runtimeConfig && (
            <div className="font-mono text-[11px] tnum text-text-tertiary">
              operator ·{" "}
              <span className="text-text-secondary">
                {truncateAddress(runtimeConfig.operatorAddress, 6)}
              </span>
            </div>
          )}
        </div>
      }
    >
      <div
        className="grid gap-0 lg:grid-cols-[260px_1fr] hairline-top hairline-bottom"
        data-theater-mode={viewMode}
      >
        <ScenarioRail
          activeId={active?.scenario ?? null}
          isRunning={!!active?.isRunning}
          onSelect={(id) => void handleRun(id)}
        />
        <div className="lg:border-l lg:border-rule min-w-0">
          <AnimatePresence mode="wait">
            {active ? (
              <ActiveTheater
                key={active.runKey}
                active={active}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                onRerun={() => void handleRun(active.scenario)}
                drawerOpen={drawerOpen}
                onDrawerOpenChange={handleDrawerOpenChange}
              />
            ) : (
              <EmptyTheater key="empty" />
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="hairline-top mt-5 pt-5 flex flex-col gap-2 text-[12px] text-text-tertiary leading-relaxed max-w-[64ch]">
        <span className="eyebrow text-text-secondary">Theater notes</span>
        <p>
          Intermediate beats are theatrical; the terminal frame mirrors the real
          result from {USE_MOCKS ? "the in-browser ledger" : "demo-control"}.
          Switch to <span className="text-text-primary">Evidence mode</span> to
          expose the trace, policy math, and raw payload underneath the stage.
        </p>
      </div>
    </Section>
  );
}

function ActiveTheater({
  active,
  viewMode,
  onViewModeChange,
  onRerun,
  drawerOpen,
  onDrawerOpenChange,
}: {
  active: ActiveRun;
  viewMode: "story" | "evidence";
  onViewModeChange: (m: "story" | "evidence") => void;
  onRerun: () => void;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
}) {
  const state = useDemoVisualizer({
    scenario: active.scenario,
    realResult: active.realResult,
    runKey: active.runKey,
    autoPlay: true,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: easeOutExpo }}
    >
      <TheaterBody
        active={active}
        state={state}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        onRerun={onRerun}
        drawerOpen={drawerOpen}
        onDrawerOpenChange={onDrawerOpenChange}
      />
      <EvidenceDockSlot
        active={active}
        state={state}
        open={drawerOpen}
        onOpenChange={onDrawerOpenChange}
      />
    </motion.div>
  );
}

function TheaterBody({
  active,
  state,
  viewMode,
  onViewModeChange,
  onRerun,
  drawerOpen,
  onDrawerOpenChange,
}: {
  active: ActiveRun;
  state: VisualizerState;
  viewMode: "story" | "evidence";
  onViewModeChange: (m: "story" | "evidence") => void;
  onRerun: () => void;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
}) {
  const { phase, phaseIndex, phases, mode, isTerminal, isHolding, controls } =
    state;

  const beats = useMemo(
    () =>
      phases.map((p) => ({
        id: p.id,
        label: p.label.split(" ")[0].toLowerCase(),
      })),
    [phases],
  );

  return (
    <div className="flex flex-col">
      {/* Beat rail */}
      <div className="px-5 pt-5 pb-4 hairline-bottom overflow-x-auto">
        <BeatIndicator beats={beats} activeIndex={phaseIndex} />
      </div>

      {/* Stage + right decision */}
      <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
        <div className="p-5 lg:p-6 lg:border-r lg:border-rule">
          <TheaterStage
            scenario={active.scenario}
            phase={phase}
            isTerminal={isTerminal}
            isHolding={isHolding}
            realResult={active.realResult}
          />
        </div>
        <DecisionPanel
          scenario={active.scenario}
          phase={phase}
          phaseIndex={phaseIndex}
          phases={phases}
          isTerminal={isTerminal}
          isHolding={isHolding}
          realResult={active.realResult}
          onReplayRun={onRerun}
        />
      </div>

      {/* Playback bar */}
      <PlaybackBar
        mode={mode}
        isTerminal={isTerminal}
        isHolding={isHolding}
        phaseIndex={phaseIndex}
        phaseCount={phases.length}
        phaseLabel={phase.label}
        onPlay={controls.resume}
        onPause={controls.pause}
        onStep={controls.step}
        onReplay={controls.replay}
        onRerun={onRerun}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />

      {/* Evidence handle */}
      <div className="px-5 py-3 flex items-center justify-between">
        <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat">
          {active.scenario} ·{" "}
          {SCENARIOS.find((s) => s.id === active.scenario)?.seq}
        </span>
        <EvidenceDrawerHandle
          open={drawerOpen}
          onClick={() => onDrawerOpenChange(!drawerOpen)}
          hint="Open evidence"
        />
      </div>
    </div>
  );
}

function EvidenceDockSlot({
  active,
  state,
  open,
  onOpenChange,
}: {
  active: ActiveRun;
  state: VisualizerState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tabs = useMemo(
    () =>
      buildEvidenceTabs({
        scenario: active.scenario,
        phases: state.phases,
        phaseIndex: state.phaseIndex,
        realResult: active.realResult,
      }),
    [active.scenario, active.realResult, state.phases, state.phaseIndex],
  );
  return (
    <EvidenceDrawer
      tabs={tabs}
      open={open}
      onOpenChange={onOpenChange}
      title="Evidence"
    />
  );
}

function EmptyTheater() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: easeOutExpo }}
      className="min-h-[360px] flex flex-col items-center justify-center gap-3 text-center px-6 py-12"
    >
      <span className="font-mono text-[10.5px] tnum tracking-[0.22em] uppercase text-text-quat">
        theater idle
      </span>
      <p className="text-[13px] text-text-tertiary max-w-[46ch]">
        Dispatch a scenario from the rail. The theater will stage each beat —
        owner → agent → guard → target → receipt — and settle on the real
        outcome.
      </p>
    </motion.div>
  );
}

function nextMockTxHash(): Hex {
  const value = mockTxCounter.toString(16).padStart(64, "0");
  mockTxCounter += 1n;
  return `0x${value}` as Hex;
}
