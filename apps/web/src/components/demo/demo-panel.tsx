"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Section } from "@/components/ui/section";
import { runDemoScenario, waitForDemoScenario } from "@/lib/api";
import { USE_MOCKS, truncateAddress } from "@/lib/constants";
import type { DemoScenario, DemoStatus, DemoRunStatus } from "@/lib/types";
import type { Hex } from "viem";

const SCENARIOS: {
  id: DemoScenario;
  seq: string;
  label: string;
  expected: string;
  description: string;
  variant: "primary" | "danger" | "secondary";
}[] = [
  {
    id: "legit",
    seq: "S-01",
    label: "Legit payment",
    expected: "EXECUTED",
    description: "2.0 USDC → allowlisted merchant, within per-tx and daily caps.",
    variant: "primary",
  },
  {
    id: "blocked",
    seq: "S-02",
    label: "Blocked attack",
    expected: "BLOCKED",
    description:
      "20.0 USDC → non-allowlisted attacker. Guard rejects before USDC is touched.",
    variant: "danger",
  },
  {
    id: "overspend",
    seq: "S-03",
    label: "Overspend attack",
    expected: "EXECUTES → CHALLENGEABLE",
    description:
      "15.0 USDC → allowlisted merchant. Exceeds 10 USDC per-tx cap; receipt is challengeable.",
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
        await new Promise((r) => setTimeout(r, 1600));
        setStatuses((prev) => ({ ...prev, [scenario]: getMockResult(scenario) }));
        return;
      }
      const id = await runDemoScenario(scenario);
      const result = await waitForDemoScenario(scenario, id);
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
    <Section
      index="04"
      kicker="Test bench"
      title="Scenario console"
      subtitle="Trigger scripted agents to verify guard and recourse mechanics"
      action={
        <div className="font-mono text-[11px] tnum text-text-tertiary">
          runtime ·{" "}
          <span className="text-text-secondary">
            {process.env.NEXT_PUBLIC_RUNTIME_API_URL ?? "http://localhost:7402"}
          </span>
        </div>
      }
    >
      <div className="flex flex-col">
        {SCENARIOS.map(({ id, seq, label, expected, description, variant }) => (
          <ScenarioRow
            key={id}
            seq={seq}
            label={label}
            expected={expected}
            description={description}
            variant={variant}
            status={statuses[id]}
            onRun={() => void handleRun(id)}
          />
        ))}
      </div>
    </Section>
  );
}

function ScenarioRow({
  seq,
  label,
  expected,
  description,
  variant,
  status,
  onRun,
}: {
  seq: string;
  label: string;
  expected: string;
  description: string;
  variant: "primary" | "danger" | "secondary";
  status: DemoStatus;
  onRun: () => void;
}) {
  const isRunning = status.status === "running";
  return (
    <div className="grid grid-cols-[60px_1fr_auto] gap-x-6 items-start py-6 hairline-bottom border-rule-subtle">
      <div className="font-mono text-[11px] tnum text-text-quat tracking-wider pt-2">
        {seq}
      </div>

      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-baseline gap-3">
          <h3
            className="font-display font-semibold tracking-tight text-text-primary"
            style={{ fontSize: "var(--t-md)" }}
          >
            {label}
          </h3>
          <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat">
            expected: <span className="text-text-tertiary">{expected}</span>
          </span>
        </div>
        <p className="text-[12px] text-text-tertiary leading-relaxed max-w-[60ch]">
          {description}
        </p>

        {status.status === "success" && (
          <div className="mt-3 flex items-center gap-3">
            {status.reasonCode ? (
              <>
                <StatusBadge variant="danger">Blocked</StatusBadge>
                <span className="font-mono text-[11px] tnum text-text-secondary">
                  reason · {status.reasonCode.replace(/_/g, " ").toLowerCase()}
                </span>
              </>
            ) : status.txHash ? (
              <>
                <StatusBadge variant="success">Executed</StatusBadge>
                <a
                  href={`https://sepolia.basescan.org/tx/${status.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] tnum text-accent hover:text-accent-bright underline-offset-4 hover:underline"
                >
                  tx · {truncateAddress(status.txHash, 6)} ↗
                </a>
              </>
            ) : (
              <StatusBadge variant="info">Completed</StatusBadge>
            )}
          </div>
        )}

        {status.status === "failed" && (
          <div className="mt-3 text-[12px] text-danger font-mono tnum">
            ✕ {status.error ?? "Scenario failed"}
          </div>
        )}
      </div>

      <Button
        variant={variant}
        size="md"
        onClick={onRun}
        loading={isRunning}
        disabled={isRunning}
      >
        {isRunning ? "Running…" : "Run scenario"}
      </Button>
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
