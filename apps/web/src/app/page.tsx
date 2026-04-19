"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAccount, useConnect, useConnectors, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CHAIN_ID,
  CONTRACT_ADDRESSES,
  DEMO_AGENT_STAKE,
  DEMO_CHALLENGE_BOND,
  DEMO_MAX_SPEND_PER_DAY,
  DEMO_MAX_SPEND_PER_TX,
  formatUsdc,
  truncateAddress,
} from "@/lib/constants";

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const connectors = useConnectors();
  const {
    connect,
    isPending: isConnecting,
    error: connectError,
    reset,
  } = useConnect();
  const { disconnect } = useDisconnect();

  const goDashboard = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  useEffect(() => {
    if (isConnected) router.prefetch("/dashboard");
  }, [isConnected, router]);

  const handleConnect = useCallback(() => {
    reset();
    const connector =
      connectors.find((c) => c.id === "injected" || c.type === "injected") ??
      connectors[0] ??
      injected();
    connect({ connector }, { onSuccess: () => goDashboard() });
  }, [connect, connectors, goDashboard, reset]);

  // Scroll-reveal
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const targets = root.querySelectorAll<HTMLElement>("[data-sr], [data-sr-stagger]");
    if (targets.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("sr-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Live "block height" micro-ticker
  const blockRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let n = 17_482_930;
    const id = window.setInterval(() => {
      n += 1;
      if (blockRef.current) blockRef.current.textContent = n.toLocaleString("en-US");
    }, 2100);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div ref={rootRef} className="relative isolate overflow-x-hidden">
      <div className="vignette-layer" aria-hidden />
      <div className="grain-layer" aria-hidden />

      {/* ────────── TOP BAR ────────── */}
      <header className="relative z-10 border-b border-rule-subtle">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-14 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-1.5 group">
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
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-[12px] font-mono tnum uppercase tracking-[0.14em] text-text-tertiary">
            <a href="#threat" className="link-slide hover:text-text-primary transition-colors">Threat</a>
            <a href="#vault" className="link-slide hover:text-text-primary transition-colors">Vault</a>
            <a href="#scenarios" className="link-slide hover:text-text-primary transition-colors">Scenarios</a>
            <a href="#recourse" className="link-slide hover:text-text-primary transition-colors">Recourse</a>
          </nav>

          <div className="flex items-center gap-3">
            {isConnected && address ? (
              <>
                <span className="hidden sm:inline-flex items-center gap-2 font-mono text-[11px] tnum uppercase tracking-[0.14em] text-text-secondary">
                  <span className="led-pulse h-1.5 w-1.5 rounded-full bg-success" />
                  {truncateAddress(address, 4)}
                </span>
                <Button size="sm" onClick={goDashboard}>
                  Enter vault →
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleConnect} loading={isConnecting}>
                Connect wallet →
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ────────── HERO ────────── */}
      <section className="relative z-10 min-h-[100dvh] flex flex-col">
        <div className="flex-1 max-w-[1440px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-0 px-5 md:px-8 lg:px-14 pt-10 md:pt-14 pb-12">
          {/* LEFT COLUMN ·· 8/12 */}
          <div className="lg:col-span-8 flex flex-col justify-between gap-14 lg:gap-24">
            <div className="flex items-center gap-5 reveal">
              <span className="seq tabular-nums">FILE · 00.01</span>
              <span className="h-px w-14 bg-rule" />
              <span className="eyebrow">Base Sepolia · USDC · live</span>
              <span className="seq tabular-nums ml-auto hidden md:inline">{formatLocalTime()}</span>
            </div>

            <div className="reveal reveal-d1">
              <h1 className="kinetic text-text-primary">
                <span className="block">
                  Guard{" "}
                  <span className="text-text-tertiary italic tracking-tighter">layer</span>
                </span>
                <span className="block">
                  for <span className="text-accent">agent</span>
                </span>
                <span className="block kinetic-outline">payments.</span>
              </h1>
              <p className="mt-10 max-w-[54ch] text-text-secondary leading-relaxed text-[15px] md:text-[17px]">
                A cryptographic vault door between your stablecoin balance and an autonomous
                agent. Commit a spending envelope on-chain, let a delegated key operate inside
                it, and when something slips through the checks, slash the operator stake to
                make yourself whole.
              </p>
            </div>

            <div className="reveal reveal-d2 flex flex-col gap-5 hairline-top pt-8">
              <div className="flex flex-wrap items-center gap-6">
                {!isConnected ? (
                  <Button
                    size="lg"
                    onClick={handleConnect}
                    loading={isConnecting}
                    disabled={isConnecting}
                  >
                    Connect wallet →
                  </Button>
                ) : (
                  <Button size="lg" onClick={goDashboard}>
                    Enter vault →
                  </Button>
                )}
                <a
                  href="#scenarios"
                  className="group inline-flex items-center gap-3 text-text-secondary hover:text-text-primary transition-colors"
                >
                  <span
                    className="inline-flex items-center justify-center w-9 h-9 border border-rule group-hover:border-accent group-hover:text-accent transition-colors"
                    aria-hidden
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 1 L8 5 L2 9" stroke="currentColor" strokeWidth="1.3" />
                    </svg>
                  </span>
                  <span className="font-mono text-[11.5px] uppercase tracking-[0.18em]">
                    Inspect three runs
                  </span>
                </a>
                <span className="font-mono text-[11px] tnum text-text-quat">
                  Base Sepolia · Injected wallet · chainId {CHAIN_ID}
                </span>
              </div>
              {connectError && (
                <p
                  role="alert"
                  aria-live="polite"
                  className="text-[13px] text-danger leading-relaxed max-w-[52ch]"
                >
                  {formatWalletError(connectError)}
                </p>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN ·· 4/12 — Ops console */}
          <aside className="lg:col-span-4 hidden lg:flex flex-col gap-10 pl-14 mt-4 border-l border-rule reveal reveal-d3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="breath h-1.5 w-1.5 rounded-full bg-success" />
                <span className="eyebrow text-text-secondary">OPS · live</span>
              </div>
              <span className="seq tabular-nums">ID-4477</span>
            </div>

            <div className="relative crosshair p-5 bg-bg-inset border border-rule scanlines">
              <div className="flex items-center justify-between mb-4">
                <span className="eyebrow">Live block</span>
                <span className="font-mono text-[10.5px] tracking-wider text-text-quat">
                  base-sepolia
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  ref={blockRef}
                  className="font-mono tnum text-text-primary"
                  style={{ fontSize: "var(--t-xl)" }}
                >
                  17,482,930
                </span>
                <span className="font-mono text-[11px] text-text-quat">blk</span>
              </div>
              <div className="mt-5 hairline-top pt-4 grid grid-cols-2 gap-y-2 gap-x-3 text-[11px] tnum font-mono">
                <span className="text-text-quat">Executor</span>
                <span className="text-text-secondary text-right">
                  {truncateAddress(CONTRACT_ADDRESSES.guardedExecutor, 4)}
                </span>
                <span className="text-text-quat">Registry</span>
                <span className="text-text-secondary text-right">
                  {truncateAddress(CONTRACT_ADDRESSES.intentRegistry, 4)}
                </span>
                <span className="text-text-quat">Arbiter</span>
                <span className="text-text-secondary text-right">
                  {truncateAddress(CONTRACT_ADDRESSES.challengeArbiter, 4)}
                </span>
              </div>
            </div>

            <SpecGrid />

            <div className="flex items-end justify-between hairline-top pt-6">
              <div className="flex flex-col gap-1.5">
                <span className="eyebrow">Scroll to inspect</span>
                <span className="font-mono text-[11px] tnum text-text-quat">
                  01 · 02 · 03 · 04
                </span>
              </div>
              <svg width="14" height="22" viewBox="0 0 14 22" className="scroll-cue-dot text-accent">
                <rect x="1" y="1" width="12" height="20" rx="6" fill="none" stroke="currentColor" />
                <circle cx="7" cy="7" r="1.5" fill="currentColor" />
              </svg>
            </div>
          </aside>
        </div>

        {/* MARQUEE — bottom of hero */}
        <MarqueeStrip />
      </section>

      {/* ────────── 01 · THREAT ────────── */}
      <section
        id="threat"
        className="relative z-10 border-t border-rule-subtle"
      >
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-14 py-24 md:py-36 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          <div className="lg:col-span-3" data-sr>
            <SectionHeader seq="01" label="The threat" />
          </div>
          <div className="lg:col-span-6 flex flex-col gap-8" data-sr>
            <h2 className="kinetic-lg text-text-primary">
              Identity is not{" "}
              <span className="text-text-tertiary italic">enough</span> once an agent
              can move <span className="text-accent">stablecoins</span>.
            </h2>
            <p className="text-text-secondary leading-relaxed max-w-[62ch] text-[15px]">
              A valid agent can still be tricked by prompt injection or drift into
              actions the user never approved. Wallet signatures prove{" "}
              <em className="text-text-primary not-italic">who</em>. They do not prove{" "}
              <em className="text-text-primary not-italic">what</em>. The missing
              primitive is not &ldquo;can the agent pay&rdquo; — it is &ldquo;did this payment match
              the user-approved intent, and what happens if it didn&apos;t.&rdquo;
            </p>
          </div>
          <aside className="lg:col-span-3" data-sr>
            <ThreatLedger />
          </aside>
        </div>
      </section>

      {/* ────────── 02 · VAULT ────────── */}
      <section id="vault" className="relative z-10 border-t border-rule-subtle bg-bg-surface/40">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-14 py-24 md:py-36 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          <div className="lg:col-span-4" data-sr>
            <SectionHeader seq="02" label="The vault door" />
            <h2 className="kinetic-lg text-text-primary mt-6">
              Three hardened<br />controls.
            </h2>
            <p className="text-text-secondary leading-relaxed max-w-[42ch] text-[15px] mt-6">
              Commit. Delegate. Recourse. Each step is signed, stored on-chain, and
              legible to any auditor without our infrastructure in the loop.
            </p>
          </div>
          <div className="lg:col-span-8 flex flex-col" data-sr-stagger>
            <Pillar
              seq="01"
              name="Commit intent"
              desc="Per-tx and per-day caps, allowlisted counterparties, expiry window, USDC-only. The hash pins in IntentRegistry, the manifest pins in storage."
              code="commitIntent(bytes32, IntentConfig, string)"
            />
            <Pillar
              seq="02"
              name="Delegate the key"
              desc="Authorize one delegate key to a single agentId. Stake-backed. Revocable in a single transaction."
              code="setAgentDelegate(bytes32, address, bool)"
            />
            <Pillar
              seq="03"
              name="Post-exec recourse"
              desc="Every receipt is challengeable. If the executed amount exceeded the manifest cap, ChallengeArbiter slashes operator stake and pays the user."
              code="fileAmountViolation(bytes32 receiptId)"
            />
          </div>
        </div>
      </section>

      {/* ────────── 03 · SCENARIOS ────────── */}
      <section id="scenarios" className="relative z-10 border-t border-rule-subtle">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-14 py-24 md:py-36">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-16 lg:mb-24">
            <div className="lg:col-span-4" data-sr>
              <SectionHeader seq="03" label="Scenarios" />
            </div>
            <div className="lg:col-span-8" data-sr>
              <h2 className="kinetic-lg text-text-primary">
                Three runs,{" "}
                <span className="text-text-tertiary italic">one</span> vault.
              </h2>
              <p className="text-text-secondary leading-relaxed max-w-[58ch] text-[15px] mt-6">
                Drop the same agent into three prompts — one legitimate, two adversarial.
                The guard either lets it through, rejects it outright, or lets the user
                claw it back through the challenge path.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" data-sr-stagger>
            <ScenarioCard
              tone="success"
              index="A"
              badge="LEGIT"
              title="2 USDC to an allowlisted vendor"
              target="0x0…0a01"
              amount="2.000000"
              cap="10.000000"
              outcome="GREEN · ActionReceipt emitted"
              trace={[
                ["user", "pay the weather API"],
                ["tool", "fetch · /v1/forecast"],
                ["plan", "2 USDC → vendor"],
                ["guard", "OK · within envelope"],
                ["chain", "receipt 0xa4…91f"],
              ]}
            />
            <ScenarioCard
              tone="danger"
              index="B"
              badge="BLOCKED"
              title="20 USDC to an unknown address"
              target="0xde…ad42"
              amount="20.000000"
              cap="allowlist"
              outcome="RED · COUNTERPARTY_NOT_ALLOWED"
              trace={[
                ["user", "pay the weather API"],
                ["tool", "injected · new recipient"],
                ["plan", "20 USDC → 0xde…ad42"],
                ["guard", "REVERT · not in allowlist"],
                ["chain", "preflight reason recorded"],
              ]}
            />
            <ScenarioCard
              tone="warning"
              index="C"
              badge="OVERSPEND → CHALLENGE"
              title="15 USDC to an allowlisted vendor"
              target="0x0…0a01"
              amount="15.000000"
              cap="10.000000"
              outcome="YELLOW · slash upheld · 15 USDC returned"
              trace={[
                ["user", "renew the pro plan"],
                ["tool", "injected · inflate amount"],
                ["plan", "15 USDC → vendor"],
                ["guard", "PASS (amount slash-only)"],
                ["user", "file AmountViolation"],
                ["arbiter", "stake slashed · 15 USDC out"],
              ]}
            />
          </div>

          <div
            className="mt-16 md:mt-24 flex flex-wrap items-center justify-between gap-8 hairline-top pt-8"
            data-sr
          >
            <div className="flex flex-col gap-2 max-w-[44ch]">
              <span className="eyebrow">Drive each run live</span>
              <p className="text-text-secondary text-[14px] leading-relaxed">
                Once you&apos;re in the vault you can trigger all three scenarios against
                real Base Sepolia contracts from the Scenarios panel.
              </p>
            </div>
            <div className="flex items-center gap-5">
              <Link href="/demo" className="group inline-flex items-center gap-3">
                <Button size="md" variant="secondary">
                  Open scenarios →
                </Button>
              </Link>
              {!isConnected ? (
                <Button size="md" onClick={handleConnect} loading={isConnecting}>
                  Connect wallet
                </Button>
              ) : (
                <Button size="md" onClick={goDashboard}>
                  Enter vault →
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ────────── 04 · RECOURSE ────────── */}
      <section id="recourse" className="relative z-10 border-t border-rule-subtle bg-bg-surface/40">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-14 py-24 md:py-36 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          <div className="lg:col-span-5 flex flex-col gap-8" data-sr>
            <SectionHeader seq="04" label="Recourse" />
            <h2 className="kinetic-lg text-text-primary">
              When the guard misses, the{" "}
              <span className="text-accent">stake</span> pays.
            </h2>
            <p className="text-text-secondary leading-relaxed max-w-[48ch] text-[15px]">
              Every receipt is on-chain. Every over-spend is deterministically
              provable. ChallengeArbiter opens a bond, reads the receipt, and pulls
              from StakeVault — no committee vote, no waiting for a review queue.
            </p>

            <ul className="flex flex-col mt-4" data-sr-stagger>
              <LedgerRow
                tag="stake"
                label="Operator stake"
                value={formatUsdc(DEMO_AGENT_STAKE)}
                unit="USDC"
              />
              <LedgerRow
                tag="bond"
                label="Challenge bond"
                value={formatUsdc(DEMO_CHALLENGE_BOND)}
                unit="USDC"
              />
              <LedgerRow
                tag="cap"
                label="Per-tx cap"
                value={formatUsdc(DEMO_MAX_SPEND_PER_TX)}
                unit="USDC"
              />
              <LedgerRow
                tag="day"
                label="Per-day cap"
                value={formatUsdc(DEMO_MAX_SPEND_PER_DAY)}
                unit="USDC"
              />
            </ul>
          </div>

          <div className="lg:col-span-7" data-sr>
            <RecourseDiagram />
          </div>
        </div>
      </section>

      {/* ────────── FOOTER CTA ────────── */}
      <section className="relative z-10 border-t border-rule-subtle">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-14 pt-24 md:pt-32 pb-14">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10 mb-16 md:mb-24" data-sr>
            <div className="flex flex-col gap-5 max-w-[56ch]">
              <SectionHeader seq="05" label="Enter the vault" />
              <h2 className="kinetic-lg text-text-primary">
                The guard is live.<br />
                <span className="text-accent italic">Your</span> envelope isn&apos;t.
              </h2>
            </div>
            <div className="flex items-center gap-5">
              {!isConnected ? (
                <Button size="lg" onClick={handleConnect} loading={isConnecting}>
                  Connect wallet →
                </Button>
              ) : (
                <Button size="lg" onClick={goDashboard}>
                  Enter vault →
                </Button>
              )}
              <Link href="/review" className="text-[13px] text-text-tertiary hover:text-text-primary link-slide transition-colors uppercase tracking-[0.14em] font-mono">
                Reviewer console
              </Link>
            </div>
          </div>

          {/* Gigantic outlined wordmark */}
          <div className="relative overflow-hidden" data-sr>
            <div
              aria-hidden
              className="kinetic-outline leading-[0.78] tracking-[-0.055em] font-display font-bold select-none"
              style={{ fontSize: "clamp(90px, 22vw, 360px)" }}
            >
              INTENTGUARD
            </div>
          </div>

          <div className="hairline-top mt-10 pt-6 flex flex-wrap items-center justify-between gap-4 text-[11px] tnum font-mono text-text-quat">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2">
                <span className="led-pulse h-1.5 w-1.5 rounded-full bg-success" />
                <span className="uppercase tracking-[0.18em]">Base Sepolia · {CHAIN_ID}</span>
              </span>
              <span className="hidden md:inline">·</span>
              <span className="hidden md:inline">Commit → Delegate → Recourse</span>
            </div>
            <div className="flex items-center gap-4">
              <span>© {new Date().getFullYear()} IntentGuard</span>
              <span>·</span>
              <span>v0.1 · MVP</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────── */

function SectionHeader({ seq, label }: { seq: string; label: string }) {
  return (
    <div className="flex items-center gap-4">
      <span
        className="font-display font-bold text-accent tabular-nums leading-none"
        style={{ fontSize: "clamp(42px, 6vw, 72px)", letterSpacing: "-0.04em" }}
      >
        {seq}
      </span>
      <div className="flex flex-col gap-1.5">
        <span className="h-px w-10 bg-accent" />
        <span className="eyebrow text-text-secondary">{label}</span>
      </div>
    </div>
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

function MarqueeStrip() {
  const words = [
    "PROMPT INJECTION → BLOCKED",
    "OVERSPEND → CHALLENGEABLE",
    "DELEGATE KEY → REVOCABLE",
    "RECEIPT → ON-CHAIN",
    "STAKE → SLASHABLE",
    "USDC · BASE SEPOLIA · ERC-4337",
  ];
  const stream = [...words, ...words];
  return (
    <div className="relative z-10 border-y border-rule-subtle overflow-hidden bg-bg-surface/40">
      <div className="marquee-track flex items-center gap-12 py-4 whitespace-nowrap w-max">
        {stream.map((w, i) => (
          <span
            key={i}
            className="flex items-center gap-12 font-mono text-[11.5px] uppercase tracking-[0.22em] text-text-tertiary"
          >
            <span className="text-accent">◆</span>
            {w}
          </span>
        ))}
      </div>
    </div>
  );
}

function SpecGrid() {
  return (
    <dl className="grid grid-cols-2 gap-y-5 gap-x-6">
      <SpecCell label="Per-tx cap" value={formatUsdc(DEMO_MAX_SPEND_PER_TX)} unit="USDC" tone="accent" />
      <SpecCell label="Per-day cap" value={formatUsdc(DEMO_MAX_SPEND_PER_DAY)} unit="USDC" />
      <SpecCell label="Op. stake" value={formatUsdc(DEMO_AGENT_STAKE)} unit="USDC" />
      <SpecCell label="Ch. bond" value={formatUsdc(DEMO_CHALLENGE_BOND)} unit="USDC" />
    </dl>
  );
}

function SpecCell({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  tone?: "accent";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="eyebrow text-text-quat">{label}</dt>
      <dd className="flex items-baseline gap-1.5">
        <span
          className={`font-display font-semibold tnum ${
            tone === "accent" ? "text-accent" : "text-text-primary"
          }`}
          style={{ fontSize: "var(--t-xl)", letterSpacing: "-0.02em" }}
        >
          {value}
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-quat">
          {unit}
        </span>
      </dd>
    </div>
  );
}

function Pillar({
  seq,
  name,
  desc,
  code,
}: {
  seq: string;
  name: string;
  desc: string;
  code: string;
}) {
  return (
    <div className="grid grid-cols-[48px_1fr] md:grid-cols-[64px_260px_1fr_auto] gap-x-6 gap-y-3 py-6 md:py-8 hairline-top border-rule-subtle items-start">
      <span
        className="font-display font-bold text-text-quat tabular-nums leading-none"
        style={{ fontSize: "var(--t-2xl)", letterSpacing: "-0.03em" }}
      >
        {seq}
      </span>
      <span
        className="font-display font-semibold text-text-primary tracking-tight leading-tight col-start-1 md:col-start-2"
        style={{ fontSize: "var(--t-lg)" }}
      >
        {name}
      </span>
      <p className="text-[14px] text-text-tertiary leading-relaxed max-w-[62ch] col-span-2 md:col-span-1">
        {desc}
      </p>
      <code className="font-mono text-[11px] tnum text-accent-dim tracking-tight col-span-2 md:col-span-1 md:text-right md:pl-6 break-all">
        {code}
      </code>
    </div>
  );
}

function ThreatLedger() {
  const items = [
    { k: "Prompt injection", v: "Rate-limited" },
    { k: "Exfiltration", v: "Counterparty ACL" },
    { k: "Amount drift", v: "Challenge slash" },
    { k: "Expired intent", v: "Auto-revert" },
    { k: "Replay", v: "Nonce-scoped" },
  ];
  return (
    <div className="relative crosshair p-5 bg-bg-inset border border-rule">
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow text-accent">Threat map</span>
        <span className="seq tabular-nums">IG-04</span>
      </div>
      <ul className="flex flex-col">
        {items.map((it, i) => (
          <li
            key={it.k}
            className={`flex items-center justify-between py-2.5 text-[12px] ${
              i === items.length - 1 ? "" : "border-b border-rule-subtle"
            }`}
          >
            <span className="text-text-tertiary">{it.k}</span>
            <span className="font-mono tnum text-text-secondary tracking-tight">
              {it.v}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScenarioCard({
  tone,
  index,
  badge,
  title,
  target,
  amount,
  cap,
  outcome,
  trace,
}: {
  tone: "success" | "danger" | "warning";
  index: string;
  badge: string;
  title: string;
  target: string;
  amount: string;
  cap: string;
  outcome: string;
  trace: [string, string][];
}) {
  const toneCls = {
    success: { text: "text-success", dim: "text-success-dim", accent: "bg-success" },
    danger: { text: "text-danger", dim: "text-danger-dim", accent: "bg-danger" },
    warning: { text: "text-warning", dim: "text-warning-dim", accent: "bg-warning" },
  }[tone];

  return (
    <article className="lg:col-span-4 relative bg-bg-surface border border-rule p-7 md:p-8 flex flex-col gap-6 group hover:border-rule-strong transition-colors">
      <div className="flex items-start justify-between">
        <span
          className="font-display font-bold text-text-quat/60 leading-none"
          style={{ fontSize: "56px", letterSpacing: "-0.04em" }}
        >
          {index}
        </span>
        <span className={`statuscode ${toneCls.text} border border-current`}>
          <span className={`h-1.5 w-1.5 rounded-full ${toneCls.accent} breath`} />
          {badge}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <h3
          className="font-display font-semibold text-text-primary tracking-tight leading-snug"
          style={{ fontSize: "var(--t-lg)" }}
        >
          {title}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-quat">
            → {target}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 hairline-top hairline-bottom py-4">
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-text-quat">Amount</span>
          <span className="font-display font-semibold tnum text-text-primary" style={{ fontSize: "var(--t-lg)" }}>
            {amount}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-text-quat">vs. cap</span>
          <span className="font-mono tnum text-text-tertiary" style={{ fontSize: "var(--t-sm)" }}>
            {cap}
          </span>
        </div>
      </div>

      {/* Trace window */}
      <div className="relative bg-bg-inset border border-rule-subtle scanlines p-3 font-mono text-[11px] leading-[1.75] tnum">
        <div className="flex items-center justify-between mb-2">
          <span className="text-text-quat tracking-widest uppercase">trace</span>
          <span className="flex items-center gap-1 text-text-quat">
            <span className="h-1 w-1 rounded-full bg-accent" />
            <span>live</span>
          </span>
        </div>
        <ul className="flex flex-col gap-0.5">
          {trace.map(([who, what], i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent-dim w-14 shrink-0">{who}</span>
              <span className="text-text-tertiary truncate">{what}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={`hairline-top pt-4 text-[12px] ${toneCls.text} flex items-center gap-2 font-mono tracking-tight`}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M1 6 L5 10 L11 2" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        {outcome}
      </div>
    </article>
  );
}

function LedgerRow({
  tag,
  label,
  value,
  unit,
}: {
  tag: string;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-baseline gap-6 py-4 hairline-top border-rule-subtle">
      <span className="file-tag">
        <b>/</b>
        {tag}
      </span>
      <span className="text-[14px] text-text-secondary">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span
          className="font-display font-semibold tnum text-text-primary"
          style={{ fontSize: "var(--t-xl)", letterSpacing: "-0.02em" }}
        >
          {value}
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-quat">
          {unit}
        </span>
      </span>
    </li>
  );
}

function RecourseDiagram() {
  return (
    <div className="relative crosshair p-6 md:p-10 bg-bg-inset border border-rule">
      <div className="flex items-center justify-between mb-6">
        <span className="eyebrow text-accent">Slash path</span>
        <span className="seq tabular-nums">SP-015</span>
      </div>

      <svg viewBox="0 0 520 320" className="w-full" fill="none" aria-hidden>
        <defs>
          <marker
            id="arrow-rc"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 Z" fill="currentColor" className="text-text-tertiary" />
          </marker>
          <marker
            id="arrow-rc-a"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 Z" fill="currentColor" className="text-accent" />
          </marker>
        </defs>

        {/* Columns */}
        <g fontFamily="ui-monospace, monospace" fontSize="9" className="fill-text-quat">
          <text x="10" y="16">AGENT</text>
          <text x="170" y="16">GUARDED EXECUTOR</text>
          <text x="360" y="16">VAULT / OWNER</text>
        </g>
        <line x1="10" y1="22" x2="510" y2="22" className="stroke-rule-subtle" />

        {/* Nodes */}
        <DiagNode x={10} y={50} w={140} label="Operator" sub="50 USDC staked" />
        <DiagNode x={190} y={50} w={140} label="GuardedExecutor" sub="ACL + receipt" tone="accent" />
        <DiagNode x={370} y={50} w={140} label="Owner" sub="Smart account" />

        <DiagNode x={190} y={140} w={140} label="ActionReceipt" sub="amount = 15 USDC" />

        <DiagNode x={10} y={230} w={140} label="StakeVault" sub="slashable" />
        <DiagNode x={190} y={230} w={140} label="ChallengeArbiter" sub="reads receipt" tone="accent" />
        <DiagNode x={370} y={230} w={140} label="Payout" sub="15 USDC to owner" tone="accent" />

        {/* Connectors */}
        <line x1="150" y1="70" x2="190" y2="70" className="stroke-text-tertiary" strokeWidth="1" markerEnd="url(#arrow-rc)" />
        <line x1="330" y1="70" x2="370" y2="70" className="stroke-text-tertiary" strokeWidth="1" markerEnd="url(#arrow-rc)" strokeDasharray="3 3" />
        <line x1="260" y1="94" x2="260" y2="140" className="stroke-accent" strokeWidth="1.4" markerEnd="url(#arrow-rc-a)" />
        <line x1="260" y1="184" x2="260" y2="230" className="stroke-text-tertiary" strokeWidth="1" markerEnd="url(#arrow-rc)" />
        <line x1="190" y1="250" x2="150" y2="250" className="stroke-accent" strokeWidth="1.4" markerEnd="url(#arrow-rc-a)" />
        <line x1="330" y1="250" x2="370" y2="250" className="stroke-accent" strokeWidth="1.4" markerEnd="url(#arrow-rc-a)" />

        {/* Labels */}
        <text x="152" y="64" fontFamily="ui-monospace, monospace" fontSize="8.5" className="fill-text-tertiary">
          signs
        </text>
        <text x="332" y="64" fontFamily="ui-monospace, monospace" fontSize="8.5" className="fill-text-tertiary">
          commits
        </text>
        <text x="268" y="120" fontFamily="ui-monospace, monospace" fontSize="8.5" fontWeight="600" className="fill-accent">
          15 USDC
        </text>
        <text x="268" y="210" fontFamily="ui-monospace, monospace" fontSize="8.5" className="fill-text-tertiary">
          challenge
        </text>
        <text x="152" y="244" fontFamily="ui-monospace, monospace" fontSize="8.5" fontWeight="600" className="fill-accent">
          slash
        </text>
        <text x="332" y="244" fontFamily="ui-monospace, monospace" fontSize="8.5" fontWeight="600" className="fill-accent">
          payout
        </text>
      </svg>

      <div className="mt-6 hairline-top pt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] tnum font-mono">
        <span className="text-text-quat uppercase tracking-wider">
          receiptId · 0xa4…91f → challengeId 008
        </span>
        <span className="text-accent">
          resolved · t+18s
        </span>
      </div>
    </div>
  );
}

function DiagNode({
  x,
  y,
  w,
  label,
  sub,
  tone,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  sub: string;
  tone?: "accent";
}) {
  const stroke = tone === "accent" ? "stroke-accent" : "stroke-rule-strong";
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={44}
        className={`fill-bg-root ${stroke}`}
        strokeWidth={tone === "accent" ? 1.4 : 1}
      />
      <text
        x={x + 10}
        y={y + 19}
        className={tone === "accent" ? "fill-accent" : "fill-text-primary"}
        fontSize="12"
        fontFamily="ui-sans-serif, system-ui"
        fontWeight="600"
      >
        {label}
      </text>
      <text
        x={x + 10}
        y={y + 33}
        className="fill-text-tertiary"
        fontSize="9.5"
        fontFamily="ui-monospace, monospace"
      >
        {sub}
      </text>
    </g>
  );
}

function formatWalletError(err: Error): string {
  const msg = (err as { shortMessage?: string }).shortMessage ?? err.message ?? "";
  const lower = msg.toLowerCase();
  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    err.name === "UserRejectedRequestError"
  ) {
    return "Connection was cancelled in your wallet.";
  }
  if (lower.includes("chain") && lower.includes("mismatch")) {
    return "Wrong network — switch to Base Sepolia in your wallet and try again.";
  }
  if (
    lower.includes("no provider") ||
    lower.includes("injected") ||
    lower.includes("not installed")
  ) {
    return "No injected wallet detected. Install MetaMask or a Base-compatible wallet and try again.";
  }
  return msg || "Could not connect wallet. Try again.";
}

function formatLocalTime() {
  try {
    const d = new Date();
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm} LOCAL`;
  } catch {
    return "";
  }
}
