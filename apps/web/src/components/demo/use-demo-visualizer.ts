"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DemoScenario, DemoStatus } from "@/lib/types";
import {
  canLeaveHold,
  getPhases,
  getTerminalIndex,
  type Phase,
} from "./demo-visualizer";

export type TheaterMode = "idle" | "playing" | "paused" | "stepping" | "settled";

export interface VisualizerControls {
  play: () => void;
  pause: () => void;
  resume: () => void;
  step: () => void;
  replay: () => void;
}

export interface VisualizerState {
  scenario: DemoScenario;
  phases: Phase[];
  phaseIndex: number;
  phase: Phase;
  mode: TheaterMode;
  realResult: DemoStatus | null;
  /** True once the terminal phase is revealed — safe to show final outcome. */
  isTerminal: boolean;
  /** True while sitting on a hold phase waiting for realResult. */
  isHolding: boolean;
  controls: VisualizerControls;
}

interface Options {
  scenario: DemoScenario;
  /** Real API result. `null` while the run hasn't landed yet. */
  realResult: DemoStatus | null;
  /**
   * Bumped by the parent whenever a new run starts. Resets the theater so a
   * re-run of the same scenario doesn't inherit stale phase state.
   */
  runKey: number;
  /** Default transport. If the parent hasn't dispatched yet, stays `idle`. */
  autoPlay: boolean;
}

/**
 * Drives the phase machine with `setTimeout`. Pausing clears the pending timer
 * but preserves the current phase; resuming (or stepping) schedules the next
 * transition. Hold phases wait for `realResult` to be non-null before
 * advancing. The terminal phase is only revealed after `realResult` is known,
 * so the final frame never lies.
 */
export function useDemoVisualizer({
  scenario,
  realResult,
  runKey,
  autoPlay,
}: Options): VisualizerState {
  const phases = getPhases(scenario);
  const terminalIndex = getTerminalIndex(scenario);

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [mode, setMode] = useState<TheaterMode>(autoPlay ? "playing" : "idle");

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestModeRef = useRef(mode);
  latestModeRef.current = mode;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Reset whenever the parent declares a new run.
  useEffect(() => {
    clearTimer();
    setPhaseIndex(0);
    setMode(autoPlay ? "playing" : "idle");
  }, [runKey, scenario, autoPlay, clearTimer]);

  // Schedule advancement from the current phase.
  useEffect(() => {
    if (mode !== "playing" && mode !== "stepping") return;

    const current = phases[phaseIndex];
    if (!current) return;

    // Terminal is the last frame; once reached, settle.
    if (current.kind === "terminal") {
      setMode("settled");
      return;
    }

    // Hold phase: wait for real result to arrive before stepping forward.
    if (current.kind === "hold" && !canLeaveHold(current, realResult)) {
      return;
    }

    // Stepping advances exactly one beat, then pauses.
    if (mode === "stepping") {
      setPhaseIndex((i) => Math.min(i + 1, terminalIndex));
      setMode("paused");
      return;
    }

    const delay = current.durationMs > 0 ? current.durationMs : 450;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setPhaseIndex((i) => Math.min(i + 1, terminalIndex));
    }, delay);

    return clearTimer;
  }, [mode, phaseIndex, phases, terminalIndex, realResult, clearTimer]);

  // If a hold is waiting and the real result just arrived, kick the effect.
  // (The effect above will re-run because realResult changed.)

  const play = useCallback(() => {
    setMode((m) => (m === "settled" ? m : "playing"));
  }, []);
  const pause = useCallback(() => {
    clearTimer();
    setMode((m) => (m === "settled" ? m : "paused"));
  }, [clearTimer]);
  const resume = useCallback(() => {
    setMode((m) => (m === "settled" ? m : "playing"));
  }, []);
  const step = useCallback(() => {
    clearTimer();
    setMode("stepping");
  }, [clearTimer]);
  const replay = useCallback(() => {
    clearTimer();
    setPhaseIndex(0);
    setMode("playing");
  }, [clearTimer]);

  const phase = phases[phaseIndex] ?? phases[0];
  const isTerminal = phase.kind === "terminal";
  const isHolding = phase.kind === "hold" && !canLeaveHold(phase, realResult);

  return {
    scenario,
    phases,
    phaseIndex,
    phase,
    mode,
    realResult,
    isTerminal,
    isHolding,
    controls: { play, pause, resume, step, replay },
  };
}
