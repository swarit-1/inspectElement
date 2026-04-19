"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FadeIn } from "@/components/ui/fade-in";
import { AuthCta } from "./auth-cta";
import { easeStage } from "@/lib/motion";

export function ClosingCta() {
  return (
    <section
      className="relative py-28 md:py-36 overflow-hidden"
      aria-label="Get started"
    >
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] h-[680px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, oklch(0.8 0.135 75 / 0.18), transparent 65%)",
          filter: "blur(24px)",
        }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 max-w-[1080px] mx-auto px-6 md:px-10 flex flex-col items-center gap-10 text-center">
        <FadeIn className="flex flex-col gap-3 items-center">
          <span className="seq tabular-nums text-accent">04 / BEGIN</span>
          <h2
            className="font-display font-semibold tracking-tight text-text-primary"
            style={{
              fontSize: "clamp(48px, 7.6vw, 112px)",
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
            }}
          >
            Constrain the agent.
            <br />
            <span className="text-accent">Keep the autonomy.</span>
          </h2>
        </FadeIn>
        <FadeIn
          delay={0.12}
          className="text-text-secondary max-w-[54ch]"
        >
          <p style={{ fontSize: "var(--t-md)", lineHeight: 1.55 }}>
            Connect the owner wallet. Commit an intent. Delegate the agent. The
            rest is watching the guard do the work — in public, on-chain, with
            recourse baked in.
          </p>
        </FadeIn>
        <FadeIn
          delay={0.22}
          className="flex items-center gap-5 flex-wrap justify-center"
        >
          <AuthCta size="lg" />
          <Link
            href="/theater"
            className="font-mono text-[12px] tnum tracking-wider uppercase text-text-tertiary hover:text-text-primary underline-offset-4 hover:underline"
          >
            open live runs →
          </Link>
        </FadeIn>
        <motion.div
          aria-hidden
          className="mt-6 h-px w-24 bg-rule"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.68, ease: easeStage, delay: 0.3 }}
          style={{ transformOrigin: "center" }}
        />
      </div>
    </section>
  );
}
