"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { FadeIn } from "@/components/ui/fade-in";
import { easeOutExpo, easeStage } from "@/lib/motion";

const NODES = [
  { id: "owner", label: "Owner", seq: "N-01", x: 6 },
  { id: "agent", label: "Agent", seq: "N-02", x: 28 },
  { id: "guard", label: "Guard", seq: "N-03", x: 52 },
  { id: "target", label: "Target", seq: "N-04", x: 76 },
  { id: "receipt", label: "Receipt", seq: "N-05", x: 94 },
];

export function TheaterPreview() {
  const reduced = useReducedMotion();

  return (
    <section
      className="relative py-24 md:py-32 overflow-hidden"
      aria-label="Theater preview"
    >
      <BackdropStripes />

      <div className="relative z-10 max-w-[1080px] mx-auto px-6 md:px-10">
        <div className="grid lg:grid-cols-[1fr_auto] gap-10 items-end mb-10">
          <FadeIn className="flex flex-col gap-3 max-w-[54ch]">
            <div className="flex items-center gap-3">
              <span className="seq tabular-nums text-accent">03 / SEE IT</span>
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
              A cinematic of the loop.
            </h2>
            <p
              className="text-text-secondary"
              style={{ fontSize: "var(--t-md)", lineHeight: 1.55 }}
            >
              Three scripted runs — legit payment, blocked attack, overspend —
              stage every beat from owner intent through guard decision to
              receipt. Watch one, then run them yourself.
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <Link
              href="/theater"
              className="group inline-flex items-center gap-2 font-mono text-[12px] tnum tracking-wider uppercase text-accent hover:text-accent-bright underline-offset-4 hover:underline"
            >
              open full theater
              <span aria-hidden>→</span>
            </Link>
          </FadeIn>
        </div>

        <motion.div
          className="relative border border-rule bg-bg-surface/60 backdrop-blur-sm overflow-hidden"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-8% 0px" }}
          transition={{ duration: 0.68, ease: easeOutExpo }}
        >
          <div className="flex items-center justify-between px-5 py-3 hairline-bottom">
            <div className="flex items-center gap-3">
              <span className="eyebrow text-accent">S-01</span>
              <span className="font-mono text-[11px] tnum text-text-tertiary">
                legit payment · 2.0 USD → allowlisted merchant
              </span>
            </div>
            <motion.span
              aria-hidden
              className="inline-flex items-center gap-1.5 font-mono text-[10px] tnum tracking-wider uppercase"
              style={{ color: "var(--accent-bright)" }}
              animate={{ opacity: [0.55, 1, 0.55] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <span
                className="block"
                style={{
                  width: 5,
                  height: 5,
                  background: "var(--accent-bright)",
                }}
              />
              rolling
            </motion.span>
          </div>

          <PreviewStage reduced={!!reduced} />

          <div className="px-5 py-3 hairline-top flex items-center justify-between">
            <span className="font-mono text-[11px] tnum text-text-tertiary">
              allow · cap · daily → guard co-signs → receipt minted
            </span>
            <Link
              href="/theater"
              className="font-mono text-[11px] tnum text-text-tertiary hover:text-text-primary underline-offset-4 hover:underline"
            >
              /theater →
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function PreviewStage({ reduced }: { reduced: boolean }) {
  const packetAnim = reduced
    ? { left: "52%" }
    : {
        left: ["6%", "28%", "52%", "52%", "76%", "94%", "6%"],
      };
  const trailAnim = reduced
    ? { right: "48%" }
    : {
        right: ["94%", "72%", "48%", "48%", "24%", "6%", "94%"],
      };
  const transition = reduced
    ? { duration: 0 }
    : {
        duration: 7,
        times: [0, 0.15, 0.32, 0.48, 0.64, 0.84, 1],
        ease: easeStage,
        repeat: Infinity,
      };

  return (
    <div className="relative h-[220px] overflow-hidden">
      <Scanlines />
      <div
        aria-hidden
        className="absolute left-[4%] right-[3%] top-1/2 h-px"
        style={{ background: "var(--rule)" }}
      />
      <motion.div
        aria-hidden
        className="absolute left-[4%] top-1/2 h-px"
        animate={trailAnim}
        transition={transition}
        style={{
          background: "var(--accent-dim)",
          opacity: 0.9,
        }}
      />
      {NODES.map((n) => (
        <div
          key={n.id}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 w-[90px]"
          style={{ left: `${n.x}%` }}
        >
          <span
            aria-hidden
            className="block"
            style={{
              width: 9,
              height: 9,
              background:
                n.id === "guard" ? "var(--accent-bright)" : "var(--text-tertiary)",
            }}
          />
          <div className="flex flex-col items-center gap-0.5 mt-2">
            <span className="font-mono text-[9.5px] tnum tracking-wider uppercase text-text-quat">
              {n.seq}
            </span>
            <span className="font-mono text-[10px] tnum tracking-wide uppercase text-text-tertiary">
              {n.label}
            </span>
          </div>
        </div>
      ))}
      <motion.div
        aria-hidden
        className="absolute top-1/2 pointer-events-none"
        animate={packetAnim}
        transition={transition}
        style={{ translateX: "-50%", translateY: "-50%" }}
      >
        <span
          className="block"
          style={{
            width: 14,
            height: 14,
            transform: "rotate(45deg)",
            background: "var(--accent-bright)",
            boxShadow: "0 0 0 5px var(--bg-root)",
          }}
        />
      </motion.div>
    </div>
  );
}

function Scanlines() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.05]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent 0 2px, currentColor 2px 3px)",
        color: "var(--text-primary)",
      }}
    />
  );
}

function BackdropStripes() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none opacity-[0.06]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 36px)",
        color: "var(--accent-bright)",
      }}
    />
  );
}
