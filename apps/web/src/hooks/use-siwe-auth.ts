"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { INFRA_API_BASE } from "@/lib/constants";

interface AuthState {
  token: string | null;
  address: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Module-level token for use by api.ts fetch calls
let currentToken: string | null = null;

export function getAuthToken(): string | null {
  return currentToken;
}

export function useSiweAuth() {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [state, setState] = useState<AuthState>({
    token: null,
    address: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });

  // Clear auth when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      currentToken = null;
      setState({
        token: null,
        address: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, [isConnected]);

  const signIn = useCallback(async () => {
    if (!address || !isConnected) {
      setState((s) => ({ ...s, error: "Wallet not connected" }));
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      // 1. Get nonce from backend
      const nonceRes = await fetch(
        `${INFRA_API_BASE}/v1/auth/nonce?address=${address}`,
      );
      if (!nonceRes.ok) throw new Error("Failed to get nonce");
      const { nonce } = await nonceRes.json();

      // 2. Construct SIWE message
      const siweMessage = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to Vault",
        uri: window.location.origin,
        version: "1",
        chainId: chainId ?? 84532,
        nonce,
      });

      const messageStr = siweMessage.prepareMessage();

      // 3. Sign with wallet
      const signature = await signMessageAsync({ message: messageStr });

      // 4. Verify with backend
      const verifyRes = await fetch(`${INFRA_API_BASE}/v1/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageStr, signature }),
      });

      if (!verifyRes.ok) {
        const errBody = await verifyRes.json().catch(() => ({}));
        throw new Error(
          (errBody as Record<string, string>).message ?? "Verification failed",
        );
      }

      const { token } = (await verifyRes.json()) as { token: string };

      currentToken = token;
      setState({
        token,
        address: address.toLowerCase(),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed";
      setState((s) => ({
        ...s,
        isLoading: false,
        error: msg,
      }));
    }
  }, [address, isConnected, chainId, signMessageAsync]);

  const signOut = useCallback(() => {
    currentToken = null;
    setState({
      token: null,
      address: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    signIn,
    signOut,
  };
}
