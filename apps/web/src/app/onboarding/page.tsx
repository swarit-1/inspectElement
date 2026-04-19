"use client";

import { Suspense } from "react";
import { Shell } from "@/components/ui/shell";
import { LoadingPulse } from "@/components/ui/loading";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default function OnboardingPage() {
  return (
    <Shell>
      <Suspense fallback={<LoadingPulse label="Loading wizard" />}>
        <OnboardingWizard />
      </Suspense>
    </Shell>
  );
}
