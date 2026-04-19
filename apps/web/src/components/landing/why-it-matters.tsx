"use client";

import { motion } from "framer-motion";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/fade-in";
import { easeStage } from "@/lib/motion";

const THREATS = [
  {
    seq: "T-01",
    name: "Prompt injection",
    line: "The agent is told to drain the wallet.",
    detail:
      "A hostile prompt embedded in a webpage, document, or API response redirects spend. Without guard-level policy, the model executes. With Vault, the counterparty fails allowlist, guard rejects — no funds leave.",
    tone: "danger" as const,
  },
  {
    seq: "T-02",
    name: "Behavioral drift",
    line: "The agent starts spending too aggressively.",
    detail:
      "Plan mutations, reasoning loops, or bad tool chains push spend past safe thresholds. Per-tx and daily caps clamp the envelope at the protocol; drift becomes a challengeable receipt, not a liquidated wallet.",
    tone: "warning" as const,
  },
  {
    seq: "T-03",
    name: "Constrained autonomy",
    line: "You want agent speed without trust debt.",
    detail:
      "Manual review per-transaction isn't autonomy; full blank-check isn't responsible. Vault encodes the owner's envelope once, then lets the agent move at its own pace inside it.",
    tone: "accent" as const,
  },
];

export function WhyItMatters() {
  return (
    <section
      className="relative py-24 md:py-32"
      aria-label="Why this matters"
    >
      <div className="max-w-[1080px] mx-auto px-6 md:px-10">
        <FadeIn className="flex flex-col gap-3 mb-14 max-w-[56ch]">
          <div className="flex items-center gap-3">
            <span className="seq tabular-nums text-accent">02 / STAKES</span>
            <span className="h-px w-12 bg-rule" />
          </div>
          <h2
            className="font-display font-semibold tracking-tight text-text-primary"
            style={{
              fontSize: "clamp(36px, 5.4vw, 64px)",
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
            }}
          >
            Autonomous agents already spend real money.
            <br />
            <span className="text-text-tertiary">
              They don&apos;t yet spend it safely.
            </span>
          </h2>
        </FadeIn>

        <Stagger className="flex flex-col gap-0" stagger={0.1}>
          {THREATS.map((t, i) => (
            <StaggerItem
              key={t.seq}
              as="article"
              className="group relative grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_1fr] gap-6 md:gap-10 py-8 md:py-10 hairline-bottom last:border-b-0"
            >
              <div className="flex flex-col gap-2">
                <span className="seq tabular-nums text-text-tertiary">
                  {t.seq}
                </span>
                <motion.span
                  aria-hidden
                  className="block h-px w-10"
                  style={{
                    background:
                      t.tone === "danger"
                        ? "var(--status-danger)"
                        : t.tone === "warning"
                          ? "var(--status-warning)"
                          : "var(--accent-bright)",
                  }}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.56,
                    ease: easeStage,
                    delay: 0.1 + i * 0.08,
                  }}
                />
              </div>
              <div className="flex flex-col gap-2 min-w-0">
                <h3
                  className="font-display font-semibold tracking-tight text-text-primary"
                  style={{
                    fontSize: "var(--t-xl)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {t.name}
                </h3>
                <p
                  className="text-text-secondary"
                  style={{ fontSize: "var(--t-md)", lineHeight: 1.45 }}
                >
                  {t.line}
                </p>
              </div>
              <p
                className="text-text-tertiary md:pl-6 md:border-l md:border-rule-subtle"
                style={{ fontSize: "13px", lineHeight: 1.65 }}
              >
                {t.detail}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
