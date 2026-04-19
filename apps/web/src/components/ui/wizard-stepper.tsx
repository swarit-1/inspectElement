"use client";

import { motion } from "framer-motion";
import { easeStage } from "@/lib/motion";

export type StepState = "locked" | "active" | "complete" | "blocked";

export interface WizardStep {
  id: string;
  index: number;
  label: string;
  caption?: string;
  state: StepState;
}

interface WizardStepperProps {
  steps: WizardStep[];
  onSelect?: (id: string) => void;
  orientation?: "horizontal" | "vertical";
}

const marker: Record<StepState, string> = {
  locked: "○",
  active: "◉",
  complete: "●",
  blocked: "✕",
};

const tone: Record<StepState, string> = {
  locked: "text-text-quat",
  active: "text-accent",
  complete: "text-success",
  blocked: "text-danger",
};

export function WizardStepper({
  steps,
  onSelect,
  orientation = "horizontal",
}: WizardStepperProps) {
  const isH = orientation === "horizontal";

  return (
    <nav
      className={
        isH
          ? "grid grid-flow-col auto-cols-fr gap-0 w-full hairline-top hairline-bottom"
          : "flex flex-col gap-0 w-full"
      }
      aria-label="Onboarding progress"
    >
      {steps.map((s, i) => {
        const num = String(s.index).padStart(2, "0");
        const clickable =
          !!onSelect && (s.state === "complete" || s.state === "active");
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => clickable && onSelect(s.id)}
            disabled={!clickable}
            aria-current={s.state === "active" ? "step" : undefined}
            className={`
              group relative text-left
              ${isH ? "px-4 py-4 border-r border-rule-subtle last:border-r-0" : "px-4 py-4 hairline-bottom"}
              ${clickable ? "cursor-pointer hover:bg-bg-surface/60" : "cursor-default"}
              transition-colors
            `}
          >
            <div className="flex items-start gap-3">
              <span
                className={`
                  seq tabular-nums shrink-0 pt-0.5
                  ${s.state === "locked" ? "text-text-quat" : "text-accent"}
                `}
              >
                {num}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-[13px] leading-none ${tone[s.state]}`}
                    aria-hidden
                  >
                    {marker[s.state]}
                  </span>
                  <span
                    className={`
                      font-display font-medium text-[14px] leading-tight
                      ${s.state === "locked" ? "text-text-tertiary" : "text-text-primary"}
                    `}
                  >
                    {s.label}
                  </span>
                </div>
                {s.caption && (
                  <p
                    className="mt-1.5 text-text-tertiary"
                    style={{ fontSize: "12px", lineHeight: 1.45 }}
                  >
                    {s.caption}
                  </p>
                )}
              </div>
            </div>
            {s.state === "active" && (
              <motion.span
                aria-hidden
                layoutId="wizard-active-underline"
                className={
                  isH
                    ? "absolute left-0 right-0 bottom-0 h-[2px] bg-accent"
                    : "absolute left-0 top-0 bottom-0 w-[2px] bg-accent"
                }
                transition={{ duration: 0.3, ease: easeStage }}
              />
            )}
            {i < steps.length - 1 && null}
          </button>
        );
      })}
    </nav>
  );
}
