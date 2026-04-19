"use client";

import { memo } from "react";
import {
  NODE_LABEL,
  NODE_POSITION,
  type Phase,
  type StageNode,
} from "./demo-visualizer";
import type { DemoScenario, DemoStatus } from "@/lib/types";

interface Props {
  scenario: DemoScenario;
  phase: Phase;
  isTerminal: boolean;
  realResult: DemoStatus | null;
}

const NODE_ORDER: StageNode[] = ["owner", "agent", "guard", "target", "receipt"];
const NODE_SEQ: Record<StageNode, string> = {
  owner: "N-01",
  agent: "N-02",
  guard: "N-03",
  target: "N-04",
  receipt: "N-05",
};

/**
 * Layer A — a horizontal corridor with five nodes. A gold packet slides to
 * the current phase's node. Guard treatment mutates per scenario: a spotlight
 * while evaluating, a red barrier on deny, an amber bend on flag.
 */
function StageImpl({ scenario, phase, isTerminal, realResult }: Props) {
  const packetPct = NODE_POSITION[phase.node];
  const guardKind = phase.kind;
  const blockedTerminal =
    isTerminal && realResult?.status === "success" && !!realResult.reasonCode;
  const overspendTerminal =
    isTerminal && scenario === "overspend" && !!realResult?.receiptId;
  const successTerminal =
    isTerminal &&
    scenario === "legit" &&
    !!realResult?.receiptId;

  const guardTone =
    blockedTerminal
      ? "deny"
      : guardKind === "guard-deny"
        ? "deny"
        : guardKind === "guard-warn" || overspendTerminal
          ? "warn"
          : guardKind === "guard-evaluating"
            ? "eval"
            : "idle";

  const packetTone =
    blockedTerminal
      ? "deny"
      : overspendTerminal || guardKind === "guard-warn"
        ? "warn"
        : successTerminal
          ? "success"
          : "idle";

  const packetStyle: Record<string, string> = {
    left: `${packetPct}%`,
    transition: "left 580ms cubic-bezier(0.16, 1, 0.3, 1)",
  };

  // If we're blocked, freeze the packet at the guard so it never crosses.
  const frozenAtGuard = blockedTerminal || guardKind === "guard-deny";
  if (frozenAtGuard) {
    packetStyle.left = `${NODE_POSITION.guard}%`;
  }

  return (
    <div className="relative">
      <div className="flex items-baseline justify-between mb-4">
        <div className="eyebrow text-text-secondary">Path stage</div>
        <div className="font-mono text-[11px] tnum text-text-quat tracking-wider">
          {phase.node.toUpperCase()} · {phase.label.toLowerCase()}
        </div>
      </div>

      <div className="relative h-[180px] hairline-top hairline-bottom py-8 px-4 overflow-hidden">
        {/* Corridor rail */}
        <div
          className="absolute left-[6%] right-[3%] top-1/2 h-px"
          style={{ background: "var(--rule)" }}
          aria-hidden
        />
        {/* Packet trail up to guard for blocked, whole rail for others */}
        <div
          className="absolute left-[6%] top-1/2 h-px transition-[right,background] duration-500"
          style={{
            right: `${100 - (frozenAtGuard ? NODE_POSITION.guard : packetPct)}%`,
            background:
              packetTone === "deny"
                ? "var(--status-danger)"
                : packetTone === "warn"
                  ? "var(--status-warning)"
                  : packetTone === "success"
                    ? "var(--status-success)"
                    : "var(--accent-dim)",
            opacity: 0.85,
          }}
          aria-hidden
        />

        {/* Nodes */}
        {NODE_ORDER.map((n) => {
          const active = phase.node === n && !isTerminal;
          const passed = NODE_POSITION[n] < packetPct || (isTerminal && !frozenAtGuard);
          const isGuard = n === "guard";
          const guardActive = isGuard && (guardTone !== "idle");
          const dotTone = isGuard
            ? guardTone === "deny"
              ? "var(--status-danger)"
              : guardTone === "warn"
                ? "var(--status-warning)"
                : guardTone === "eval"
                  ? "var(--accent-bright)"
                  : "var(--text-tertiary)"
            : active
              ? "var(--accent-bright)"
              : passed
                ? "var(--accent-dim)"
                : "var(--text-quat)";
          return (
            <div
              key={n}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 w-[110px]"
              style={{ left: `${NODE_POSITION[n]}%` }}
            >
              <div className="relative flex items-center justify-center">
                {guardActive && (
                  <span
                    className="absolute inset-[-14px] rounded-full breath"
                    style={{
                      background:
                        guardTone === "deny"
                          ? "oklch(0.68 0.19 25 / 0.12)"
                          : guardTone === "warn"
                            ? "oklch(0.79 0.15 85 / 0.14)"
                            : "oklch(0.8 0.135 75 / 0.14)",
                    }}
                    aria-hidden
                  />
                )}
                <span
                  className="relative block"
                  style={{
                    width: 10,
                    height: 10,
                    background: dotTone,
                    boxShadow: active
                      ? `0 0 0 3px oklch(0.8 0.135 75 / 0.2)`
                      : undefined,
                  }}
                  aria-hidden
                />
                {isGuard && guardTone === "deny" && (
                  <span
                    className="absolute top-1/2 -translate-y-1/2"
                    style={{
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: 2,
                      height: 44,
                      background: "var(--status-danger)",
                    }}
                    aria-hidden
                  />
                )}
              </div>
              <div className="flex flex-col items-center gap-1 mt-2">
                <span className="font-mono text-[10px] tnum tracking-wider uppercase text-text-quat">
                  {NODE_SEQ[n]}
                </span>
                <span
                  className="font-mono text-[10.5px] tnum tracking-wide uppercase text-center"
                  style={{
                    color:
                      active || (isGuard && guardTone !== "idle")
                        ? "var(--text-primary)"
                        : passed
                          ? "var(--text-secondary)"
                          : "var(--text-quat)",
                  }}
                >
                  {NODE_LABEL[n]}
                </span>
              </div>
            </div>
          );
        })}

        {/* Packet */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={packetStyle}
          aria-hidden
        >
          <span
            className="block"
            style={{
              width: 14,
              height: 14,
              transform: "rotate(45deg)",
              background:
                packetTone === "deny"
                  ? "var(--status-danger)"
                  : packetTone === "warn"
                    ? "var(--status-warning)"
                    : packetTone === "success"
                      ? "var(--status-success)"
                      : "var(--accent-bright)",
              boxShadow: "0 0 0 4px var(--bg-root)",
            }}
          />
        </div>
      </div>

      {/* Terminal stamp row */}
      <div className="mt-4 flex items-center justify-between">
        <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat">
          scenario · {scenario}
        </span>
        <TerminalStamp
          isTerminal={isTerminal}
          scenario={scenario}
          realResult={realResult}
        />
      </div>
    </div>
  );
}

function TerminalStamp({
  isTerminal,
  scenario,
  realResult,
}: {
  isTerminal: boolean;
  scenario: DemoScenario;
  realResult: DemoStatus | null;
}) {
  if (!isTerminal) {
    return (
      <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat">
        in flight
      </span>
    );
  }
  if (!realResult) {
    return (
      <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat">
        awaiting result
      </span>
    );
  }
  if (realResult.status === "failed") {
    return (
      <span
        className="font-mono text-[10.5px] tnum tracking-wider uppercase"
        style={{ color: "var(--status-danger)" }}
      >
        ✕ failed
      </span>
    );
  }
  if (realResult.reasonCode) {
    return (
      <span
        className="font-mono text-[10.5px] tnum tracking-wider uppercase"
        style={{ color: "var(--status-danger)" }}
      >
        ✕ blocked at guard
      </span>
    );
  }
  if (scenario === "overspend") {
    return (
      <span
        className="font-mono text-[10.5px] tnum tracking-wider uppercase"
        style={{ color: "var(--status-warning)" }}
      >
        △ recourse open
      </span>
    );
  }
  return (
    <span
      className="font-mono text-[10.5px] tnum tracking-wider uppercase"
      style={{ color: "var(--status-success)" }}
    >
      ● executed
    </span>
  );
}

export const DemoRunStage = memo(StageImpl);
