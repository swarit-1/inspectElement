"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useDisconnect,
} from "wagmi";
import { Button } from "@/components/ui/button";
import { PRIVY_APP_ID } from "@/lib/privy";
import { CHAIN_ID, truncateAddress } from "@/lib/constants";
import { easeOutExpo } from "@/lib/motion";

export default function LoginPage() {
  const router = useRouter();
  const { authenticated, login, logout, connectWallet, ready } = usePrivy();
  const { address, isConnected } = useAccount();
  const connectedChainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { disconnect } = useDisconnect();

  const wrongNetwork = isConnected && connectedChainId !== CHAIN_ID;
  const configured = !!PRIVY_APP_ID;
  const allReady = configured && ready && authenticated && isConnected && !wrongNetwork;

  useEffect(() => {
    if (allReady) {
      router.replace("/onboarding");
    }
  }, [allReady, router]);

  return (
    <div className="relative min-h-screen bg-bg-root">
      <BackdropField />

      <div className="relative z-10 max-w-[720px] mx-auto px-6 md:px-10 py-16 min-h-screen flex flex-col">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOutExpo }}
          className="flex items-center justify-between mb-16"
        >
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
          <Link
            href="/"
            className="font-mono text-[11px] tnum tracking-wider uppercase text-text-tertiary hover:text-text-primary underline-offset-4 hover:underline"
          >
            ← back to home
          </Link>
        </motion.header>

        <main className="flex-1 flex flex-col justify-center">
          {!configured ? (
            <RecoveryState />
          ) : (
            <AuthSurface
              ready={ready}
              authenticated={authenticated}
              isConnected={isConnected}
              address={address}
              wrongNetwork={wrongNetwork}
              isSwitching={isSwitching}
              onLogin={() => login()}
              onLogout={() => void logout()}
              onConnectWallet={() => connectWallet()}
              onSwitchNetwork={() => switchChain({ chainId: CHAIN_ID })}
              onDisconnect={() => disconnect()}
            />
          )}
        </main>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 flex items-center justify-between text-text-quat font-mono text-[10.5px] tnum tracking-wider uppercase"
        >
          <span>Base Sepolia · {CHAIN_ID}</span>
          <span>v0.1 · preview</span>
        </motion.footer>
      </div>
    </div>
  );
}

function AuthSurface({
  ready,
  authenticated,
  isConnected,
  address,
  wrongNetwork,
  isSwitching,
  onLogin,
  onLogout,
  onConnectWallet,
  onSwitchNetwork,
  onDisconnect,
}: {
  ready: boolean;
  authenticated: boolean;
  isConnected: boolean;
  address?: string;
  wrongNetwork: boolean;
  isSwitching: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onConnectWallet: () => void;
  onSwitchNetwork: () => void;
  onDisconnect: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.56, ease: easeOutExpo }}
      className="flex flex-col gap-10"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="seq tabular-nums text-accent">01 / IDENTIFY</span>
          <span className="h-px w-12 bg-rule" />
        </div>
        <h1
          className="font-display font-semibold tracking-tight text-text-primary"
          style={{
            fontSize: "clamp(40px, 6vw, 72px)",
            lineHeight: 0.98,
            letterSpacing: "-0.025em",
          }}
        >
          Sign in to the
          <br />
          <span className="text-accent">vault</span>.
        </h1>
        <p
          className="text-text-secondary max-w-[48ch]"
          style={{ fontSize: "var(--t-md)", lineHeight: 1.55 }}
        >
          Create an account with email, or connect MetaMask / Coinbase Wallet.
          You&apos;ll pick up where you left off in onboarding.
        </p>
      </div>

      <StepTicker
        authenticated={authenticated}
        isConnected={isConnected}
        wrongNetwork={wrongNetwork}
      />

      <div className="hairline-top pt-8">
        {!authenticated ? (
          <StepBlock
            kicker="Step 01 · Sign in"
            body="Email link or wallet. You can link more wallets later."
          >
            <Button size="lg" onClick={onLogin} loading={!ready}>
              {ready ? "Sign in →" : "Loading…"}
            </Button>
            <span className="font-mono text-[11px] tnum text-text-tertiary">
              Email or wallet · Privy
            </span>
          </StepBlock>
        ) : !isConnected ? (
          <StepBlock
            kicker="Step 02 · Connect wallet"
            body="Attach a wallet to this session so the guard can observe its perimeter."
          >
            <Button size="lg" onClick={onConnectWallet}>
              Connect wallet →
            </Button>
            <button
              type="button"
              onClick={onLogout}
              className="font-mono text-[11px] tnum text-text-tertiary hover:text-text-primary underline-offset-4 hover:underline cursor-pointer"
            >
              sign out
            </button>
          </StepBlock>
        ) : wrongNetwork ? (
          <StepBlock
            kicker="Step 03 · Switch network"
            body={`Wallet connected, but not on Base Sepolia (${CHAIN_ID}). Switch to continue.`}
            tone="warning"
          >
            <Button
              size="lg"
              onClick={onSwitchNetwork}
              loading={isSwitching}
              variant="secondary"
            >
              {isSwitching ? "Switching…" : "Switch network →"}
            </Button>
            {address && (
              <span className="font-mono text-[11px] tnum text-text-tertiary">
                {truncateAddress(address, 6)}
              </span>
            )}
            <button
              type="button"
              onClick={onDisconnect}
              className="font-mono text-[11px] tnum text-text-tertiary hover:text-text-primary underline-offset-4 hover:underline cursor-pointer"
            >
              disconnect
            </button>
          </StepBlock>
        ) : (
          <StepBlock
            kicker="Step 04 · Ready"
            body="Authenticated, connected, on Base Sepolia. Redirecting to onboarding…"
            tone="success"
          >
            <span className="font-mono text-[11px] tnum text-text-tertiary">
              {address ? truncateAddress(address, 6) : ""}
            </span>
          </StepBlock>
        )}
      </div>
    </motion.div>
  );
}

