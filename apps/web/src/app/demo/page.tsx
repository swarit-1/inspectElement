"use client";

import { Shell } from "@/components/ui/shell";
import { WalletGate } from "@/components/ui/wallet-gate";
import { DemoPanel } from "@/components/demo/demo-panel";

export default function DemoPage() {
  return (
    <Shell>
      <WalletGate
        caption="SCENARIO CONSOLE LOCKED"
        body="Connect the owner wallet to run live Sepolia scenarios against its committed intent and approvals."
      >
        <DemoPanel />
      </WalletGate>
    </Shell>
  );
}
