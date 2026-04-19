"use client";

import { memo } from "react";
import type { Phase } from "./demo-visualizer";
import type { DemoScenario, DemoStatus } from "@/lib/types";

interface Props {
  scenario: DemoScenario;
  phases: Phase[];
  phaseIndex: number;
  realResult: DemoStatus | null;
  isHolding: boolean;
  isTerminal: boolean;
}

/**
 * Layer B — vertical waterfall like a Sentry trace. Each phase is a row with
 * a sequence code, relative timestamp, label, and status stamp. The current
 * phase breathes; completed phases are dim; future phases are quat. Hold and
 * terminal phases honor the real result (never lie).
 */
function WaterfallImpl({
  scenario,
  phases,
  phaseIndex,
  realResult,
  isHolding,
  isTerminal,
}: Props) {
  // Synthetic relative timestamps for scripted duration (ms cumulative before current)
  let running = 0;
  const offsets = phases.map((p) => {
    const at = running;
    running += p.durationMs;
    return at;
  });

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <div className="eyebrow text-text-secondary">Trace</div>
        <div className="font-mono text-[11px] tnum text-text-quat tracking-wider">
          {phaseIndex + 1}/{phases.length} · {scenario}
        </div>
      </div>

      <ol className="flex flex-col">
        {phases.map((p, i) => {
          const state: "past" | "current" | "future" =
            i < phaseIndex ? "past" : i === phaseIndex ? "current" : "future";
          return (
            <li
              key={p.id}
              className="grid grid-cols-[44px_14px_1fr_auto] items-start gap-x-3 py-3 hairline-bottom border-rule-subtle"
            >
              <span
                className="font-mono text-[10.5px] tnum tracking-wider uppercase pt-[3px]"
                style={{
                  color:
                    state === "future"
                      ? "var(--text-quat)"
                      : "var(--text-tertiary)",
                }}
              >
                +{(offsets[i] / 1000).toFixed(2)}s
              </span>
              <span className="relative pt-[7px]">
                <Dot state={state} kind={p.kind} />
                {i < phases.length - 1 && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 top-4 w-px"
                    style={{
                      height: 28,
                      background:
                        state === "future"
                          ? "var(--rule-subtle)"
                          : "var(--rule)",
                    }}
                    aria-hidden
                  />
                )}
              </span>
              <div className="flex flex-col">
                <span
                  className="font-mono text-[12px] tnum tracking-wide"
                  style={{
                    color:
                      state === "current"
                        ? "var(--text-primary)"
                        : state === "future"
                          ? "var(--text-quat)"
                          : "var(--text-secondary)",
                  }}
                >
                  {p.label}
                </span>
                <span
                  className="text-[11.5px] leading-relaxed mt-0.5"
                  style={{
                    color:
                      state === "future"
                        ? "var(--text-quat)"
                        : "var(--text-tertiary)",
                    maxWidth: "48ch",
                  }}
                >
                  {p.detail}
                </span>
              </div>
              <RowStamp
                state={state}
                phase={p}
                isHolding={isHolding && i === phaseIndex}
                isTerminal={isTerminal && i === phaseIndex}
                scenario={scenario}
                realResult={realResult}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Dot({
  state,
  kind,
}: {
  state: "past" | "current" | "future";
  kind: Phase["kind"];
}) {
  if (state === "current") {
    const color =
      kind === "guard-deny"
        ? "var(--status-danger)"
        : kind === "guard-warn"
          ? "var(--status-warning)"
          : kind === "hold"
            ? "var(--accent-dim)"
            : kind === "terminal"
              ? "var(--status-success)"
              : "var(--accent-bright)";
    return (
      <span className="relative inline-block align-middle">
        <span
          aria-hidden
          className="absolute inset-[-5px] rounded-full breath"
          style={{ background: color, opacity: 0.18 }}
        />
        <span
          className="relative block"
          style={{ width: 6, height: 6, background: color }}
        />
      </span>
    );
  }
  if (state === "past") {
    return (
      <span
        className="block"
        style={{
          width: 6,
          height: 6,
          background: "var(--accent-dim)",
          opacity: 0.6,
        }}
        aria-hidden
      />
    );
  }
  return (
    <span
      className="block"
      style={{
        width: 6,
        height: 6,
        border: "1px solid var(--rule)",
      }}
      aria-hidden
    />
  );
}

function RowStamp({
  state,
  phase,
  isHolding,
  isTerminal,
  scenario,
  realResult,
}: {
  state: "past" | "current" | "future";
  phase: Phase;
  isHolding: boolean;
  isTerminal: boolean;
  scenario: DemoScenario;
  realResult: DemoStatus | null;
}) {
  if (isHolding) {
    return (
      <span
        className="font-mono text-[10px] tnum tracking-wider uppercase whitespace-nowrap"
        style={{ color: "var(--text-tertiary)" }}
      >
        awaiting…
      </span>
    );
  }
  if (isTerminal) {
    if (!realResult) return null;
    if (realResult.status === "failed") {
      return (
        <span
          className="font-mono text-[10px] tnum tracking-wider uppercase whitespace-nowrap"
          style={{ color: "var(--status-danger)" }}
        >
          ✕ fail
        </span>
      );
    }
    if (realResult.reasonCode) {
      return (
        <span
          className="font-mono text-[10px] tnum tracking-wider uppercase whitespace-nowrap"
          style={{ color: "var(--status-danger)" }}
        >
          ✕ denied
        </span>
      );
    }
    if (scenario === "overspend") {
      return (
        <span
          className="font-mono text-[10px] tnum tracking-wider uppercase whitespace-nowrap"
          style={{ color: "var(--status-warning)" }}
        >
          △ challengeable
        </span>
      );
    }
    return (
      <span
        className="font-mono text-[10px] tnum tracking-wider uppercase whitespace-nowrap"
        style={{ color: "var(--status-success)" }}
      >
        ● confirmed
      </span>
    );
  }
  if (state === "past") {
    return (
      <span
        className="font-mono text-[10px] tnum tracking-wider uppercase whitespace-nowrap"
        style={{ color: "var(--text-tertiary)" }}
      >
        ok
      </span>
    );
  }
  if (state === "current") {
    const tone =
      phase.kind === "guard-deny"
        ? "denying"
        : phase.kind === "guard-warn"
          ? "flagging"
          : phase.kind === "guard-evaluating"
            ? "evaluating"
            : "running";
    const color =
      phase.kind === "guard-deny"
        ? "var(--status-danger)"
        : phase.kind === "guard-warn"
          ? "var(--status-warning)"
          : "var(--accent-bright)";
    return (
      <span
        className="font-mono text-[10px] tnum tracking-wider uppercase whitespace-nowrap"
        style={{ color }}
      >
        {tone}…
      </span>
    );
  }
  return null;
}

export const DemoRunWaterfall = memo(WaterfallImpl);
