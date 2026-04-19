"use client";

import { motion } from "framer-motion";
import type { DemoScenario } from "@/lib/types";
import { easeStage } from "@/lib/motion";

export interface ScenarioDescriptor {
  id: DemoScenario;
  seq: string;
  label: string;
  expected: string;
  description: string;
  variant: "primary" | "danger" | "secondary";
}

export const SCENARIOS: ScenarioDescriptor[] = [
  {
    id: "legit",
    seq: "S-01",
    label: "Legit payment",
    expected: "EXECUTED",
    description:
      "2.0 USD → allowlisted merchant, within per-tx and daily caps.",
    variant: "primary",
  },
  {
    id: "blocked",
    seq: "S-02",
    label: "Blocked attack",
    expected: "BLOCKED",
    description:
      "20.0 USD → non-allowlisted attacker. Guard rejects before the stablecoin is touched.",
    variant: "danger",
  },
  {
    id: "overspend",
    seq: "S-03",
    label: "Overspend attack",
    expected: "EXECUTES → CHALLENGEABLE",
    description:
      "15.0 USD → allowlisted merchant. Exceeds 10 USD per-tx cap; receipt is challengeable.",
    variant: "secondary",
  },
];

interface ScenarioRailProps {
  activeId: DemoScenario | null;
  isRunning: boolean;
  onSelect: (id: DemoScenario) => void;
}

const accentFor = (v: ScenarioDescriptor["variant"]) =>
  v === "danger"
    ? "var(--status-danger)"
    : v === "secondary"
      ? "var(--status-warning)"
      : "var(--accent-bright)";

export function ScenarioRail({
  activeId,
  isRunning,
  onSelect,
}: ScenarioRailProps) {
  return (
    <nav
      aria-label="Scenario selector"
      className="flex flex-col hairline-top hairline-bottom"
    >
      <div className="px-4 py-3 flex items-center justify-between hairline-bottom">
        <span className="eyebrow text-text-secondary">Scenarios</span>
        <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat">
          03
        </span>
      </div>
      {SCENARIOS.map((s) => {
        const active = activeId === s.id;
        const running = active && isRunning;
        const accent = accentFor(s.variant);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            disabled={running}
            className={`
              group relative text-left flex flex-col gap-2 px-4 py-4
              transition-colors duration-[--duration-fast]
              hairline-bottom last:border-b-0
              hover:bg-bg-surface/60
              disabled:cursor-wait
              ${active ? "bg-bg-surface/80" : ""}
            `}
            aria-current={active ? "true" : undefined}
          >
            {active && (
              <motion.span
                layoutId="scenario-rail-active"
                className="absolute left-0 top-0 bottom-0 w-[2px]"
                style={{ background: accent }}
                transition={{ duration: 0.28, ease: easeStage }}
              />
            )}
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat">
                {s.seq}
              </span>
              {running ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tnum tracking-wider uppercase">
                  <span
                    aria-hidden
                    className="led-pulse block"
                    style={{ width: 5, height: 5, background: accent }}
                  />
                  <span style={{ color: accent }}>running</span>
                </span>
              ) : (
                <span
                  className="font-mono text-[10px] tnum tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: accent }}
                >
                  dispatch →
                </span>
              )}
            </div>
            <h3
              className="font-display font-medium tracking-tight text-text-primary"
              style={{ fontSize: "15px", lineHeight: 1.25 }}
            >
              {s.label}
            </h3>
            <div className="font-mono text-[10px] tnum tracking-wider uppercase text-text-quat">
              expected ·{" "}
              <span className="text-text-tertiary">{s.expected}</span>
            </div>
            <p className="text-[12px] text-text-tertiary leading-relaxed">
              {s.description}
            </p>
          </button>
        );
      })}
    </nav>
  );
}
