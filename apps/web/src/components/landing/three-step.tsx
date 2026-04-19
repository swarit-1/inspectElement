"use client";

import { motion } from "framer-motion";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/fade-in";
import { easeStage } from "@/lib/motion";

const STEPS = [
  {
    seq: "01",
    name: "Define intent",
    line: "A signed manifest — caps, counterparties, expiry.",
    detail:
      "The owner writes a single commitment: what the agent can spend, with whom, within what window. Registered on-chain. Nothing runs without it.",
    glyph: <GlyphDefine />,
  },
  {
    seq: "02",
    name: "Let the agent act",
    line: "Every action passes through the guard.",
    detail:
      "The agent proposes. The guard checks allowlist, per-tx, and daily caps against the same on-chain intent. Breaches are rejected pre-execution — USDC never moves.",
    glyph: <GlyphAgent />,
  },
  {
    seq: "03",
    name: "Challenge missteps",
    line: "Overspends stay recoverable.",
    detail:
      "If an execution bends the line — say, a per-tx breach past the cap — the receipt is challengeable. Operator stake covers the delta; recourse is protocol-level, not a support ticket.",
    glyph: <GlyphChallenge />,
  },
];

export function ThreeStep() {
  return (
    <section
      className="relative py-24 md:py-32"
      aria-label="How Vault works"
    >
      <div className="max-w-[1080px] mx-auto px-6 md:px-10">
        <FadeIn className="flex flex-col gap-3 mb-14 max-w-[48ch]">
          <div className="flex items-center gap-3">
            <span className="seq tabular-nums text-accent">01 / FLOW</span>
            <span className="h-px w-12 bg-rule" />
          </div>
          <h2
            className="font-display font-semibold tracking-tight text-text-primary"
            style={{
              fontSize: "clamp(38px, 5.6vw, 72px)",
              lineHeight: 1,
              letterSpacing: "-0.025em",
            }}
          >
            Three beats.
            <br />
            <span className="text-text-tertiary">Everything else is noise.</span>
          </h2>
        </FadeIn>

        <Stagger
          className="grid md:grid-cols-3 gap-0 hairline-top hairline-bottom"
          stagger={0.12}
        >
          {STEPS.map((s, i) => (
            <StaggerItem
              key={s.seq}
              as="article"
              className={`
                group relative flex flex-col gap-6 p-7 md:p-8
                ${i < STEPS.length - 1 ? "md:border-r md:border-rule-subtle" : ""}
                ${i < STEPS.length - 1 ? "hairline-bottom md:border-b-0" : ""}
              `}
            >
              <div className="flex items-center justify-between">
                <span className="seq tabular-nums text-accent">{s.seq}</span>
                <motion.span
                  aria-hidden
                  className="block h-px bg-rule"
                  whileInView={{ scaleX: 1 }}
                  initial={{ scaleX: 0 }}
                  viewport={{ once: true, margin: "-10% 0px" }}
                  transition={{
                    duration: 0.6,
                    ease: easeStage,
                    delay: 0.1 + i * 0.08,
                  }}
                  style={{ width: 80, transformOrigin: "right center" }}
                />
              </div>
              <div className="h-20 w-20 -mt-2">{s.glyph}</div>
              <div className="flex flex-col gap-3">
                <h3
                  className="font-display font-semibold tracking-tight text-text-primary"
                  style={{ fontSize: "var(--t-xl)", letterSpacing: "-0.02em" }}
                >
                  {s.name}
                </h3>
                <p
                  className="text-text-secondary"
                  style={{ fontSize: "14.5px", lineHeight: 1.55 }}
                >
                  {s.line}
                </p>
                <p
                  className="text-text-tertiary"
                  style={{ fontSize: "13px", lineHeight: 1.6 }}
                >
                  {s.detail}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function GlyphDefine() {
  return (
    <motion.svg
      viewBox="0 0 80 80"
      className="h-full w-full text-accent"
      fill="none"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: easeStage }}
    >
      <motion.rect
        x="10"
        y="14"
        width="60"
        height="52"
        stroke="currentColor"
        strokeWidth="1"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: easeStage }}
      />
      <line
        x1="18"
        y1="26"
        x2="52"
        y2="26"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.7"
      />
      <line
        x1="18"
        y1="34"
        x2="44"
        y2="34"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
      />
      <line
        x1="18"
        y1="42"
        x2="58"
        y2="42"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
      />
      <motion.path
        d="M48 52 L58 60 L48 68"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="none"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.6 }}
      />
    </motion.svg>
  );
}

function GlyphAgent() {
  return (
    <motion.svg
      viewBox="0 0 80 80"
      className="h-full w-full text-accent"
      fill="none"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      <line x1="10" y1="40" x2="70" y2="40" stroke="currentColor" strokeWidth="1" />
      <rect x="8" y="36" width="8" height="8" fill="currentColor" opacity="0.6" />
      <rect x="36" y="32" width="10" height="16" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="38" y1="32" x2="38" y2="48" stroke="currentColor" strokeWidth="1" />
      <line x1="44" y1="32" x2="44" y2="48" stroke="currentColor" strokeWidth="1" />
      <rect x="64" y="36" width="8" height="8" stroke="currentColor" strokeWidth="1" />
      <motion.rect
        x="20"
        y="37.5"
        width="5"
        height="5"
        fill="currentColor"
        initial={{ x: 20 }}
        whileInView={{ x: [20, 33, 33, 54] }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 2.8, ease: easeStage, times: [0, 0.35, 0.65, 1] }}
        style={{ transform: "rotate(45deg)", transformOrigin: "center" }}
      />
    </motion.svg>
  );
}

function GlyphChallenge() {
  return (
    <motion.svg
      viewBox="0 0 80 80"
      className="h-full w-full text-accent"
      fill="none"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      <rect x="14" y="12" width="52" height="40" stroke="currentColor" strokeWidth="1" />
      <line x1="22" y1="24" x2="54" y2="24" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <line x1="22" y1="32" x2="44" y2="32" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <motion.path
        d="M14 52 L40 72 L66 52"
        stroke="currentColor"
        strokeWidth="1"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, delay: 0.3 }}
      />
      <motion.circle
        cx="40"
        cy="32"
        r="4"
        fill="currentColor"
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 1.2 }}
      />
    </motion.svg>
  );
}
