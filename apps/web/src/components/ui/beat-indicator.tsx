"use client";

import { motion } from "framer-motion";
import { easeStage } from "@/lib/motion";

export type BeatState = "past" | "active" | "future";

interface BeatIndicatorProps {
  beats: { id: string; label: string }[];
  activeIndex: number;
  orientation?: "horizontal" | "vertical";
  onSelect?: (index: number) => void;
}

export function BeatIndicator({
  beats,
  activeIndex,
  orientation = "horizontal",
  onSelect,
}: BeatIndicatorProps) {
  const isH = orientation === "horizontal";
  return (
    <ol
      className={
        isH
          ? "flex items-center gap-0 w-full"
          : "flex flex-col items-start gap-0"
      }
      aria-label="Timeline beats"
    >
      {beats.map((b, i) => {
        const state: BeatState =
          i < activeIndex ? "past" : i === activeIndex ? "active" : "future";
        const isLast = i === beats.length - 1;
        return (
          <li
            key={b.id}
            className={
              isH
                ? "flex items-center flex-1 last:flex-none min-w-0"
                : "flex items-start gap-3 w-full"
            }
          >
            <button
              type="button"
              onClick={() => onSelect?.(i)}
              className="group flex items-center gap-2 shrink-0 cursor-pointer disabled:cursor-default"
              disabled={!onSelect}
              aria-current={state === "active" ? "step" : undefined}
            >
              <motion.span
                className="relative inline-flex items-center justify-center"
                animate={{
                  scale: state === "active" ? 1.15 : 1,
                }}
                transition={{ duration: 0.32, ease: easeStage }}
              >
                <span
                  className={`
                    block h-2 w-2 rounded-full transition-colors duration-200
                    ${
                      state === "active"
                        ? "bg-accent"
                        : state === "past"
                          ? "bg-accent-dim"
                          : "bg-rule"
                    }
                  `}
                />
                {state === "active" && (
                  <motion.span
                    aria-hidden
                    className="absolute h-4 w-4 rounded-full bg-accent/25"
                    animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                  />
                )}
              </motion.span>
              <span
                className={`
                  eyebrow transition-colors duration-200
                  ${
                    state === "active"
                      ? "text-text-primary"
                      : state === "past"
                        ? "text-text-secondary"
                        : "text-text-quat"
                  }
                `}
              >
                {b.label}
              </span>
            </button>
            {!isLast && (
              <span
                aria-hidden
                className={
                  isH
                    ? "flex-1 h-px mx-3 relative overflow-hidden"
                    : "block w-px ml-[3px] my-2 relative overflow-hidden"
                }
                style={{
                  minHeight: isH ? undefined : "18px",
                }}
              >
                <span
                  className="absolute inset-0 bg-rule-subtle"
                  aria-hidden
                />
                <motion.span
                  className="absolute inset-0 bg-accent-dim origin-left"
                  initial={false}
                  animate={{
                    scaleX: state === "past" ? 1 : 0,
                  }}
                  style={{
                    transformOrigin: isH ? "left center" : "top center",
                  }}
                  transition={{ duration: 0.52, ease: easeStage }}
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
