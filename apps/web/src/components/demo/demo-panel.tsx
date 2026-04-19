"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { Section } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { runDemoScenario, waitForDemoScenario, screenTrace as apiScreenTrace, type ScreenResponse } from "@/lib/api";
import { useDemoRuntimeConfig } from "@/hooks/use-demo-runtime-config";
import { GeminiScreenPanel } from "@/components/gemini/gemini-screen-panel";
import { appendScenarioToFeed, resetMockStore } from "@/mocks/mock-store";
import { USE_MOCKS, truncateAddress } from "@/lib/constants";
import type { DemoScenario, DemoStatus } from "@/lib/types";
import type { Hex } from "viem";
import { DemoRunTheater } from "./demo-run-theater";

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
      "2.0 USD → allowlisted merchant, within per-tx and daily caps.",
    variant: "primary",
  },
  {
    id: "blocked",
    seq: "S-02",
    label: "Blocked attack",
    expected: "BLOCKED",
    description:
      "20.0 USD → non-allowlisted attacker. Guard rejects before the stablecoin is touched.",
    variant: "danger",
  },
  {
    id: "overspend",
    seq: "S-03",
    label: "Overspend attack",
    expected: "EXECUTES → CHALLENGEABLE",
    description:
      "15.0 USD → allowlisted merchant. Exceeds 10 USD per-tx cap; receipt is challengeable.",
    variant: "secondary",
  },
];

let mockTxCounter = 1n;

interface ActiveRun {
  scenario: DemoScenario;
  runKey: number;
  isRunning: boolean;
  realResult: DemoStatus | null;
}

export function DemoPanel() {
  const { address } = useAccount();
  const { data: runtimeConfig } = useDemoRuntimeConfig();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [active, setActive] = useState<ActiveRun | null>(null);
  const [screenResult, setScreenResult] = useState<ScreenResponse | null>(null);
  const [screenLoading, setScreenLoading] = useState(false);

  async function runAdvisoryScreen(scenario: DemoScenario) {
    if (USE_MOCKS) {
      setScreenLoading(false);
      return;
    }
    try {
      const dummyTrace = {
        scenario,
        action: scenario === "legit" ? "pay_merchant" : scenario === "blocked" ? "pay_attacker" : "overspend_merchant",
        timestamp: Date.now(),
      };
      const result = await apiScreenTrace({
        trace: dummyTrace,
        contextDigest: "0x" + "0".repeat(64),
        owner: address ?? "0x" + "0".repeat(40),
        agentId: runtimeConfig?.agentId ?? "0x" + "0".repeat(64),
        proposedAction: scenario === "legit" ? "Pay 2 USD to merchant" : scenario === "blocked" ? "Pay 20 USD to attacker" : "Pay 15 USD to merchant (exceeds cap)",
      });
      setScreenResult(result);
    } catch {
      // Screen failure is non-blocking
    } finally {
      setScreenLoading(false);
    }
  }

  async function handleRun(scenario: DemoScenario) {
    if (!address && !USE_MOCKS) {
      toast({
        variant: "warning",
        title: "Wallet required",
        description: "Connect the owner wallet before dispatching an agent action.",
      });
      return;
    }

    const runKey = Date.now();
    setActive({ scenario, runKey, isRunning: true, realResult: null });
    setScreenResult(null);
    setScreenLoading(true);

    try {
      if (USE_MOCKS) {
        // Let the theater play a few beats before the mock result lands.
        // The theater holds at the await phase until realResult is set.
        await new Promise((r) => setTimeout(r, 2800));
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
                txHash: nextMockTxHash(),
              };
        setActive((prev) =>
          prev && prev.runKey === runKey
            ? { ...prev, isRunning: false, realResult: result }
            : prev,
        );
        qc.invalidateQueries({ queryKey: ["feed"] });
        void runAdvisoryScreen(scenario);
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
                ? "2.0 USD → merchant · receipt added to the ledger."
                : "20.0 USD → non-allowlisted target · stablecoin never moved.",
          action:
            scenario === "overspend" && receiptId
              ? {
                  label: "Open receipt",
                  onClick: () =>
                    window.location.assign(`/receipt/${receiptId}`),
                }
              : undefined,
        });
        return;
      }
      const id = await runDemoScenario(scenario, address ?? undefined);
      const result = await waitForDemoScenario(scenario, id);
      setActive((prev) =>
        prev && prev.runKey === runKey
          ? { ...prev, isRunning: false, realResult: result }
          : prev,
      );
      qc.invalidateQueries({ queryKey: ["feed"] });
      void runAdvisoryScreen(scenario);
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
          title: "Run failed",
          description: result.error ?? "Unknown error",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const failed: DemoStatus = { scenario, status: "failed", error: message };
      setActive((prev) =>
        prev && prev.runKey === runKey
          ? { ...prev, isRunning: false, realResult: failed }
          : prev,
      );
      toast({
        variant: "danger",
        title: "Run failed",
        description: message,
      });
    }
  }

  function handleReset() {
    if (!USE_MOCKS) return;
    resetMockStore();
    setActive(null);
    qc.invalidateQueries({ queryKey: ["feed"] });
    toast({
      variant: "info",
      title: "Ledger reset",
      description: "Ledger cleared back to its starting state.",
    });
  }

  return (
    <Section
      kicker="Test bench"
      title="Agent action console"
      subtitle={
        USE_MOCKS
          ? "Dispatch an agent action. Each run plays through the guard and appends a ledger entry in preview mode."
          : "Runs against the live guard using the connected wallet as owner. The visual beats trace the agent path; the terminal frame mirrors the real outcome."
      }
      action={
        <div className="flex items-center gap-5">
          {USE_MOCKS && (
            <button
              type="button"
              onClick={handleReset}
              className="font-mono text-[11px] tnum tracking-wider uppercase text-text-tertiary hover:text-accent underline-offset-4 hover:underline"
            >
              ↻ Reset ledger
            </button>
          )}
          <div className="font-mono text-[11px] tnum text-text-tertiary">
            runtime ·{" "}
            <span className="text-text-secondary">
              {USE_MOCKS
                ? "in-browser"
                : (process.env.NEXT_PUBLIC_RUNTIME_API_URL ??
                  "http://localhost:7402")}
            </span>
          </div>
          {!USE_MOCKS && address && (
            <div className="font-mono text-[11px] tnum text-text-tertiary">
              owner ·{" "}
              <span className="text-text-secondary">
                {truncateAddress(address, 6)}
              </span>
            </div>
          )}
          {!USE_MOCKS && runtimeConfig && (
            <div className="font-mono text-[11px] tnum text-text-tertiary">
              operator ·{" "}
              <span className="text-text-secondary">
                {truncateAddress(runtimeConfig.operatorAddress, 6)}
              </span>
            </div>
          )}
        </div>
      }
    >
      {/* Scenario selector strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 hairline-bottom">
        {SCENARIOS.map((s, i) => (
          <ScenarioCard
            key={s.id}
            seq={s.seq}
            label={s.label}
            expected={s.expected}
            description={s.description}
            isActive={active?.scenario === s.id}
            isRunning={active?.scenario === s.id && active.isRunning}
            onSelect={() => void handleRun(s.id)}
            variant={s.variant}
            borderRight={i < SCENARIOS.length - 1}
          />
        ))}
      </div>

      {/* Theater slot */}
      {active ? (
        <DemoRunTheater
          key={active.runKey}
          scenario={active.scenario}
          runKey={active.runKey}
          realResult={active.realResult}
          onReplayRun={() => void handleRun(active.scenario)}
        />
      ) : (
        <EmptyTheater />
      )}

      {/* Gemini advisory screen panel */}
      {(screenResult || screenLoading) && (
        <div className="mt-4">
          <GeminiScreenPanel screen={screenResult} isLoading={screenLoading} />
        </div>
      )}

      <div className="hairline-top mt-4 pt-6 flex flex-col gap-2 text-[12px] text-text-tertiary leading-relaxed max-w-[62ch]">
        <div className="eyebrow text-text-secondary">Run notes</div>
        <p>
          The visual beats animate the agent path; the terminal frame reflects
          the real result from{" "}
          {USE_MOCKS ? "the in-browser ledger" : "the guard"}. Pause or step to
          narrate; replay to re-watch the run without re-dispatching it.
        </p>
      </div>
    </Section>
  );
}

