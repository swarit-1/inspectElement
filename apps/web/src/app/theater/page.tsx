"use client";

import { Shell } from "@/components/ui/shell";
import { WalletGate } from "@/components/ui/wallet-gate";
import { TheaterExperience } from "@/components/theater/theater-experience";

export default function TheaterPage() {
  return (
    <Shell>
      <WalletGate
        caption="AGENT RUN THEATER LOCKED"
        body="Connect the owner wallet to run live Sepolia scenarios against its committed intent and approvals."
      >
        <TheaterExperience />
      </WalletGate>
    </Shell>
  );
}
