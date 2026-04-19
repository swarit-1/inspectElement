"use client";

import { LandingNav } from "@/components/landing/landing-nav";
import { LandingHero } from "@/components/landing/hero";
import { ProofStrip } from "@/components/landing/proof-strip";
import { ThreeStep } from "@/components/landing/three-step";
import { WhyItMatters } from "@/components/landing/why-it-matters";
import { TheaterPreview } from "@/components/landing/theater-preview";
import { ClosingCta } from "@/components/landing/closing-cta";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-bg-root">
      <LandingNav />
      <main>
        <LandingHero />
        <ProofStrip />
        <ThreeStep />
        <WhyItMatters />
        <TheaterPreview />
        <ClosingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
