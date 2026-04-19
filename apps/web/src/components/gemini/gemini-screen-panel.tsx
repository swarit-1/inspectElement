"use client";

import type { ScreenResponse } from "@/lib/api";

interface GeminiScreenPanelProps {
  screen: ScreenResponse | null;
  isLoading?: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: "text-success",
  medium: "text-warning",
  high: "text-danger",
  critical: "text-danger",
};

const SEVERITY_BG: Record<string, string> = {
  low: "bg-success/10 border-success/20",
  medium: "bg-warning/10 border-warning/20",
  high: "bg-danger/10 border-danger/20",
  critical: "bg-danger/10 border-danger/20",
};

const ACTION_COLORS: Record<string, string> = {
  allow: "text-success",
  review: "text-warning",
  block: "text-danger",
};

export function GeminiScreenPanel({ screen, isLoading }: GeminiScreenPanelProps) {
  if (isLoading) {
    return (
      <div className="border border-rule rounded-lg p-5 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-mono tracking-wider text-text-tertiary uppercase">
            Gemini Advisory Screen
          </span>
        </div>
        <div className="h-4 bg-surface-raised rounded w-1/2 mb-2" />
        <div className="h-3 bg-surface-raised rounded w-1/3" />
      </div>
    );
  }

  if (!screen) return null;

  const scorePercent = Math.round(screen.injectionScore * 100);
  const severityColor = SEVERITY_COLORS[screen.severity] ?? "text-text-secondary";
  const severityBg = SEVERITY_BG[screen.severity] ?? "bg-surface-raised border-rule";
  const actionColor = ACTION_COLORS[screen.recommendedAction] ?? "text-text-secondary";

  return (
    <div className={`border rounded-lg p-5 ${severityBg}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-mono tracking-wider text-accent uppercase font-medium">
          Gemini Advisory Screen
        </span>
        <span className="h-px flex-1 bg-rule" />
        <span className="text-[10px] font-mono text-text-quat">
          {screen.model} · {screen.advisoryOnly ? "advisory only" : "HARD MODE"}
        </span>
      </div>

      <div className="flex items-center gap-6 mb-4 flex-wrap">
        {/* Risk score */}
        <div className="flex flex-col items-center gap-1">
          <span className="eyebrow">Risk Score</span>
          <span
            className={`font-display font-bold tabular-nums ${severityColor}`}
            style={{ fontSize: "var(--t-2xl)" }}
          >
            {scorePercent}%
          </span>
        </div>

        {/* Severity */}
        <div className="flex flex-col items-center gap-1">
          <span className="eyebrow">Severity</span>
          <span className={`font-mono text-[13px] font-semibold uppercase ${severityColor}`}>
            {screen.severity}
          </span>
        </div>

        {/* Recommendation */}
        <div className="flex flex-col items-center gap-1">
          <span className="eyebrow">Recommendation</span>
          <span className={`font-mono text-[13px] font-semibold uppercase ${actionColor}`}>
            {screen.recommendedAction}
          </span>
        </div>

        {screen.hardModeTriggered && (
          <div className="flex flex-col items-center gap-1">
            <span className="eyebrow text-danger">Hard Mode</span>
            <span className="font-mono text-[13px] font-semibold uppercase text-danger">
              TRIGGERED
            </span>
          </div>
        )}
      </div>

      {/* Explanation */}
      <div className="mb-3">
        <span className="eyebrow block mb-1">Explanation</span>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          {screen.explanation}
        </p>
      </div>

      {/* Signals */}
      {screen.signals.length > 0 && (
        <div className="mb-3">
          <span className="eyebrow block mb-1">Detected Signals</span>
          <div className="flex flex-wrap gap-1.5">
            {screen.signals.map((signal, i) => (
              <span
                key={i}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-raised text-text-tertiary border border-rule"
              >
                {signal}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-text-quat font-mono mt-3">
        Gemini screening is advisory only. Deterministic on-chain guardrails remain authoritative
        for all payment decisions.
      </p>
    </div>
  );
}
