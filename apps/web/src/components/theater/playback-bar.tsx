"use client";

import { motion } from "framer-motion";
import type { TheaterMode } from "@/components/demo/use-demo-visualizer";
import { easeStage } from "@/lib/motion";

interface PlaybackBarProps {
  mode: TheaterMode;
  isTerminal: boolean;
  isHolding: boolean;
  phaseIndex: number;
  phaseCount: number;
  phaseLabel: string;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReplay: () => void;
  onRerun: () => void;
  viewMode: "story" | "evidence";
  onViewModeChange: (mode: "story" | "evidence") => void;
}

export function PlaybackBar({
  mode,
  isTerminal,
  isHolding,
  phaseIndex,
  phaseCount,
  phaseLabel,
  onPlay,
  onPause,
  onStep,
  onReplay,
  onRerun,
  viewMode,
  onViewModeChange,
}: PlaybackBarProps) {
  const playing = mode === "playing" && !isHolding;
  const progress = phaseCount > 1 ? phaseIndex / (phaseCount - 1) : 0;

  return (
    <div className="flex flex-col hairline-top">
      {/* Progress strip */}
      <div className="relative h-[3px] bg-bg-surface">
        <motion.span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 bg-accent"
          animate={{ scaleX: progress }}
          style={{ transformOrigin: "left center", width: "100%" }}
          transition={{ duration: 0.52, ease: easeStage }}
        />
      </div>

      <div className="px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <ModeChip mode={mode} isHolding={isHolding} />
          <span className="font-mono text-[11px] tnum text-text-tertiary truncate">
            {phaseLabel.toLowerCase()} · {phaseIndex + 1}/{phaseCount}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {playing ? (
            <ControlButton label="Pause" glyph="⏸" onClick={onPause} />
          ) : (
            !isTerminal && (
              <ControlButton label="Play" glyph="▶" onClick={onPlay} />
            )
          )}
          {!isTerminal && (
            <ControlButton
              label="Step"
              glyph="→"
              onClick={onStep}
              disabled={isHolding}
              hint={isHolding ? "Awaiting result" : undefined}
            />
          )}
          <ControlButton
            label="Replay"
            glyph="↺"
            onClick={onReplay}
            variant="ghost"
          />
          <ControlButton
            label="Re-run"
            glyph="⟳"
            onClick={onRerun}
            variant="solid"
          />
          <span className="mx-2 h-5 w-px bg-rule" aria-hidden />
          <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
        </div>
      </div>
    </div>
  );
}

function ViewModeToggle({
  value,
  onChange,
}: {
  value: "story" | "evidence";
  onChange: (mode: "story" | "evidence") => void;
}) {
  return (
    <div
      className="relative inline-grid grid-cols-2 items-center rounded-[--radius-sharp] border border-rule"
      role="tablist"
      aria-label="View mode"
    >
      <motion.span
        aria-hidden
        className="absolute top-0 bottom-0 w-1/2 bg-accent"
        animate={{ left: value === "story" ? "0%" : "50%" }}
        transition={{ duration: 0.28, ease: easeStage }}
      />
      {(["story", "evidence"] as const).map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m)}
            className={`
              relative z-10 h-7 min-w-[88px] px-3 font-mono text-[10.5px] tnum tracking-wider uppercase
              text-center transition-colors cursor-pointer
              ${active ? "text-bg-root" : "text-text-tertiary hover:text-text-primary"}
            `}
          >
            <span className="relative z-10">{m}</span>
          </button>
        );
      })}
    </div>
  );
}

function ControlButton({
  label,
  glyph,
  onClick,
  disabled,
  variant = "outline",
  hint,
}: {
  label: string;
  glyph: string;
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
        transition-colors duration-[--duration-fast] cursor-pointer
        disabled:opacity-40 disabled:cursor-not-allowed
        ${styles}
      `}
    >
      <span aria-hidden className="text-[12px] leading-none">
        {glyph}
      </span>
      <span>{label}</span>
    </button>
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
      {mode === "playing" && !isHolding && (
        <span
          aria-hidden
          className="led-pulse block"
          style={{ width: 5, height: 5, background: color }}
        />
      )}
      {(mode === "paused" || isHolding || mode === "settled") && (
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
