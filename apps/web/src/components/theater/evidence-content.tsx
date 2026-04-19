"use client";

import { motion } from "framer-motion";
import {
  POLICY_BY_SCENARIO,
  type Phase,
} from "@/components/demo/demo-visualizer";
import type { DemoScenario, DemoStatus } from "@/lib/types";
import type { EvidenceTab } from "@/components/ui/evidence-drawer";
import { easeStage } from "@/lib/motion";

interface Params {
  scenario: DemoScenario;
  phases: Phase[];
  phaseIndex: number;
  realResult: DemoStatus | null;
}

export function buildEvidenceTabs({
  scenario,
  phases,
  phaseIndex,
  realResult,
}: Params): EvidenceTab[] {
  return [
    {
      id: "overview",
      label: "Overview",
      content: <Overview scenario={scenario} realResult={realResult} />,
    },
    {
      id: "trace",
      label: "Trace",
      content: (
        <Trace phases={phases} phaseIndex={phaseIndex} realResult={realResult} />
      ),
    },
    {
      id: "policy",
      label: "Policy math",
      content: <PolicyMath scenario={scenario} />,
    },
    {
      id: "raw",
      label: "Raw",
      content: (
        <Raw scenario={scenario} realResult={realResult} phases={phases} />
      ),
    },
  ];
}

