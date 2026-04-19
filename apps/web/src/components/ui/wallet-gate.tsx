"use client";

import { useAccount, useConnect, useConnectors } from "wagmi";
import { injected } from "wagmi/connectors";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

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
  const { isConnected } = useAccount();
  const connectors = useConnectors();
  const { connect, isPending } = useConnect();

  if (isConnected) return <>{children}</>;

  const handleConnect = () => {
    const connector =
      connectors.find((c) => c.id === "injected" || c.type === "injected") ??
      connectors[0] ??
      injected();
    connect({ connector });
  };

  return (
    <div className="flex flex-col gap-8">
      <EmptyState
        glyph="○"
        caption={caption}
        headline="Wallet required."
        body={body}
      />
      <div className="flex items-center gap-5 hairline-top pt-6">
        <Button onClick={handleConnect} loading={isPending} size="md">
          Connect wallet →
        </Button>
        <span className="font-mono text-[11px] tnum text-text-tertiary">
          Base Sepolia · injected wallet
        </span>
      </div>
    </div>
  );
}
