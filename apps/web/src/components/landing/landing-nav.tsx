"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AuthCta } from "./auth-cta";

export function LandingNav() {
  return (
    <motion.header
      className="fixed top-0 inset-x-0 z-40 backdrop-blur-md"
      style={{
        background:
          "linear-gradient(to bottom, oklch(0.12 0.015 260 / 0.85), oklch(0.12 0.015 260 / 0.7))",
      }}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="max-w-[1080px] mx-auto px-6 md:px-10 h-14 flex items-center justify-between hairline-bottom">
        <Link href="/" className="flex items-baseline gap-1.5 group">
          <VaultMark />
          <span
            className="font-display font-semibold tracking-tight text-text-primary leading-none"
            style={{ fontSize: "14px" }}
          >
            INTENT
          </span>
          <span
            className="font-display font-semibold tracking-tight text-accent leading-none"
            style={{ fontSize: "14px" }}
          >
            GUARD
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-7" aria-label="Primary">
          <NavLink href="/theater" label="Theater" />
          <NavLink href="/dashboard" label="Dashboard" />
          <NavLink href="/review" label="Review" />
        </nav>

        <div className="flex items-center gap-3">
          <AuthCta size="md" />
        </div>
      </div>
    </motion.header>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="relative font-mono text-[11.5px] tnum tracking-wider uppercase text-text-tertiary hover:text-text-primary transition-colors"
    >
      {label}
    </Link>
  );
}

function VaultMark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="mr-1"
    >
      <rect
        x="1"
        y="1"
        width="14"
        height="14"
        stroke="currentColor"
        strokeWidth="1"
        className="text-accent"
      />
      <rect
        x="4.5"
        y="4.5"
        width="7"
        height="7"
        transform="rotate(45 8 8)"
        fill="currentColor"
        className="text-accent"
      />
    </svg>
  );
}