function Overview({
  scenario,
  realResult,
}: {
  scenario: DemoScenario;
  realResult: DemoStatus | null;
}) {
  const policy = POLICY_BY_SCENARIO[scenario];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
      <div>
        <span className="eyebrow text-text-secondary">What happened</span>
        <p className="mt-2 text-[13px] text-text-secondary leading-relaxed">
          {scenario === "legit" &&
            "The agent proposed a 2.0 USDC transfer to an allowlisted merchant. Every policy check passed; the guard co-signed and the transaction executed."}
          {scenario === "blocked" &&
            "The agent proposed 20.0 USDC to a target not on the owner's allowlist. The guard rejected the transaction pre-execution — USDC never moved."}
          {scenario === "overspend" &&
            "The agent proposed 15.0 USDC to an allowlisted merchant, exceeding the 10.0 USDC per-tx cap. The tx executed but the receipt is challengeable within the recourse window."}
        </p>
      </div>
      <div>
        <span className="eyebrow text-text-secondary">Parameters</span>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px] font-mono tnum">
          <dt className="text-text-quat">amount</dt>
          <dd className="text-text-primary text-right">
            {policy.amountUsdc} USDC
          </dd>
          <dt className="text-text-quat">per-tx cap</dt>
          <dd className="text-text-tertiary text-right">
            {policy.perTxCapUsdc} USDC
          </dd>
          <dt className="text-text-quat">daily cap</dt>
          <dd className="text-text-tertiary text-right">
            {policy.dailyCapUsdc} USDC
          </dd>
          <dt className="text-text-quat">counterparty</dt>
          <dd className="text-text-tertiary text-right">
            {policy.counterparty}
          </dd>
          <dt className="text-text-quat">verdict</dt>
          <dd
            className="text-right font-medium"
            style={{
              color:
                policy.verdict === "deny"
                  ? "var(--status-danger)"
                  : policy.verdict === "flag"
                    ? "var(--status-warning)"
                    : "var(--status-success)",
            }}
          >
            {policy.verdict.toUpperCase()}
          </dd>
          {realResult?.txHash && (
            <>
              <dt className="text-text-quat">tx hash</dt>
              <dd className="text-text-tertiary text-right truncate">
                {realResult.txHash.slice(0, 12)}…
              </dd>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}

function Trace({
  phases,
  phaseIndex,
  realResult,
}: {
  phases: Phase[];
  phaseIndex: number;
  realResult: DemoStatus | null;
}) {
  return (
    <ol className="flex flex-col">
      {phases.map((p, i) => {
        const state = i < phaseIndex ? "past" : i === phaseIndex ? "active" : "future";
        return (
          <motion.li
            key={p.id}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: easeStage, delay: i * 0.04 }}
            className="grid grid-cols-[auto_1fr_auto] gap-4 py-2.5 hairline-bottom last:border-b-0 items-baseline"
          >
            <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat w-8">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div
                className="font-display font-medium text-[13.5px] leading-tight"
                style={{
                  color:
                    state === "active"
                      ? "var(--text-primary)"
                      : state === "past"
                        ? "var(--text-secondary)"
                        : "var(--text-quat)",
                }}
              >
                {p.label}
              </div>
              <div className="mt-0.5 text-[11.5px] text-text-tertiary font-mono">
                {p.detail}
              </div>
            </div>
            <span
              className="font-mono text-[10px] tnum tracking-wider uppercase"
              style={{
                color:
                  state === "active"
                    ? "var(--accent-bright)"
                    : state === "past"
                      ? "var(--text-tertiary)"
                      : "var(--text-quat)",
              }}
            >
              {state === "active" && !realResult
                ? "active"
                : state === "past"
                  ? "done"
                  : state === "active"
                    ? "now"
                    : "…"}
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}

function PolicyMath({ scenario }: { scenario: DemoScenario }) {
  const policy = POLICY_BY_SCENARIO[scenario];
  const rows: [string, string, string, "pass" | "fail" | "flag"][] = [
    [
      "ALLOWLIST(target)",
      policy.counterpartyAllowed ? "true" : "false",
      policy.counterpartyAllowed ? "MATCH" : "NO_MATCH",
      policy.counterpartyAllowed ? "pass" : "fail",
    ],
    [
      "AMOUNT ≤ PER_TX_CAP",
      `${policy.amountUsdc} ≤ ${policy.perTxCapUsdc}`,
      policy.amountExceedsPerTx
        ? scenario === "overspend"
          ? "EXCEEDS → FLAG"
          : "EXCEEDS → DENY"
        : "WITHIN",
      policy.amountExceedsPerTx ? (scenario === "overspend" ? "flag" : "fail") : "pass",
    ],
    [
      "ROLLING_24H + AMOUNT ≤ DAILY_CAP",
      `${policy.amountUsdc} ≤ ${policy.dailyCapUsdc}`,
      "WITHIN",
      "pass",
    ],
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8">
      <ol className="flex flex-col">
        {rows.map(([expr, eval_, verdict, tone], i) => (
          <li
            key={expr}
            className="grid grid-cols-[auto_1fr_auto] gap-4 py-2.5 hairline-bottom last:border-b-0 items-baseline"
          >
            <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat w-6">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="font-mono text-[12px] text-text-primary">
                {expr}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-text-tertiary">
                evaluates → {eval_}
              </div>
            </div>
            <span
              className="font-mono text-[10.5px] tnum tracking-wider uppercase"
              style={{
                color:
                  tone === "fail"
                    ? "var(--status-danger)"
                    : tone === "flag"
                      ? "var(--status-warning)"
                      : "var(--status-success)",
              }}
            >
              {verdict}
            </span>
          </li>
        ))}
      </ol>
      <div className="min-w-[200px]">
        <span className="eyebrow text-text-secondary">Final verdict</span>
        <div
          className="mt-2 font-display font-semibold tracking-tight"
          style={{
            fontSize: "var(--t-lg)",
            letterSpacing: "-0.02em",
            color:
              policy.verdict === "deny"
                ? "var(--status-danger)"
                : policy.verdict === "flag"
                  ? "var(--status-warning)"
                  : "var(--status-success)",
          }}
        >
          {policy.verdict.toUpperCase()}
        </div>
        {policy.reasonCode && (
          <div className="mt-1 font-mono text-[11px] tnum text-text-tertiary">
            {policy.reasonCode.replace(/_/g, " ").toLowerCase()}
          </div>
        )}
      </div>
    </div>
  );
}

function Raw({
  scenario,
  realResult,
  phases,
}: {
  scenario: DemoScenario;
  realResult: DemoStatus | null;
  phases: Phase[];
}) {
  const payload = {
    scenario,
    phases: phases.map((p) => ({ id: p.id, label: p.label, kind: p.kind })),
    realResult,
  };
  return (
    <pre
      className="font-mono text-[11px] leading-relaxed text-text-secondary bg-bg-inset/40 p-4 overflow-x-auto"
      style={{ border: "1px solid var(--rule-subtle)" }}
    >
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}
