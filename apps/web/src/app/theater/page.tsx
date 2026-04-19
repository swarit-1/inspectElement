"use client";

import { Shell } from "@/components/ui/shell";
import { WalletGate } from "@/components/ui/wallet-gate";
import { TheaterExperience } from "@/components/theater/theater-experience";

export default function TheaterPage() {
  return (
    <Shell>
      <WalletGate
        caption="AGENT RUNS LOCKED"
        body="Connect the owner wallet to dispatch live agent actions against its committed intent and approvals."
      >
        <TheaterExperience />
      </WalletGate>
    </Shell>
  );
}
