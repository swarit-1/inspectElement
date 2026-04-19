"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Section } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { runDemoScenario, waitForDemoScenario } from "@/lib/api";
import { appendScenarioToFeed, resetMockStore } from "@/mocks/mock-store";
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
    description:
      "2.0 USDC → allowlisted merchant, within per-tx and daily caps.",
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
  const { address } = useAccount();
  const qc = useQueryClient();
  const { toast } = useToast();
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
        await new Promise((r) => setTimeout(r, 1400));
        const { receiptId } = appendScenarioToFeed(scenario, address);
        const result: DemoStatus =
          scenario === "blocked"
            ? {
                scenario,
                status: "success",
                reasonCode: "COUNTERPARTY_NOT_ALLOWED",
              }
            : {
                scenario,
                status: "success",
                receiptId,
                txHash: ("0xaaaa" + String(Date.now()).padStart(60, "0")) as Hex,
              };
        setStatuses((prev) => ({ ...prev, [scenario]: result }));
        qc.invalidateQueries({ queryKey: ["feed"] });
        toast({
          variant:
            scenario === "blocked"
              ? "danger"
              : scenario === "overspend"
                ? "warning"
                : "success",
          title:
            scenario === "legit"
              ? "Payment executed"
              : scenario === "blocked"
                ? "Attempt blocked at guard"
                : "Overspend recorded · recourse available",
          description:
            scenario === "overspend" && receiptId
              ? "Open the receipt to file an AmountViolation challenge."
              : scenario === "legit"
                ? "2.0 USDC → merchant · receipt added to the ledger."
                : "20.0 USDC → non-allowlisted target · USDC never moved.",
          action:
            scenario === "overspend" && receiptId
              ? { label: "Open receipt", onClick: () => window.location.assign(`/receipt/${receiptId}`) }
              : undefined,
        });
        return;
      }
      const id = await runDemoScenario(scenario);
      const result = await waitForDemoScenario(scenario, id);
      setStatuses((prev) => ({ ...prev, [scenario]: result }));
      qc.invalidateQueries({ queryKey: ["feed"] });
      if (result.status === "success") {
        toast({
          variant:
            scenario === "blocked"
              ? "danger"
              : scenario === "overspend"
                ? "warning"
                : "success",
          title:
            scenario === "legit"
              ? "Payment executed"
              : scenario === "blocked"
                ? "Attempt blocked at guard"
                : "Overspend recorded · recourse available",
          description: result.txHash
            ? `tx · ${truncateAddress(result.txHash, 6)}`
            : undefined,
        });
      } else if (result.status === "failed") {
        toast({
          variant: "danger",
          title: "Scenario failed",
          description: result.error ?? "Unknown error",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setStatuses((prev) => ({
        ...prev,
        [scenario]: { scenario, status: "failed", error: message },
      }));
      toast({
        variant: "danger",
        title: "Scenario failed",
        description: message,
      });
    }
  }

  function handleReset() {
    if (!USE_MOCKS) return;
    resetMockStore();
    setStatuses({
      legit: { scenario: "legit", status: "idle" },
      blocked: { scenario: "blocked", status: "idle" },
      overspend: { scenario: "overspend", status: "idle" },
    });
    qc.invalidateQueries({ queryKey: ["feed"] });
    toast({
      variant: "info",
      title: "Demo state reset",
      description: "Ledger cleared back to fixtures.",
    });
  }

  return (
    <Section
      kicker="Test bench"
      title="Scenario console"
      subtitle={
        USE_MOCKS
          ? "Trigger scripted runs — each scenario appends a new ledger entry in mock mode."
          : "Runs on the live demo-control service. Results post to the indexer and appear in the feed."
      }
      action={
        <div className="flex items-center gap-5">
          {USE_MOCKS && (
            <button
              type="button"
              onClick={handleReset}
              className="font-mono text-[11px] tnum tracking-wider uppercase text-text-tertiary hover:text-accent underline-offset-4 hover:underline"
            >
              ↻ Reset demo
            </button>
          )}
          <div className="font-mono text-[11px] tnum text-text-tertiary">
            runtime ·{" "}
            <span className="text-text-secondary">
              {USE_MOCKS
                ? "mock (in-browser)"
                : (process.env.NEXT_PUBLIC_RUNTIME_API_URL ?? "http://localhost:7402")}
            </span>
          </div>
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

      <div className="hairline-top mt-4 pt-6 flex flex-col gap-2 text-[12px] text-text-tertiary leading-relaxed max-w-[62ch]">
        <div className="eyebrow text-text-secondary">Demo-safe fallback</div>
        <p>
          In mock mode, scenarios mutate an in-browser ledger so the story plays
          end-to-end without running the agent service. Live mode calls
          demo-control and waits for real receipts from the indexer.
        </p>
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
        <div className="flex items-baseline gap-3 flex-wrap">
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

        {isRunning && (
          <div className="mt-3 flex items-center gap-3 font-mono text-[11px] tnum text-text-tertiary">
            <span className="led-pulse h-1.5 w-1.5 rounded-full bg-accent" />
            EXECUTING AGENT RUN…
          </div>
        )}

        {status.status === "success" && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {status.reasonCode ? (
              <>
                <StatusBadge variant="danger">Blocked</StatusBadge>
                <span className="font-mono text-[11px] tnum text-text-secondary">
                  reason · {status.reasonCode.replace(/_/g, " ").toLowerCase()}
                </span>
              </>
            ) : status.receiptId ? (
              <>
                <StatusBadge variant="success">Executed</StatusBadge>
                <Link
                  href={`/receipt/${status.receiptId}`}
                  className="font-mono text-[11px] tnum text-accent hover:text-accent-bright underline-offset-4 hover:underline"
                >
                  receipt · {truncateAddress(status.receiptId, 6)} →
                </Link>
                {status.txHash && !USE_MOCKS && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${status.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[11px] tnum text-text-tertiary hover:text-text-primary underline-offset-4 hover:underline"
                  >
                    tx ↗
                  </a>
                )}
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
