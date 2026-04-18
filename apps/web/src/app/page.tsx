"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { WalletConnect } from "@/components/onboarding/wallet-connect";
import type { OnboardingStep } from "@/lib/types";

export default function HomePage() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("connect");

  // If already connected, redirect to dashboard
  useEffect(() => {
    if (isConnected) {
      router.push("/dashboard");
    }
  }, [isConnected, router]);

  function handleStepChange(newStep: OnboardingStep) {
    setStep(newStep);
    if (newStep === "deployed") {
      setTimeout(() => router.push("/dashboard"), 500);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <WalletConnect step={step} onStepChange={handleStepChange} />
      </div>
    </div>
  );
}
