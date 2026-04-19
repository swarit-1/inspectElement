"use client";

import { memo } from "react";
import {
  POLICY_BY_SCENARIO,
  type PolicySnapshot,
} from "./demo-visualizer";
import type { DemoScenario, DemoStatus } from "@/lib/types";

interface Props {
  scenario: DemoScenario;
  phaseReached: "pre-guard" | "at-guard" | "post-guard" | "terminal";
  realResult: DemoStatus | null;
}

/**
 * Layer C — the math the guard is running. Amount vs per-tx cap shown as a
 * bar; allowlist as a pill; verdict as the loudest line. Revealed reasonCode
 * overrides scripted verdict once real result lands.
 */
function PolicyPanelImpl({ scenario, phaseReached, realResult }: Props) {
  const policy: PolicySnapshot = POLICY_BY_SCENARIO[scenario];

  // Hide verdict until guard has evaluated; swap scripted verdict for real one.
  const showVerdict = phaseReached !== "pre-guard";
  const verdict: PolicySnapshot["verdict"] =
    realResult && realResult.status !== "running"
      ? realResult.reasonCode
        ? "deny"
        : scenario === "overspend" && realResult.receiptId
          ? "flag"
          : "allow"
      : policy.verdict;

  const reasonCode =
    realResult?.reasonCode ?? policy.reasonCode ?? undefined;

  const amountVal = parseFloat(policy.amountUsdc);
  const capVal = parseFloat(policy.perTxCapUsdc);
  const ratio = Math.min(amountVal / capVal, 2);
  const exceeds = amountVal > capVal;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <div className="eyebrow text-text-secondary">Policy math</div>
        <div className="font-mono text-[11px] tnum text-text-quat tracking-wider">
          guarded-executor
        </div>
      </div>

      {/* Amount vs per-tx cap bar */}
      <div className="flex flex-col gap-2 py-4 hairline-bottom">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[11px] tnum tracking-wider uppercase text-text-tertiary">
            amount
          </span>
          <span
            className="font-mono text-[13px] tnum"
            style={{
              color: exceeds ? "var(--status-warning)" : "var(--text-primary)",
            }}
          >
            {policy.amountUsdc} USD
          </span>
        </div>
        <div className="relative h-[10px] overflow-hidden" style={{ background: "var(--bg-inset)" }}>
          <div
            className="absolute top-0 bottom-0 left-0 transition-[width] duration-500"
            style={{
              width: `${Math.min(ratio / 2, 1) * 100}%`,
              background: exceeds
                ? "var(--status-warning)"
                : "var(--accent-dim)",
              opacity: 0.9,
            }}
            aria-hidden
          />
          {/* Cap marker at 50% (since ratio / 2 means cap is halfway) */}
          <div
            className="absolute top-0 bottom-0"
            style={{
              left: "50%",
              width: 2,
              background: "var(--text-primary)",
              opacity: 0.6,
            }}
            aria-hidden
          />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat">
            per-tx cap · {policy.perTxCapUsdc} USD
          </span>
          {exceeds && (
            <span
              className="font-mono text-[10.5px] tnum tracking-wider uppercase"
              style={{ color: "var(--status-warning)" }}
            >
              {policy.amountUsdc} {">"} {policy.perTxCapUsdc}
            </span>
          )}
        </div>
      </div>

      {/* Counterparty allowlist */}
      <div className="flex items-center justify-between py-4 hairline-bottom">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-mono text-[11px] tnum tracking-wider uppercase text-text-tertiary">
            counterparty
          </span>
          <span className="font-mono text-[12px] tnum text-text-primary truncate">
            {policy.counterparty}
          </span>
        </div>
        <span
          className="font-mono text-[10.5px] tnum tracking-wider uppercase px-2 py-1"
          style={{
            color: policy.counterpartyAllowed
              ? "var(--status-success)"
              : "var(--status-danger)",
            background: policy.counterpartyAllowed
              ? "var(--status-success-dim)"
              : "var(--status-danger-dim)",
            opacity: 0.85,
          }}
        >
          {policy.counterpartyAllowed ? "on allowlist" : "not allowlisted"}
        </span>
      </div>

      {/* Daily cap (static) */}
      <div className="flex items-center justify-between py-4 hairline-bottom">
        <span className="font-mono text-[11px] tnum tracking-wider uppercase text-text-tertiary">
          daily cap
        </span>
        <span className="font-mono text-[12px] tnum text-text-secondary">
          {policy.dailyCapUsdc} USD
        </span>
      </div>

      {/* Verdict */}
      <div className="pt-5">
        <div className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat mb-2">
          verdict
        </div>
        {showVerdict ? (
          <VerdictLine verdict={verdict} reasonCode={reasonCode} />
        ) : (
          <span className="font-mono text-[13px] tnum tracking-wide text-text-tertiary">
            pending…
          </span>
        )}
      </div>
    </div>
  );
}

function VerdictLine({
  verdict,
  reasonCode,
}: {
  verdict: PolicySnapshot["verdict"];
  reasonCode?: string;
}) {
  if (verdict === "deny") {
    return (
      <div className="flex flex-col gap-1.5">
        <span
          className="font-display text-[22px] font-semibold tracking-tight"
          style={{ color: "var(--status-danger)" }}
        >
          DENY
        </span>
        {reasonCode && (
          <span className="font-mono text-[11px] tnum tracking-wider uppercase text-text-secondary">
            reason · {reasonCode.replace(/_/g, " ").toLowerCase()}
          </span>
        )}
      </div>
    );
  }
  if (verdict === "flag") {
    return (
      <div className="flex flex-col gap-1.5">
        <span
          className="font-display text-[22px] font-semibold tracking-tight"
          style={{ color: "var(--status-warning)" }}
        >
          FORWARD · FLAGGED
        </span>
        <span className="font-mono text-[11px] tnum tracking-wider uppercase text-text-secondary">
          receipt challengeable · amount violation
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="font-display text-[22px] font-semibold tracking-tight"
        style={{ color: "var(--status-success)" }}
      >
        ALLOW
      </span>
      <span className="font-mono text-[11px] tnum tracking-wider uppercase text-text-secondary">
        within caps · counterparty on allowlist
      </span>
    </div>
  );
}

export const DemoPolicyPanel = memo(PolicyPanelImpl);