function nextMockTxHash(): Hex {
  const value = mockTxCounter.toString(16).padStart(64, "0");
  mockTxCounter += 1n;
  return `0x${value}` as Hex;
}

function ScenarioCard({
  seq,
  label,
  expected,
  description,
  isActive,
  isRunning,
  onSelect,
  variant,
  borderRight,
}: {
  seq: string;
  label: string;
  expected: string;
  description: string;
  isActive: boolean;
  isRunning: boolean;
  onSelect: () => void;
  variant: "primary" | "danger" | "secondary";
  borderRight: boolean;
}) {
  const accent =
    variant === "danger"
      ? "var(--status-danger)"
      : variant === "secondary"
        ? "var(--status-warning)"
        : "var(--accent-bright)";
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isRunning}
      className={`
        group relative text-left flex flex-col gap-2 p-5
        transition-colors duration-[--duration-fast]
        hover:bg-bg-inset
        disabled:opacity-80 disabled:cursor-wait
        ${borderRight ? "md:border-r md:border-rule-subtle" : ""}
        ${isActive ? "bg-bg-inset" : ""}
      `}
    >
      {isActive && (
        <span
          aria-hidden
          className="absolute left-0 top-5 bottom-5 w-[2px]"
          style={{ background: accent }}
        />
      )}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat">
          {seq}
        </span>
        {isRunning ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] tnum tracking-wider uppercase text-accent-bright">
            <span
              aria-hidden
              className="led-pulse block"
              style={{ width: 5, height: 5, background: accent }}
            />
            running
          </span>
        ) : (
          <span
            className="font-mono text-[10.5px] tnum tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: accent }}
          >
            run →
          </span>
        )}
      </div>
      <h3
        className="font-display font-semibold tracking-tight text-text-primary"
        style={{ fontSize: "17px" }}
      >
        {label}
      </h3>
      <div className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat">
        expected: <span className="text-text-tertiary">{expected}</span>
      </div>
      <p className="text-[12px] text-text-tertiary leading-relaxed">
        {description}
      </p>
    </button>
  );
}

function EmptyTheater() {
  return (
    <div className="hairline-top mt-0 py-14 flex flex-col items-center justify-center gap-3 text-center">
      <span className="font-mono text-[10.5px] tnum tracking-[0.2em] uppercase text-text-quat">
        ready
      </span>
      <p className="text-[13px] text-text-tertiary max-w-[46ch]">
        Pick an action above to dispatch an agent run. The view will trace each
        beat and settle on the real outcome.
      </p>
    </div>
  );
}
