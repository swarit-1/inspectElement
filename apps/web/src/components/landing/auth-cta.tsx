"use client";

import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { PRIVY_APP_ID } from "@/lib/privy";

interface AuthCtaProps {
  size?: "md" | "lg";
  onEnterConsole?: () => void;
}

/**
 * The single authoritative CTA for the landing. Decides button state from
 * Privy + wagmi, so the landing never ships a broken button.
 */
export function AuthCta({ size = "lg", onEnterConsole }: AuthCtaProps) {
  const router = useRouter();
  const { authenticated, login, ready } = usePrivy();
  const { isConnected } = useAccount();

  if (!PRIVY_APP_ID) {
    return (
      <Button
        size={size}
        variant="secondary"
        onClick={() => router.push("/login")}
      >
        Set up access →
      </Button>
    );
  }

  if (!ready) {
    return (
      <Button size={size} loading disabled>
        Loading…
      </Button>
    );
  }

  if (authenticated && isConnected) {
    return (
      <Button
        size={size}
        onClick={() => {
          onEnterConsole?.();
          router.push("/dashboard");
        }}
      >
        Enter console →
      </Button>
    );
  }

  return (
    <Button size={size} onClick={() => login()}>
      Enter console →
    </Button>
  );
}
