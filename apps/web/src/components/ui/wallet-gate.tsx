"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { LoadingPulse } from "@/components/ui/loading";
import { PRIVY_APP_ID } from "@/lib/privy";

/**
 * Guards a page's authenticated content. Unauthenticated visitors are routed
 * to `/login`, which hosts the editorial sign-in surface (and the
 * configuration-missing recovery state when `NEXT_PUBLIC_PRIVY_APP_ID` is
 * absent). A pulse placeholder covers the short redirect window.
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
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { isConnected } = useAccount();

  const missingConfig = !PRIVY_APP_ID;
  const signedOut = !missingConfig && ready && (!authenticated || !isConnected);

  useEffect(() => {
    if (missingConfig || signedOut) {
      const target = "/login";
      router.replace(target);
    }
  }, [missingConfig, signedOut, router]);

  if (!PRIVY_APP_ID || !ready || !authenticated || !isConnected) {
    return (
      <div className="flex flex-col gap-4">
        <p className="font-mono text-[11px] tracking-[0.22em] uppercase text-text-tertiary">
          {caption}
        </p>
        <p className="text-sm text-text-secondary max-w-xl">{body}</p>
        <div className="pt-8">
          <LoadingPulse label="Routing to sign-in" align="left" pad={false} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
