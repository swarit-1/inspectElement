"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { useEffect, useState, type ReactNode } from "react";
import {
  CHAIN_ID,
  CONTRACT_ADDRESSES,
  USE_MOCKS,
  truncateAddress,
} from "@/lib/constants";
import { useToast } from "@/components/ui/toast";

interface ShellProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", seq: "01" },
  { href: "/theater", label: "Theater", seq: "02" },
  { href: "/review", label: "Review", seq: "03" },
] as const;

export function Shell({ children }: ShellProps) {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const connectedChainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { toast } = useToast();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const wrongNetwork = isConnected && connectedChainId !== CHAIN_ID;

  useEffect(() => {
    if (wrongNetwork) {
      toast({
        id: "wrong-network",
        variant: "warning",
        title: "Wrong network",
        description: `Switch to Base Sepolia (${CHAIN_ID}) to submit transactions.`,
        duration: 0,
        action: {
          label: "Switch network",
          onClick: () => switchChain({ chainId: CHAIN_ID }),
        },
      });
    }
  }, [wrongNetwork, toast, switchChain]);

  return (
    <div className="flex min-h-screen">
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 px-5 flex items-center justify-between bg-bg-surface border-b border-rule">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileNavOpen((v) => !v)}
          className="flex items-center gap-3 text-text-primary"
        >
          <span className="flex flex-col gap-[3px]">
            <span className="h-px w-4 bg-text-secondary" />
            <span className="h-px w-4 bg-text-secondary" />
            <span className="h-px w-4 bg-text-secondary" />
          </span>
          <span className="flex items-baseline gap-1.5">
            <VaultMark />
            <span
              className="font-display font-semibold tracking-tight leading-none"
              style={{ fontSize: "var(--t-sm)" }}
            >
              INTENT
            </span>
            <span
              className="font-display font-semibold text-accent tracking-tight leading-none"
              style={{ fontSize: "var(--t-sm)" }}
            >
              GUARD
            </span>
          </span>
        </button>
        <NetworkStatusChip
          isConnected={isConnected}
          wrongNetwork={wrongNetwork}
          address={address}
          compact
        />
      </header>

      {/* Sidebar — vault control identity */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40 w-[240px] shrink-0
          bg-bg-surface flex flex-col border-r border-rule
          transform transition-transform duration-[--duration-normal] ease-[--ease-out-expo]
          ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
        `}
      >
        {/* Brand stamp */}
        <div className="px-6 pt-7 pb-5">
          <Link
            href="/dashboard"
            className="block group"
            onClick={() => setMobileNavOpen(false)}
          >
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
              Agent guard · v0.1{USE_MOCKS && <span className="text-accent"> · MOCK</span>}
            </span>
          </Link>
        </div>

        {/* Connection pill */}
        <div className="px-6 pb-4">
          <NetworkStatusChip
            isConnected={isConnected}
            wrongNetwork={wrongNetwork}
            address={address}
            isSwitching={isSwitching}
            onSwitch={() => switchChain({ chainId: CHAIN_ID })}
            onDisconnect={() => disconnect()}
          />
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
                    active
                      ? "text-accent"
                      : "text-text-quat group-hover:text-text-tertiary"
                  }`}
                >
                  {seq}
                </span>
                <span className={active ? "font-medium" : ""}>{label}</span>
                {active && (
                  <span aria-hidden className="ml-auto h-3 w-px bg-accent" />
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

      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="lg:hidden fixed inset-0 z-30 bg-bg-root/70 backdrop-blur-[2px]"
        />
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 bg-bg-root pt-14 lg:pt-0">
        <div className="max-w-[980px] px-5 md:px-8 lg:px-10 py-8 lg:py-10 reveal">
          {children}
        </div>
      </main>
    </div>
  );
}

function NetworkStatusChip({
  isConnected,
  wrongNetwork,
  address,
  isSwitching,
  onSwitch,
  onDisconnect,
  compact,
}: {
  isConnected: boolean;
  wrongNetwork: boolean;
  address?: string;
  isSwitching?: boolean;
  onSwitch?: () => void;
  onDisconnect?: () => void;
  compact?: boolean;
}) {
  if (!isConnected) {
    return (
      <div
        className={`flex items-center gap-2 ${compact ? "" : "py-2 px-3 bg-bg-inset border border-rule"}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-text-quat" />
        <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-tertiary">
          Disconnected
        </span>
      </div>
    );
  }
  if (wrongNetwork) {
    return (
      <div
        className={`flex items-center gap-2 ${
          compact ? "" : "py-2 px-3 bg-warning-dim/40 border border-warning/30"
        }`}
      >
        <span className="led-pulse h-1.5 w-1.5 rounded-full bg-warning" />
        <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-warning">
          Wrong network
        </span>
        {!compact && onSwitch && (
          <button
            type="button"
            onClick={onSwitch}
            className="ml-auto text-[10.5px] tnum tracking-wider uppercase text-warning hover:text-warning/80 underline-offset-4 hover:underline"
          >
            {isSwitching ? "Switching…" : "Switch →"}
          </button>
        )}
      </div>
    );
  }
  return (
    <div
      className={`flex items-center gap-2 ${
        compact ? "" : "py-2 px-3 bg-bg-inset border border-rule-subtle"
      }`}
    >
      <span className="led-pulse h-1.5 w-1.5 rounded-full bg-success" />
      <span
        className={`font-mono ${compact ? "text-[10.5px]" : "text-[11px]"} tnum tracking-wider uppercase text-text-secondary`}
      >
        {compact ? "Live" : "Connected"}
      </span>
      {!compact && address && (
        <span className="font-mono text-[11px] tnum text-text-tertiary ml-auto">
          {truncateAddress(address, 4)}
        </span>
      )}
      {!compact && onDisconnect && (
        <button
          type="button"
          onClick={onDisconnect}
          className="text-[10.5px] tnum tracking-wider uppercase text-text-quat hover:text-text-secondary underline-offset-4 hover:underline"
        >
          ×
        </button>
      )}
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
