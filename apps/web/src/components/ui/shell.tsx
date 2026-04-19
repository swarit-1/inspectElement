"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import type { ReactNode } from "react";
import { CHAIN_ID, CONTRACT_ADDRESSES, truncateAddress } from "@/lib/constants";

interface ShellProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", seq: "01" },
  { href: "/demo", label: "Scenarios", seq: "02" },
  { href: "/review", label: "Review", seq: "03" },
] as const;

export function Shell({ children }: ShellProps) {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — vault control identity */}
      <aside className="w-[240px] shrink-0 bg-bg-surface flex flex-col border-r border-rule">
        {/* Brand stamp */}
        <div className="px-6 pt-7 pb-5">
          <Link href="/dashboard" className="block group">
            <div className="flex items-baseline gap-1.5">
              <VaultMark />
              <span
                className="font-display font-semibold tracking-tight text-text-primary leading-none"
                style={{ fontSize: "var(--t-md)" }}
              >
                INTENT
              </span>
              <span
                className="font-display font-semibold tracking-tight text-accent leading-none"
                style={{ fontSize: "var(--t-md)" }}
              >
                GUARD
              </span>
            </div>
            <span className="eyebrow mt-2 block text-text-quat">
              Agent guard · v0.1
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="px-3 py-4 flex flex-col gap-px hairline-top hairline-bottom border-rule-subtle">
          {NAV_ITEMS.map(({ href, label, seq }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`
                  group relative flex items-center gap-3
                  pl-3 pr-3 py-2.5
                  text-[13px] tracking-tight
                  transition-colors duration-[--duration-fast]
                  ${
                    active
                      ? "text-text-primary"
                      : "text-text-tertiary hover:text-text-primary"
                  }
                `}
              >
                <span
                  className={`seq tabular-nums ${
                    active ? "text-accent" : "text-text-quat group-hover:text-text-tertiary"
                  }`}
                >
                  {seq}
                </span>
                <span className={active ? "font-medium" : ""}>{label}</span>
                {active && (
                  <span
                    aria-hidden
                    className="ml-auto h-3 w-px bg-accent"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Owner block (if connected) */}
        {isConnected && address && (
          <div className="px-6 py-5 hairline-bottom border-rule-subtle">
            <div className="eyebrow mb-2">Owner key</div>
            <div className="font-mono text-[12px] text-text-secondary tnum break-all leading-relaxed">
              {address.slice(0, 6)}
              <span className="text-text-quat">{address.slice(6, 38)}</span>
              {address.slice(38)}
            </div>
          </div>
        )}

        {/* Footer — deployment stamp */}
        <div className="mt-auto px-6 py-5 border-t border-rule-subtle">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="led-pulse h-1.5 w-1.5 rounded-full bg-success"
              aria-hidden
            />
            <span className="eyebrow text-text-secondary">Base Sepolia</span>
            <span className="seq tabular-nums ml-auto">{CHAIN_ID}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] tnum">
            <dt className="text-text-quat font-mono">Reg</dt>
            <dd className="text-text-tertiary font-mono text-right">
              {truncateAddress(CONTRACT_ADDRESSES.intentRegistry, 4)}
            </dd>
            <dt className="text-text-quat font-mono">Exec</dt>
            <dd className="text-text-tertiary font-mono text-right">
              {truncateAddress(CONTRACT_ADDRESSES.guardedExecutor, 4)}
            </dd>
            <dt className="text-text-quat font-mono">Arb</dt>
            <dd className="text-text-tertiary font-mono text-right">
              {truncateAddress(CONTRACT_ADDRESSES.challengeArbiter, 4)}
            </dd>
          </dl>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 bg-bg-root">
        <div className="max-w-[980px] px-10 py-10 reveal">{children}</div>
      </main>
    </div>
  );
}

/**
 * Vault stamp glyph: a beveled diamond inside a square.
 * Reads as "sealed unit" — better than a generic shield.
 */
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
