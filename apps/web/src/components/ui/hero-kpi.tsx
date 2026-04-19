"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { easeStage } from "@/lib/motion";

interface HeroKpiProps {
  kicker: string;
  value: ReactNode;
  unit?: string;
  caption?: ReactNode;
  trend?: "up" | "down" | "flat";
  tone?: "default" | "accent" | "success" | "warning" | "danger";
}

const toneMap: Record<NonNullable<HeroKpiProps["tone"]>, string> = {
  default: "text-text-primary",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function HeroKpi({
  kicker,
  value,
  unit,
  caption,
  tone = "default",
}: HeroKpiProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.46, ease: easeStage }}
      className="flex flex-col gap-2"
    >
      <span className="eyebrow text-text-tertiary">{kicker}</span>
      <div className="flex items-baseline gap-2.5">
        <span
          className={`font-display font-semibold leading-[0.95] tnum ${toneMap[tone]}`}
          style={{ fontSize: "var(--t-3xl)", letterSpacing: "-0.02em" }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="eyebrow text-text-tertiary"
            style={{ fontSize: "11px" }}
          >
            {unit}
          </span>
        )}
      </div>
      {caption && (
        <div
          className="text-text-secondary"
          style={{ fontSize: "var(--t-sm)", lineHeight: 1.5 }}
        >
          {caption}
        </div>
      )}
    </motion.div>
  );
}
