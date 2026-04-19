"use client";

import { motion } from "framer-motion";
import { easeStage } from "@/lib/motion";

export type PolicyCheckState = "pass" | "fail" | "flag" | "pending";

interface PolicyCheckProps {
  label: string;
  plainEnglish: string;
  state: PolicyCheckState;
  detail?: string;
  index?: number;
}

const glyph: Record<PolicyCheckState, string> = {
  pass: "✓",
  fail: "✕",
  flag: "△",
  pending: "…",
};

const tone: Record<PolicyCheckState, { ring: string; fg: string; glow: string }> = {
  pass: {
    ring: "border-success/40",
    fg: "text-success",
    glow: "bg-success/15",
  },
  fail: {
    ring: "border-danger/40",
    fg: "text-danger",
    glow: "bg-danger/15",
  },
  flag: {
    ring: "border-warning/40",
    fg: "text-warning",
    glow: "bg-warning/15",
  },
  pending: {
    ring: "border-rule",
    fg: "text-text-tertiary",
    glow: "bg-transparent",
  },
};

export function PolicyCheck({
  label,
  plainEnglish,
  state,
  detail,
  index = 0,
}: PolicyCheckProps) {
  const t = tone[state];
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: easeStage, delay: index * 0.05 }}
      className="flex items-start gap-3 py-3 hairline-bottom last:border-b-0"
    >
      <span
        className={`
          relative mt-0.5 inline-flex h-5 w-5 items-center justify-center
          rounded-[--radius-sharp] border ${t.ring} ${t.fg}
        `}
        aria-hidden
      >
        <span className={`absolute inset-0 ${t.glow} rounded-[--radius-sharp]`} />
        <span className="relative font-mono text-[11px] leading-none">
          {glyph[state]}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={`eyebrow ${t.fg}`}
            style={{ fontSize: "10.5px" }}
          >
            {label}
          </span>
          {detail && (
            <span
              className="text-text-tertiary tnum font-mono text-[11px] shrink-0"
            >
              {detail}
            </span>
          )}
        </div>
        <p
          className="mt-1 text-text-secondary"
          style={{ fontSize: "var(--t-sm)", lineHeight: 1.5 }}
        >
          {plainEnglish}
        </p>
      </div>
    </motion.li>
  );
}
