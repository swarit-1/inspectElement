"use client";

import { motion } from "framer-motion";
import { easeStage, viewportOnce } from "@/lib/motion";

const PILLARS = [
  { label: "Allowlists", detail: "Only owner-approved counterparties." },
  { label: "Per-tx cap", detail: "Hard ceiling on a single spend." },
  { label: "Daily cap", detail: "Rolling 24h envelope." },
  { label: "Receipts", detail: "Every execution recorded forensically." },
  { label: "Recourse", detail: "Challengeable overspends, stake-backed." },
];

export function ProofStrip() {
  return (
    <section aria-label="Protocol guarantees" className="relative">
      <div className="max-w-[1080px] mx-auto px-6 md:px-10">
        <div className="hairline-top hairline-bottom grid grid-cols-2 md:grid-cols-5 gap-0">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.label}
              className={`
                group relative flex flex-col gap-2 py-5 px-4
                ${i < PILLARS.length - 1 ? "md:border-r md:border-rule-subtle" : ""}
                ${i < PILLARS.length - 2 ? "md:[&]:border-b-0" : ""}
                ${i < PILLARS.length - 1 && i % 2 === 0 ? "border-r border-rule-subtle" : ""}
                ${i < PILLARS.length - 1 ? "hairline-bottom md:border-b-0" : ""}
              `}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewportOnce}
              transition={{
                duration: 0.48,
                ease: easeStage,
                delay: i * 0.06,
              }}
            >
              <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className="font-display font-medium text-text-primary tracking-tight"
                style={{ fontSize: "15px", letterSpacing: "-0.01em" }}
              >
                {p.label}
              </span>
              <span
                className="text-text-tertiary leading-snug"
                style={{ fontSize: "11.5px" }}
              >
                {p.detail}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
