"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { runDemoScenario, waitForDemoScenario } from "@/lib/api";
import { USE_MOCKS, truncateAddress } from "@/lib/constants";
import type { DemoScenario, DemoStatus, DemoRunStatus } from "@/lib/types";
import type { Hex } from "viem";

const SCENARIOS: {
  id: DemoScenario;
  label: string;
  description: string;
  variant: "primary" | "danger" | "secondary";
}[] = [
  {
    id: "legit",
    label: "Run Legit Payment",
    description: "2 USDC to allowlisted merchant",
    variant: "primary",
  },
  {
    id: "blocked",
    label: "Run Blocked Attack",
    description: "20 USDC to non-allowlisted attacker",
    variant: "danger",
  },
  {
    id: "overspend",
    label: "Run Overspend Attack",
    description: "15 USDC to allowlisted merchant (exceeds 10 USDC cap)",
    variant: "secondary",
  },
];

export function DemoPanel() {
  const [statuses, setStatuses] = useState<Record<DemoScenario, DemoStatus>>({
    legit: { scenario: "legit", status: "idle" },
    blocked: { scenario: "blocked", status: "idle" },
    overspend: { scenario: "overspend", status: "idle" },
  });

  async function handleRun(scenario: DemoScenario) {
    setStatuses((prev) => ({
      ...prev,
      [scenario]: { scenario, status: "running" as DemoRunStatus },
    }));

    try {
      if (USE_MOCKS) {
        await new Promise((r) => setTimeout(r, 2000));
        const mockResult = getMockResult(scenario);
        setStatuses((prev) => ({
          ...prev,
          [scenario]: mockResult,
        }));
        return;
      }

      const scenarioId = await runDemoScenario(scenario);
      const result = await waitForDemoScenario(scenario, scenarioId);
      setStatuses((prev) => ({ ...prev, [scenario]: result }));
    } catch (err) {
      setStatuses((prev) => ({
        ...prev,
        [scenario]: {
          scenario,
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        },
      }));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-text-primary">
          Demo Control Panel
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Trigger scripted agent scenarios to demonstrate IntentGuard&apos;s
          guard and recourse mechanisms. Runtime API:{" "}
          <code className="text-xs font-mono bg-bg-raised px-1 rounded">
            {process.env.NEXT_PUBLIC_RUNTIME_API_URL ?? "http://localhost:7402"}
          </code>
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {SCENARIOS.map(({ id, label, description, variant }) => (
          <ScenarioCard
            key={id}
            label={label}
            description={description}
            variant={variant}
            status={statuses[id]}
            onRun={() => void handleRun(id)}
          />
        ))}
      </div>
    </div>
  );
}

function ScenarioCard({
  label,
  description,
  variant,
  status,
  onRun,
}: {
  label: string;
  description: string;
  variant: "primary" | "danger" | "secondary";
  status: DemoStatus;
  onRun: () => void;
}) {
  const isRunning = status.status === "running";

  return (
    <div className="bg-bg-surface border border-border rounded-[--radius-lg] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
          <p className="text-xs text-text-secondary mt-0.5">{description}</p>
        </div>
        <Button
          variant={variant}
          size="sm"
          onClick={onRun}
          loading={isRunning}
          disabled={isRunning}
        >
          {isRunning ? "Running..." : "Run"}
        </Button>
      </div>

      {status.status === "success" && <ResultCard status={status} />}

      {status.status === "failed" && (
        <div className="text-sm text-danger bg-danger-dim rounded-[--radius-md] px-3 py-2">
          {status.error ?? "Scenario failed"}
        </div>
      )}
    </div>
  );
}

function ResultCard({ status }: { status: DemoStatus }) {
  return (
    <div className="bg-bg-raised rounded-[--radius-md] px-4 py-3 flex items-center gap-3">
      {status.reasonCode ? (
        <>
          <StatusBadge variant="danger">Blocked</StatusBadge>
          <span className="text-xs font-mono text-text-secondary">
            {status.reasonCode.replace(/_/g, " ")}
          </span>
        </>
      ) : status.txHash ? (
        <>
          <StatusBadge variant="success">Executed</StatusBadge>
          <a
            href={`https://sepolia.basescan.org/tx/${status.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-accent hover:underline"
          >
            {truncateAddress(status.txHash, 8)}
          </a>
        </>
      ) : (
        <StatusBadge variant="info">Completed</StatusBadge>
      )}
    </div>
  );
}

function getMockResult(scenario: DemoScenario): DemoStatus {
  switch (scenario) {
    case "legit":
      return {
        scenario: "legit",
        status: "success",
        txHash:
          "0xaaaa000000000000000000000000000000000000000000000000000000000001" as Hex,
        receiptId:
          "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex,
      };
    case "blocked":
      return {
        scenario: "blocked",
        status: "success",
        reasonCode: "COUNTERPARTY_NOT_ALLOWED",
      };
    case "overspend":
      return {
        scenario: "overspend",
        status: "success",
        txHash:
          "0xaaaa000000000000000000000000000000000000000000000000000000000002" as Hex,
        receiptId:
          "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex,
      };
  }
}
