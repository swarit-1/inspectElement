"use client";

import { motion } from "framer-motion";
import { BudgetGauge } from "@/components/ui/budget-gauge";
import { Section } from "@/components/ui/section";
import {
  DEMO_MAX_SPEND_PER_DAY,
  DEMO_MAX_SPEND_PER_TX,
  formatUsdc,
} from "@/lib/constants";
import { easeStage } from "@/lib/motion";

interface ExposurePanelProps {
  spentToday: bigint;
  lastTx: bigint | null;
  allowedCount: number;
}

export function ExposurePanel({
  spentToday,
  lastTx,
  allowedCount,
}: ExposurePanelProps) {
  const policyCards = [
    {
      label: "Per-tx cap",
      value: `${formatUsdc(DEMO_MAX_SPEND_PER_TX)} USDC`,
      detail: "Any single payment above this is refused pre-execution.",
    },
    {
      label: "Daily cap",
      value: `${formatUsdc(DEMO_MAX_SPEND_PER_DAY)} USDC`,
      detail: "Rolling 24-hour ceiling on agent spend.",
    },
    {
      label: "Allowed counterparties",
      value: `${allowedCount.toString().padStart(2, "0")} addresses`,
      detail: "Payments outside this list are blocked at the executor.",
    },
    {
      label: "Expiry",
      value: "7 days",
      detail: "Manifest auto-expires; must be re-committed to continue.",
    },
  ];

  return (
    <Section
      kicker="Exposure"
      title="Live policy posture"
      subtitle="The guardrails in force right now — each one enforced at the executor, not advisory."
    >
      <div className="flex flex-col gap-10">
        <BudgetGauge
          spentToday={spentToday}
          maxPerDay={DEMO_MAX_SPEND_PER_DAY}
          maxPerTx={DEMO_MAX_SPEND_PER_TX}
          lastTx={lastTx}
        />

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.05 } },
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-rule-subtle"
        >
          {policyCards.map((card) => (
            <motion.div
              key={card.label}
              variants={{
                hidden: { opacity: 0, y: 6 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.36, ease: easeStage },
                },
              }}
              className="flex flex-col gap-2 p-5 bg-bg-surface"
            >
              <span className="eyebrow">{card.label}</span>
              <span
                className="font-display font-medium tracking-tight text-text-primary tnum"
                style={{ fontSize: "var(--t-md)", letterSpacing: "-0.015em" }}
              >
                {card.value}
              </span>
              <span className="text-[11.5px] text-text-tertiary leading-snug">
                {card.detail}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}
