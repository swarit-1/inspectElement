"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { easeStage } from "@/lib/motion";

const ACTIONS = [
  {
    label: "Open live runs",
    hint: "Watch the guard decide end-to-end.",
    href: "/theater",
    glyph: "▷",
  },
  {
    label: "Review queue",
    hint: "Triage challenges & overspends.",
    href: "/review",
    glyph: "◆",
  },
  {
    label: "Rebuild policy",
    hint: "Update caps or allowlist.",
    href: "/onboarding?step=policy",
    glyph: "✎",
  },
  {
    label: "Setup walkthrough",
    hint: "Resume onboarding anywhere.",
    href: "/onboarding",
    glyph: "↻",
  },
];

export function QuickActions() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.04 } },
      }}
      className="grid grid-cols-2 md:grid-cols-4 gap-px bg-rule-subtle hairline-top hairline-bottom"
    >
      {ACTIONS.map((action) => (
        <motion.div
          key={action.label}
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.32, ease: easeStage },
            },
          }}
        >
          <Link
            href={action.href}
            className="group flex flex-col gap-2 p-5 bg-bg-root hover:bg-bg-surface transition-colors duration-[--duration-fast]"
          >
            <span
              aria-hidden
              className="font-mono text-[13px] text-accent group-hover:text-text-primary transition-colors"
            >
              {action.glyph}
            </span>
            <span className="text-[13px] text-text-primary font-medium">
              {action.label}
            </span>
            <span className="text-[11.5px] text-text-tertiary leading-snug">
              {action.hint}
            </span>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
