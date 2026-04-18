"use client";

import { useState } from "react";
import { Shell } from "@/components/ui/shell";
import { IntentBuilder } from "@/components/intent/intent-builder";
import { AgentDelegate } from "@/components/delegation/agent-delegate";
import { ActivityFeed } from "@/components/feed/activity-feed";
import type { Hex } from "viem";

export default function DashboardPage() {
  const [intentCommitted, setIntentCommitted] = useState(false);
  const [delegated, setDelegated] = useState(false);

  return (
    <Shell>
      <div className="flex flex-col gap-10">
        {/* Step 1: Commit intent */}
        <IntentBuilder
          onCommitted={(hash: Hex) => setIntentCommitted(true)}
        />

        {/* Step 2: Delegate agent */}
        {intentCommitted && (
          <AgentDelegate onDelegated={() => setDelegated(true)} />
        )}

        {/* Step 3: Activity feed (always visible) */}
        <ActivityFeed />
      </div>
    </Shell>
  );
}
