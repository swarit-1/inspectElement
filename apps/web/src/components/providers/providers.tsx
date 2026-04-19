"use client";

import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { config } from "@/lib/wagmi";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { USE_MOCKS } from "@/lib/constants";
import { useSiweAuth } from "@/hooks/use-siwe-auth";
import { PRIVY_APP_ID, privyClientConfig } from "@/lib/privy";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  /**
   * When PRIVY_APP_ID is missing, we still render the app shell — the
   * `/login` route handles the configuration-missing state editorially and
   * `WalletGate` uses the same fallback on gated surfaces.
   */
  if (!PRIVY_APP_ID) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    );
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || undefined}
      config={privyClientConfig}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <ToastProvider>
            <AuthSessionBootstrap />
            {children}
          </ToastProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

function AuthSessionBootstrap() {
  const { ready: privyReady } = usePrivy();
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const {
    address: authedAddress,
    isAuthenticated,
    isLoading,
    error,
    signIn,
    signOut,
  } = useSiweAuth();
  const attemptedAddress = useRef<string | null>(null);
  const lastError = useRef<string | null>(null);

  useEffect(() => {
    if (!isConnected) {
      attemptedAddress.current = null;
      lastError.current = null;
    }
  }, [isConnected]);

  useEffect(() => {
    if (!address || !authedAddress) return;
    if (authedAddress !== address.toLowerCase()) {
      attemptedAddress.current = null;
      signOut();
    }
  }, [address, authedAddress, signOut]);

  useEffect(() => {
    if (
      USE_MOCKS ||
      !privyReady ||
      !isConnected ||
      !address ||
      isAuthenticated ||
      isLoading
    ) {
      return;
    }
    const normalized = address.toLowerCase();
    if (attemptedAddress.current === normalized) return;
    attemptedAddress.current = normalized;
    void signIn();
  }, [
    address,
    isAuthenticated,
    isConnected,
    isLoading,
    privyReady,
    signIn,
  ]);

  useEffect(() => {
    if (!error || error === lastError.current) return;
    lastError.current = error;
    toast({
      variant: "warning",
      title: "API sign-in not completed",
      description: error,
    });
  }, [error, toast]);

  return null;
}
