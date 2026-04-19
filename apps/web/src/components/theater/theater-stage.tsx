"use client";

import { motion, AnimatePresence } from "framer-motion";
import { memo } from "react";
import {
  NODE_LABEL,
  NODE_POSITION,
  type Phase,
  type StageNode,
} from "@/components/demo/demo-visualizer";
import type { DemoScenario, DemoStatus } from "@/lib/types";
import { easeOutExpo, easeStage } from "@/lib/motion";

interface Props {
  scenario: DemoScenario;
  phase: Phase;
  isTerminal: boolean;
  isHolding: boolean;
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

function StageImpl({ scenario, phase, isTerminal, isHolding, realResult }: Props) {
  const packetPct = NODE_POSITION[phase.node];
  const guardKind = phase.kind;

  const blockedTerminal =
    isTerminal && realResult?.status === "success" && !!realResult.reasonCode;
  const overspendTerminal =
    isTerminal && scenario === "overspend" && !!realResult?.receiptId;
  const successTerminal =
    isTerminal && scenario === "legit" && !!realResult?.receiptId;

  const guardTone = blockedTerminal
    ? "deny"
    : guardKind === "guard-deny"
      ? "deny"
      : guardKind === "guard-warn" || overspendTerminal
        ? "warn"
        : guardKind === "guard-evaluating"
          ? "eval"
          : "idle";

  const packetTone = blockedTerminal
    ? "deny"
    : overspendTerminal || guardKind === "guard-warn"
      ? "warn"
      : successTerminal
        ? "success"
        : "idle";

  const frozenAtGuard = blockedTerminal || guardKind === "guard-deny";
  const packetX = frozenAtGuard ? NODE_POSITION.guard : packetPct;

  const packetColor =
    packetTone === "deny"
      ? "var(--status-danger)"
      : packetTone === "warn"
        ? "var(--status-warning)"
        : packetTone === "success"
          ? "var(--status-success)"
          : "var(--accent-bright)";

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-5">
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-text-secondary">Path stage</span>
          <span
            className="font-display font-medium tracking-tight text-text-primary"
            style={{ fontSize: "17px", letterSpacing: "-0.01em" }}
          >
            {phase.label}
          </span>
        </div>
        <span className="font-mono text-[11px] tnum text-text-quat tracking-wider uppercase">
          {phase.node}
        </span>
      </div>

      {/* Corridor */}
      <div
        className="relative h-[200px] overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, oklch(0.18 0.02 260 / 0.5), transparent 70%)",
          border: "1px solid var(--rule-subtle)",
        }}
      >
        <Scanlines />
        {/* Rail */}
        <div
          className="absolute left-[5%] right-[3%] top-1/2 h-px"
          style={{ background: "var(--rule)" }}
          aria-hidden
        />
        {/* Lit trail */}
        <motion.div
          className="absolute left-[5%] top-1/2 h-px"
          aria-hidden
          animate={{
            right: `${100 - packetX}%`,
            backgroundColor:
              packetTone === "deny"
                ? "oklch(0.68 0.19 25)"
                : packetTone === "warn"
                  ? "oklch(0.79 0.15 85)"
                  : packetTone === "success"
                    ? "oklch(0.75 0.15 150)"
                    : "oklch(0.8 0.135 75 / 0.8)",
            opacity: 0.9,
          }}
          transition={{ duration: 0.58, ease: easeOutExpo }}
        />

        {/* Nodes */}
        {NODE_ORDER.map((n) => {
          const active = phase.node === n && !isTerminal;
          const passed = NODE_POSITION[n] < packetX || (isTerminal && !frozenAtGuard);
          const isGuard = n === "guard";
          const guardActive = isGuard && guardTone !== "idle";
          const dotColor = isGuard
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
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 w-[120px]"
              style={{ left: `${NODE_POSITION[n]}%` }}
            >
              <div className="relative flex items-center justify-center h-5 w-5">
                {guardActive && (
                  <motion.span
                    className="absolute inset-[-18px] rounded-full"
                    aria-hidden
                    style={{
                      background:
                        guardTone === "deny"
                          ? "oklch(0.68 0.19 25 / 0.16)"
                          : guardTone === "warn"
                            ? "oklch(0.79 0.15 85 / 0.18)"
                            : "oklch(0.8 0.135 75 / 0.18)",
                    }}
                    animate={{
                      scale: [0.9, 1.1, 0.9],
                      opacity: [0.6, 1, 0.6],
                    }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                <motion.span
                  className="relative block"
                  aria-hidden
                  animate={{
                    backgroundColor: dotColor,
                    boxShadow: active
                      ? "0 0 0 4px oklch(0.8 0.135 75 / 0.18)"
                      : "0 0 0 0px oklch(0.8 0.135 75 / 0)",
                  }}
                  transition={{ duration: 0.3, ease: easeStage }}
                  style={{ width: 11, height: 11 }}
                />
                {isGuard && guardTone === "deny" && (
                  <motion.span
                    aria-hidden
                    className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.36, ease: easeOutExpo }}
                    style={{
                      top: "50%",
                      width: 2,
                      height: 56,
                      background: "var(--status-danger)",
                      transformOrigin: "center",
                    }}
                  />
                )}
              </div>
              <div className="flex flex-col items-center gap-1 mt-1">
                <span className="font-mono text-[9.5px] tnum tracking-wider uppercase text-text-quat">
                  {NODE_SEQ[n]}
                </span>
                <motion.span
                  className="font-mono text-[10.5px] tnum tracking-wide uppercase text-center"
                  animate={{
                    color:
                      active || guardActive
                        ? "oklch(0.97 0.01 80)"
                        : passed
                          ? "oklch(0.72 0.02 80)"
                          : "oklch(0.42 0.02 80)",
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {NODE_LABEL[n]}
                </motion.span>
              </div>
            </div>
          );
        })}

        {/* Packet */}
        <motion.div
          className="absolute top-1/2 pointer-events-none"
          aria-hidden
          animate={{
            left: `${packetX}%`,
            scale: isHolding ? [1, 1.12, 1] : 1,
          }}
          transition={{
            left: { duration: 0.6, ease: easeOutExpo },
            scale: isHolding
              ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.3 },
          }}
          style={{ translateX: "-50%", translateY: "-50%" }}
        >
          <motion.span
            className="block"
            animate={{ backgroundColor: packetColor }}
            transition={{ duration: 0.4, ease: easeStage }}
            style={{
              width: 16,
              height: 16,
              transform: "rotate(45deg)",
              boxShadow: "0 0 0 5px var(--bg-root)",
            }}
          />
        </motion.div>

        {/* Holding overlay */}
        <AnimatePresence>
          {isHolding && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-3 left-4 font-mono text-[10px] tnum tracking-[0.22em] uppercase"
              style={{ color: "var(--accent-bright)" }}
            >
              ⟳ awaiting result
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Terminal stamp */}
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
        ✕ blocked · no funds moved
      </span>
    );
  }
  if (scenario === "overspend") {
    return (
      <span
        className="font-mono text-[10.5px] tnum tracking-wider uppercase"
        style={{ color: "var(--status-warning)" }}
      >
        △ recourse open · challengeable
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

function Scanlines() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.06]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent 0 2px, currentColor 2px 3px)",
        color: "var(--text-primary)",
      }}
    />
  );
}

export const TheaterStage = memo(StageImpl);
