"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PRIVY_APP_ID } from "@/lib/privy";

/**
 * Guards a page's authenticated content. When no wallet is connected, renders
 * an editorial empty state with a connect action in place of the children.
 *
 * In mock mode, we still require a connection because the Dashboard/Review
 * flows are keyed by `address` for react-query caching. The empty state makes
 * this deliberate and non-technical.
 */
export function WalletGate({
  caption,
  body,
  children,
}: {
  caption: string;
  body: string;
  children: ReactNode;
}) {
  const { ready, authenticated, login, connectWallet } = usePrivy();
  const { isConnected } = useAccount();

  if (!PRIVY_APP_ID) {
    return (
      <div className="flex flex-col gap-8">
        <EmptyState
          glyph="○"
          caption={caption}
          headline="Configuration required."
          body="Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local to enable wallet access."
        />
      </div>
    );
  }

  if (isConnected) return <>{children}</>;

  const handleAction = () => {
    if (!authenticated) login();
    else connectWallet();
  };

  const label = !ready
    ? "Loading…"
    : !authenticated
      ? "Sign in →"
      : "Connect wallet →";

  return (
    <div className="flex flex-col gap-8">
      <EmptyState
        glyph="○"
        caption={caption}
        headline="Wallet required."
        body={body}
      />
      <div className="flex items-center gap-5 hairline-top pt-6">
        <Button
          onClick={handleAction}
          loading={!ready}
          disabled={!ready}
          size="md"
        >
          {label}
        </Button>
        <span className="font-mono text-[11px] tnum text-text-tertiary">
          Base Sepolia · Privy
        </span>
      </div>
    </div>
  );
}
