"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { truncateAddress, CONTRACT_ADDRESSES } from "@/lib/constants";
import { PRIVY_APP_ID } from "@/lib/privy";

interface WalletConnectProps {
  onConnected: () => void;
}

/**
 * Landing-left column. Identifies the product, lists the three pillars, and
 * hands off to the dashboard once a wallet is connected. No fake deploy step
 * — GuardedExecutor is a shared protocol contract, not a per-user artifact.
 *
 * Auth: Privy handles account creation (email) and wallet login (MetaMask,
 * Coinbase Wallet, WalletConnect). After sign-in, wagmi reflects the active wallet.
 */
export function WalletConnect({ onConnected }: WalletConnectProps) {
  const {
    ready,
    authenticated,
    login,
    logout,
    connectWallet,
    linkWallet,
  } = usePrivy();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  if (!PRIVY_APP_ID) {
    return (
      <div className="flex flex-col gap-6 text-[13px] text-text-secondary max-w-[52ch]">
        <p>
          Add{" "}
          <span className="font-mono text-text-primary">
            NEXT_PUBLIC_PRIVY_APP_ID
          </span>{" "}
          to your environment to enable sign-in and wallet linking.
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex flex-col gap-8">
        <span className="font-mono text-[11px] tnum text-text-tertiary">
          Loading…
        </span>
      </div>
    );
  }

  if (authenticated && isConnected && address) {
    return (
      <div className="flex flex-col gap-8">
        <ConnectedKey
          address={address}
          onDisconnect={() => {
            void logout();
            disconnect();
          }}
        />
        <ProtocolReadout />
        <div className="hairline-top pt-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => linkWallet()}
            >
              Link another wallet
            </Button>
            <span className="font-mono text-[11px] tnum text-text-tertiary">
              MetaMask, Coinbase, WalletConnect
            </span>
          </div>
          <div className="flex items-center gap-5 flex-wrap">
            <Button size="md" onClick={onConnected}>
              Enter vault →
            </Button>
            <span className="font-mono text-[11px] tnum text-text-tertiary">
              opens dashboard
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (authenticated && !isConnected) {
    return (
      <div className="flex flex-col gap-12">
        <LandingCopy />
        <div className="flex flex-col gap-3 hairline-top pt-6">
          <div className="flex flex-wrap items-center gap-5">
            <Button size="lg" onClick={() => connectWallet()}>
              Connect wallet →
            </Button>
            <span className="font-mono text-[11px] tnum text-text-tertiary">
              Base Sepolia · MetaMask or Coinbase Wallet
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <LandingCopy />

      <ul className="flex flex-col">
        <Pillar
          seq="01"
          name="Commit intent"
          desc="Per-tx and per-day caps, allowed counterparties, expiry. Pinned and signed."
        />
        <Pillar
          seq="02"
          name="Delegate agent"
          desc="Authorize a single signing key. Revoke at will. Stake-backed."
        />
        <Pillar
          seq="03"
          name="Recourse"
          desc="Every overspend is challengeable. Operator stake covers the difference."
        />
      </ul>

      <div className="flex flex-col gap-3 hairline-top pt-6">
        <div className="flex flex-wrap items-center gap-5">
          <Button size="lg" onClick={() => login()}>
            Sign in →
          </Button>
          <span className="font-mono text-[11px] tnum text-text-tertiary">
            Email or wallet · Base Sepolia
          </span>
        </div>
        <p className="text-[13px] text-text-tertiary leading-relaxed max-w-[52ch]">
          Create an account with email, or connect MetaMask / Coinbase Wallet.
          You can link additional wallets after you sign in.
        </p>
      </div>
    </div>
  );
}

function LandingCopy() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="seq tabular-nums">00 / IDENTIFY</span>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <div>
        <h1
          className="font-display font-semibold tracking-tight text-text-primary leading-[0.95]"
          style={{ fontSize: "var(--t-4xl)" }}
        >
          Intent
          <span className="text-accent">Guard</span>
        </h1>
        <p
          className="mt-5 text-text-secondary leading-relaxed max-w-[42ch]"
          style={{ fontSize: "var(--t-md)" }}
        >
          A vault door between your USDC and an autonomous agent. Set the spend
          envelope, monitor every action, dispute what shouldn&apos;t have
          happened.
        </p>
      </div>
    </div>
  );
}

function Pillar({ seq, name, desc }: { seq: string; name: string; desc: string }) {
  return (
    <li className="grid grid-cols-[40px_140px_1fr] gap-x-5 py-4 hairline-bottom border-rule-subtle items-baseline">
      <span className="seq tabular-nums">{seq}</span>
      <span
        className="font-display font-semibold text-text-primary tracking-tight"
        style={{ fontSize: "var(--t-md)" }}
      >
        {name}
      </span>
      <span className="text-[13px] text-text-tertiary leading-relaxed max-w-[60ch]">
        {desc}
      </span>
    </li>
  );
}

function ConnectedKey({
  address,
  onDisconnect,
}: {
  address: string;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex items-end justify-between hairline-bottom pb-5">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="led-pulse h-1.5 w-1.5 rounded-full bg-success" />
          <span className="eyebrow text-success">Wallet connected</span>
        </div>
        <div
          className="font-mono tnum text-text-primary"
          style={{ fontSize: "var(--t-lg)" }}
        >
          {truncateAddress(address, 6)}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onDisconnect}>
        Sign out
      </Button>
    </div>
  );
}

/**
 * The honest replacement for the old "Deploy module" button. GuardedExecutor
 * is a singleton protocol contract — the user joins it by committing an intent
 * keyed by their address, not by deploying anything.
 */
function ProtocolReadout() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="led-pulse h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="eyebrow text-text-secondary">Protocol online</span>
      </div>
      <p className="text-[13px] text-text-tertiary leading-relaxed max-w-[52ch]">
        GuardedExecutor is a shared on-chain module on Base Sepolia. Nothing to
        deploy — your wallet becomes the owner of a new vault slot the moment
        you commit an intent.
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px] tnum font-mono">
        <dt className="text-text-quat">Executor</dt>
        <dd className="text-text-secondary break-all">
          {truncateAddress(CONTRACT_ADDRESSES.guardedExecutor, 6)}
        </dd>
        <dt className="text-text-quat">Registry</dt>
        <dd className="text-text-secondary break-all">
          {truncateAddress(CONTRACT_ADDRESSES.intentRegistry, 6)}
        </dd>
      </dl>
    </div>
  );
}