function StepBlock({
  kicker,
  body,
  tone = "neutral",
  children,
}: {
  kicker: string;
  body: string;
  tone?: "neutral" | "warning" | "success";
  children: React.ReactNode;
}) {
  const accent =
    tone === "warning"
      ? "var(--status-warning)"
      : tone === "success"
        ? "var(--status-success)"
        : "var(--accent-bright)";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="block h-1.5 w-1.5 rounded-full"
          style={{ background: accent }}
        />
        <span className="eyebrow" style={{ color: accent }}>
          {kicker}
        </span>
      </div>
      <p className="text-[13.5px] text-text-secondary max-w-[54ch] leading-relaxed">
        {body}
      </p>
      <div className="flex items-center gap-5 flex-wrap">{children}</div>
    </div>
  );
}

function StepTicker({
  authenticated,
  isConnected,
  wrongNetwork,
}: {
  authenticated: boolean;
  isConnected: boolean;
  wrongNetwork: boolean;
}) {
  const steps = [
    {
      label: "signed in",
      state: authenticated ? "complete" : "active",
    },
    {
      label: "wallet attached",
      state: !authenticated ? "locked" : isConnected ? "complete" : "active",
    },
    {
      label: "base sepolia",
      state: !isConnected
        ? "locked"
        : wrongNetwork
          ? "blocked"
          : "complete",
    },
  ] as const;
  return (
    <ol className="flex items-center gap-0 w-full hairline-top hairline-bottom">
      {steps.map((s, i) => (
        <li
          key={s.label}
          className={`
            flex-1 flex items-center gap-3 px-4 py-3
            ${i < steps.length - 1 ? "border-r border-rule-subtle" : ""}
          `}
        >
          <span
            aria-hidden
            className="block"
            style={{
              width: 7,
              height: 7,
              background:
                s.state === "complete"
                  ? "var(--status-success)"
                  : s.state === "active"
                    ? "var(--accent-bright)"
                    : s.state === "blocked"
                      ? "var(--status-warning)"
                      : "var(--text-quat)",
            }}
          />
          <span
            className="font-mono text-[10.5px] tnum tracking-wider uppercase"
            style={{
              color:
                s.state === "complete"
                  ? "var(--text-secondary)"
                  : s.state === "active"
                    ? "var(--text-primary)"
                    : s.state === "blocked"
                      ? "var(--status-warning)"
                      : "var(--text-quat)",
            }}
          >
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function RecoveryState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: easeOutExpo }}
      className="flex flex-col gap-8"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="block h-2 w-2"
          style={{ background: "var(--status-warning)" }}
        />
        <span className="eyebrow text-warning">
          CONFIGURATION REQUIRED
        </span>
      </div>
      <h1
        className="font-display font-semibold tracking-tight text-text-primary"
        style={{
          fontSize: "clamp(36px, 5vw, 56px)",
          lineHeight: 1.02,
          letterSpacing: "-0.025em",
        }}
      >
        Sign-in is disabled on this build.
      </h1>
      <p className="text-text-secondary leading-relaxed max-w-[56ch] text-[15px]">
        This deployment is missing{" "}
        <span className="font-mono text-text-primary">
          NEXT_PUBLIC_PRIVY_APP_ID
        </span>
        . Add it to{" "}
        <span className="font-mono text-text-primary">.env.local</span> from
        the Privy dashboard, then restart the dev server to enable wallet
        login.
      </p>
      <div className="hairline-top pt-8 flex items-center gap-5 flex-wrap">
        <Link
          href="/theater"
          className="font-mono text-[12px] tnum tracking-wider uppercase text-accent hover:text-accent-bright underline-offset-4 hover:underline"
        >
          run theater with mocks →
        </Link>
        <span className="font-mono text-[11px] tnum text-text-tertiary">
          NEXT_PUBLIC_USE_MOCKS=true
        </span>
      </div>
    </motion.div>
  );
}

function BackdropField() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none opacity-[0.08]"
      style={{
        backgroundImage:
          "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        color: "var(--text-tertiary)",
        maskImage:
          "radial-gradient(ellipse at 50% 0%, #000 0%, #000 40%, transparent 90%)",
      }}
    />
  );
}

function VaultMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
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
