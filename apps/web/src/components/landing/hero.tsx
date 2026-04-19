"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { AuthCta } from "./auth-cta";
import { easeOutExpo, easeStage } from "@/lib/motion";

export function LandingHero() {
  const reduced = useReducedMotion();

  return (
    <section
      className="relative overflow-hidden min-h-[88vh] flex items-center"
      aria-label="Vault introduction"
    >
      {/* Backdrop */}
      <BackdropGrid />
      <BackdropGlow />

      <div className="relative z-10 max-w-[1080px] mx-auto px-6 md:px-10 pt-24 pb-16 w-full grid lg:grid-cols-[1.3fr_1fr] gap-16 items-end">
        <div className="flex flex-col gap-8 min-w-0">
          {/* Kicker */}
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOutExpo }}
          >
            <span className="seq tabular-nums text-accent">00 / IDENTIFY</span>
            <span className="h-px w-10 bg-rule" />
            <span className="eyebrow text-text-tertiary">
              Agent-spend guard · Base Sepolia
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="font-display font-semibold tracking-tight text-text-primary leading-[0.92]"
            style={{ fontSize: "clamp(48px, 6.4vw, 104px)", letterSpacing: "-0.035em" }}
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.08 }}
          >
            A vault door
            <br />
            between{" "}
            <span className="whitespace-nowrap">
              your <span className="text-accent">stablecoin</span>
            </span>
            <br />
            and an{" "}
            <AnimatedCaret reduced={!!reduced} />
            autonomous agent.
          </motion.h1>

          {/* Subcopy */}
          <motion.p
            className="text-text-secondary leading-relaxed max-w-[54ch]"
            style={{ fontSize: "var(--t-md)" }}
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.56, ease: easeOutExpo, delay: 0.24 }}
          >
            Commit the spend envelope up front. The agent acts within caps and
            allowlists; the guard blocks what breaches them and makes recourse
            automatic when the line bends.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex items-center gap-5 flex-wrap pt-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.56, ease: easeOutExpo, delay: 0.38 }}
          >
            <AuthCta size="lg" />
            <Link
              href="/theater"
              className="group inline-flex items-center gap-3 font-display text-[15px] tracking-tight text-text-secondary hover:text-text-primary transition-colors"
            >
              <span
                aria-hidden
                className="inline-flex items-center justify-center h-9 w-9 border border-rule group-hover:border-accent transition-colors"
              >
                <motion.span
                  className="block h-0 w-0 border-y-[6px] border-y-transparent border-l-[9px] border-l-text-tertiary group-hover:border-l-accent transition-colors"
                  style={{ marginLeft: 2 }}
                  animate={reduced ? {} : { x: [0, 2, 0] }}
                  transition={
                    reduced
                      ? {}
                      : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                  }
                />
              </span>
              <span className="leading-tight">
                Watch the system decide
                <span className="block text-[11px] font-mono tnum tracking-wider uppercase text-text-quat mt-0.5 group-hover:text-text-tertiary">
                  live agent runs
                </span>
              </span>
            </Link>
          </motion.div>
        </div>

        {/* Right-side spec card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.66, ease: easeOutExpo, delay: 0.34 }}
          className="hidden lg:flex w-full max-w-[360px] justify-self-end flex-col gap-0 border border-rule bg-bg-surface/60 backdrop-blur-sm"
        >
          <div className="grid grid-cols-[88px_1fr] items-baseline gap-x-4 px-5 py-3 hairline-bottom">
            <span className="eyebrow text-text-secondary">Live spec</span>
            <span className="text-right font-mono text-[10.5px] tnum tracking-wider uppercase text-accent">
              v0.1
            </span>
          </div>
          <SpecRow label="chain" value="Base Sepolia" mono />
          <SpecRow label="chain id" value="84532" mono />
          <SpecRow label="guard" value="GuardedExecutor" mono />
          <SpecRow label="per-tx cap" value="10.0 USD" mono accent />
          <SpecRow label="daily cap" value="50.0 USD" mono accent />
          <SpecRow label="recourse" value="challengeable" />
          <div className="px-5 py-3 hairline-top flex items-center gap-2">
            <motion.span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-success"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="font-mono text-[11px] tnum tracking-wider uppercase text-text-tertiary">
              protocol online
            </span>
          </div>
        </motion.div>
      </div>

      {/* Scroll hint */}
      <motion.div
        aria-hidden
        className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-text-quat"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: easeStage, delay: 1.1 }}
      >
        <span className="eyebrow" style={{ fontSize: "9.5px" }}>
          scroll
        </span>
        <motion.span
          className="block w-px bg-text-quat"
          animate={{ scaleY: [0.2, 1, 0.2], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ height: 28, transformOrigin: "top center" }}
        />
      </motion.div>
    </section>
  );
}

function SpecRow({
  label,
  value,
  mono = false,
  accent = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-baseline gap-x-4 px-5 py-2.5 hairline-bottom last:border-b-0">
      <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat">
        {label}
      </span>
      <span
        className={`min-w-0 text-right text-[12.5px] leading-snug ${mono ? "font-mono tnum" : ""} ${
          accent ? "text-accent" : "text-text-secondary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function AnimatedCaret({ reduced }: { reduced: boolean }) {
  if (reduced) return null;
  return (
    <motion.span
      aria-hidden
      className="inline-block align-baseline w-[0.55ch] bg-accent"
      style={{ height: "0.78em", marginRight: "0.12ch", marginLeft: "-0.04ch" }}
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function BackdropGrid() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none opacity-[0.09]"
      style={{
        backgroundImage:
          "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
        backgroundSize: "72px 72px",
        color: "var(--text-tertiary)",
        maskImage:
          "radial-gradient(ellipse at 50% 35%, #000 0%, #000 55%, transparent 95%)",
      }}
    />
  );
}

function BackdropGlow() {
  return (
    <>
      <motion.div
        aria-hidden
        className="absolute top-[18%] left-[8%] w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, oklch(0.8 0.135 75 / 0.22), transparent 60%)",
          filter: "blur(16px)",
        }}
        animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.05, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute bottom-[4%] right-[6%] w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, oklch(0.55 0.15 260 / 0.3), transparent 60%)",
          filter: "blur(20px)",
        }}
        animate={{ opacity: [0.5, 0.85, 0.5], scale: [1.05, 1, 1.05] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}
