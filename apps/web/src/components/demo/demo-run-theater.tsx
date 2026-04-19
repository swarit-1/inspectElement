"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DemoPolicyPanel } from "./demo-policy-panel";
import { DemoRunStage } from "./demo-run-stage";
import { DemoRunWaterfall } from "./demo-run-waterfall";
import { resolveTerminal } from "./demo-visualizer";
import { useDemoVisualizer, type TheaterMode } from "./use-demo-visualizer";
import type { DemoScenario, DemoStatus } from "@/lib/types";
import { truncateAddress, USE_MOCKS } from "@/lib/constants";

interface Props {
  scenario: DemoScenario;
  runKey: number;
  /** Null while the run is still in flight. */
  realResult: DemoStatus | null;
  /** Re-runs the same scenario. Called when the presenter hits "Replay run". */
  onReplayRun: () => void;
}

export function DemoRunTheater({
  scenario,
  runKey,
  realResult,
  onReplayRun,
}: Props) {
  const state = useDemoVisualizer({
    scenario,
    realResult,
    runKey,
    autoPlay: true,
  });
  const { phase, phaseIndex, phases, mode, isTerminal, isHolding, controls } =
    state;

  const phaseReached = useMemo<
    "pre-guard" | "at-guard" | "post-guard" | "terminal"
  >(() => {
    if (isTerminal) return "terminal";
    const guardIndex = phases.findIndex((p) => p.node === "guard");
    if (phaseIndex < guardIndex) return "pre-guard";
    if (phase.node === "guard") return "at-guard";
    return "post-guard";
  }, [phase, phaseIndex, phases, isTerminal]);

  const terminal = resolveTerminal(scenario, realResult);

  return (
    <section
      className="relative hairline-top pt-6"
      data-theater-mode={mode}
      aria-label="Live agent run"
    >
      {/* Control strip */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat">
            run
          </span>
          <ModeChip mode={mode} isHolding={isHolding} />
          <span className="font-mono text-[11px] tnum text-text-tertiary truncate">
            {phase.label.toLowerCase()} · phase {phaseIndex + 1}/{phases.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {mode === "playing" && (
            <ControlButton label="Pause" onClick={controls.pause} />
          )}
          {(mode === "paused" || mode === "idle") && !isTerminal && (
            <ControlButton label="Play" onClick={controls.resume} />
          )}
          {!isTerminal && (
            <ControlButton
              label="Step →"
              onClick={controls.step}
              disabled={isHolding}
              hint={isHolding ? "Awaiting result" : undefined}
            />
          )}
          <ControlButton
            label="Replay"
            onClick={controls.replay}
            variant="ghost"
          />
          <ControlButton
            label="Re-run"
            onClick={onReplayRun}
            variant="solid"
          />
        </div>
      </div>

      {/* Paused overlay chip */}
      {mode === "paused" && !isTerminal && (
        <div
          className="absolute right-0 top-[18px] font-mono text-[10px] tnum tracking-[0.18em] uppercase px-2 py-1"
          style={{
            color: "var(--accent-bright)",
            border: "1px solid var(--accent-subtle)",
            background: "var(--bg-inset)",
          }}
        >
          ║ paused for review
        </div>
      )}

      {/* Main grid: stage full width, then waterfall + policy side-by-side */}
      <div className="flex flex-col gap-8">
        <div
          className="relative"
          style={{
            background: "var(--bg-surface)",
            padding: "20px 16px 12px",
          }}
        >
          <DemoRunStage
            scenario={scenario}
            phase={phase}
            isTerminal={isTerminal}
            realResult={realResult}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-8">
          <div>
            <DemoRunWaterfall
              scenario={scenario}
              phases={phases}
              phaseIndex={phaseIndex}
              realResult={realResult}
              isHolding={isHolding}
              isTerminal={isTerminal}
            />
          </div>
          <div>
            <DemoPolicyPanel
              scenario={scenario}
              phaseReached={phaseReached}
              realResult={realResult}
            />
          </div>
        </div>
      </div>

      {/* Terminal strip */}
      {isTerminal && realResult && (
        <div
          className="mt-8 hairline-top pt-6 flex items-start justify-between gap-6 flex-wrap"
        >
          <div className="flex flex-col gap-1.5 max-w-[60ch]">
            <div className="flex items-center gap-3 flex-wrap">
              <TerminalDot kind={terminal.kind} />
              <span
                className="font-display text-[20px] font-semibold tracking-tight"
                style={{
                  color:
                    terminal.kind === "failed" || terminal.kind === "blocked"
                      ? "var(--status-danger)"
                      : terminal.kind === "overspend"
                        ? "var(--status-warning)"
                        : "var(--status-success)",
                }}
              >
                {terminal.title}
              </span>
            </div>
            <p className="text-[12.5px] text-text-tertiary leading-relaxed">
              {terminal.detail}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {terminal.cta === "open-receipt" && realResult.receiptId && (
              <Link
                href={`/receipt/${realResult.receiptId}`}
                className="font-mono text-[12px] tnum text-accent hover:text-accent-bright underline-offset-4 hover:underline"
              >
                open receipt · {truncateAddress(realResult.receiptId, 6)} →
              </Link>
            )}
            {realResult.txHash && !USE_MOCKS && (
              <a
                href={`https://sepolia.basescan.org/tx/${realResult.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[12px] tnum text-text-tertiary hover:text-text-primary underline-offset-4 hover:underline"
              >
                tx ↗
              </a>
            )}
            {terminal.cta === "retry" && (
              <button
                type="button"
                onClick={onReplayRun}
                className="font-mono text-[12px] tnum text-accent hover:text-accent-bright underline-offset-4 hover:underline"
              >
                retry →
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function TerminalDot({
  kind,
}: {
  kind: "success" | "blocked" | "overspend" | "failed";
}) {
  const color =
    kind === "failed" || kind === "blocked"
      ? "var(--status-danger)"
      : kind === "overspend"
        ? "var(--status-warning)"
        : "var(--status-success)";
  return (
    <span
      aria-hidden
      className="block"
      style={{ width: 8, height: 8, background: color }}
    />
  );
}

function ModeChip({
  mode,
  isHolding,
}: {
  mode: TheaterMode;
  isHolding: boolean;
}) {
  const label = isHolding
    ? "awaiting result"
    : mode === "playing"
      ? "rolling"
      : mode === "paused"
        ? "paused"
        : mode === "stepping"
          ? "stepping"
          : mode === "settled"
            ? "settled"
            : "idle";
  const color =
    mode === "paused" || isHolding
      ? "var(--accent-bright)"
      : mode === "settled"
        ? "var(--status-success)"
        : mode === "playing"
          ? "var(--accent-bright)"
          : "var(--text-tertiary)";
  return (
    <span className="inline-flex items-center gap-1.5">
      {(mode === "playing" && !isHolding) && (
        <span
          aria-hidden
          className="led-pulse block"
          style={{ width: 5, height: 5, background: color }}
        />
      )}
      {(mode === "paused" || isHolding) && (
        <span
          aria-hidden
          className="block"
          style={{ width: 5, height: 5, background: color }}
        />
      )}
      <span
        className="font-mono text-[10.5px] tnum tracking-wider uppercase"
        style={{ color }}
      >
        {label}
      </span>
    </span>
  );
}

function ControlButton({
  label,
  onClick,
  disabled,
  variant = "outline",
  hint,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "outline" | "ghost" | "solid";
  hint?: string;
}) {
  const styles =
    variant === "solid"
      ? "bg-accent text-accent-ink hover:bg-accent-bright"
      : variant === "ghost"
        ? "text-text-tertiary hover:text-text-primary"
        : "border border-rule text-text-secondary hover:border-rule-strong hover:text-text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={`
        font-mono text-[10.5px] tnum tracking-wider uppercase
        px-2.5 h-7 inline-flex items-center gap-1.5
        transition-colors duration-[--duration-fast]
        disabled:opacity-40 disabled:cursor-not-allowed
        ${styles}
      `}
    >
      {label}
    </button>
  );
}
