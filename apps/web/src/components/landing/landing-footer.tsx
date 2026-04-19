"use client";

import Link from "next/link";
import { CHAIN_ID, CONTRACT_ADDRESSES, truncateAddress } from "@/lib/constants";

export function LandingFooter() {
  return (
    <footer className="relative hairline-top">
      <div className="max-w-[1080px] mx-auto px-6 md:px-10 py-10 grid gap-8 md:grid-cols-[auto_1fr_auto] items-start">
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-display font-semibold tracking-tight text-accent leading-none"
            style={{ fontSize: "var(--t-md)" }}
          >
            VAULT
          </span>
        </div>

        <nav
          className="flex items-center gap-6 flex-wrap"
          aria-label="Footer navigation"
        >
          <FooterLink href="/dashboard" label="Dashboard" seq="01" />
          <FooterLink href="/theater" label="Live runs" seq="02" />
          <FooterLink href="/review" label="Review" seq="03" />
        </nav>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] tnum font-mono">
          <dt className="text-text-quat">Chain</dt>
          <dd className="text-text-tertiary text-right">Base Sepolia · {CHAIN_ID}</dd>
          <dt className="text-text-quat">Exec</dt>
          <dd className="text-text-tertiary text-right">
            {truncateAddress(CONTRACT_ADDRESSES.guardedExecutor, 4)}
          </dd>
          <dt className="text-text-quat">Build</dt>
          <dd className="text-text-tertiary text-right">v0.1 · preview</dd>
        </dl>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  label,
  seq,
}: {
  href: string;
  label: string;
  seq: string;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-baseline gap-2 text-text-tertiary hover:text-text-primary transition-colors"
    >
      <span className="seq tabular-nums text-text-quat group-hover:text-accent transition-colors">
        {seq}
      </span>
      <span className="text-[13px]">{label}</span>
    </Link>
  );
}
