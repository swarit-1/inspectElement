"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  POLICY_BY_SCENARIO,
  resolveTerminal,
  type Phase,
} from "@/components/demo/demo-visualizer";
import {
  PolicyCheck,
  type PolicyCheckState,
} from "@/components/ui/policy-check";
import type { DemoScenario, DemoStatus } from "@/lib/types";
import { easeOutExpo } from "@/lib/motion";
import { USE_MOCKS, truncateAddress } from "@/lib/constants";

interface DecisionPanelProps {
  scenario: DemoScenario;
  phase: Phase;
  phaseIndex: number;
  phases: Phase[];
  isTerminal: boolean;
  isHolding: boolean;
  realResult: DemoStatus | null;
  onReplayRun: () => void;
}

export function DecisionPanel({
  scenario,
  phase,
  phaseIndex,
  phases,
  isTerminal,
  isHolding,
  realResult,
  onReplayRun,
}: DecisionPanelProps) {
  const policy = POLICY_BY_SCENARIO[scenario];
  const terminal = resolveTerminal(scenario, realResult);

  const phaseReached: "pre-guard" | "at-guard" | "post-guard" | "terminal" =
    isTerminal
      ? "terminal"
      : phase.node === "guard"
        ? "at-guard"
        : phaseIndex < phases.findIndex((p) => p.node === "guard")
          ? "pre-guard"
          : "post-guard";

  const reached = phaseReached !== "pre-guard";
  const past = phaseReached === "post-guard" || phaseReached === "terminal";

  const allowState: PolicyCheckState = !reached
    ? "pending"
    : policy.counterpartyAllowed
      ? "pass"
      : "fail";
  const perTxState: PolicyCheckState = !reached
    ? "pending"
    : policy.amountExceedsPerTx
      ? scenario === "overspend"
        ? "flag"
        : "fail"
      : "pass";
  const dailyState: PolicyCheckState = !past ? "pending" : "pass";

  const outcomeColor =
    terminal.kind === "blocked" || terminal.kind === "failed"
      ? "var(--status-danger)"
      : terminal.kind === "overspend"
        ? "var(--status-warning)"
        : isTerminal
          ? "var(--status-success)"
          : "var(--accent-bright)";

  const outcomeLabel = isTerminal
    ? terminal.kind === "blocked"
      ? "Blocked at guard"
      : terminal.kind === "overspend"
        ? "Executed · challengeable"
        : terminal.kind === "failed"
          ? "Run failed"
          : "Payment executed"
    : isHolding
      ? "Awaiting result"
      : phase.label;

  const plainEnglish = isTerminal
    ? terminal.detail
    : scenario === "blocked"
      ? "The guard is evaluating a transfer to a target the owner never allowed. The stablecoin will not move."
      : scenario === "overspend"
        ? "The amount exceeds the per-tx cap. If executed, the receipt will be challengeable."
        : "The transfer is within every owner-set cap. Guard will sign and forward.";

  return (
    <aside className="flex flex-col hairline-top hairline-bottom">
      {/* Outcome */}
      <div className="px-5 pt-5 pb-5 hairline-bottom">
        <span className="eyebrow text-text-secondary">Decision</span>
        <AnimatePresence mode="wait">
          <motion.div
            key={outcomeLabel}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.32, ease: easeOutExpo }}
            className="mt-2"
          >
            <div
              className="font-display font-semibold tracking-tight"
              style={{
                fontSize: "var(--t-xl)",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: outcomeColor,
              }}
            >
              {outcomeLabel}
            </div>
            <p
              className="mt-2 text-text-secondary"
              style={{ fontSize: "var(--t-sm)", lineHeight: 1.55 }}
            >
              {plainEnglish}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Policy checks */}
      <div className="px-5 py-4 hairline-bottom">
        <div className="flex items-baseline justify-between mb-1">
          <span className="eyebrow text-text-secondary">Policy checks</span>
          <span className="font-mono text-[10.5px] tnum tracking-wider uppercase text-text-quat">
            3 · required
          </span>
        </div>
        <ul>
          <PolicyCheck
            label="Counterparty allowlist"
            plainEnglish={
              policy.counterpartyAllowed
                ? "Target is on the owner's allowlist."
                : "Target is not in the owner's allowlist."
            }
            state={allowState}
            detail={policy.counterparty}
            index={0}
          />
          <PolicyCheck
            label="Per-transaction cap"
            plainEnglish={
              policy.amountExceedsPerTx
                ? `Amount ${policy.amountUsdc} USD exceeds ${policy.perTxCapUsdc} cap.`
                : `Amount ${policy.amountUsdc} USD within ${policy.perTxCapUsdc} cap.`
            }
            state={perTxState}
            detail={`${policy.amountUsdc} / ${policy.perTxCapUsdc} USD`}
            index={1}
          />
          <PolicyCheck
            label="Daily spend cap"
            plainEnglish={`Within ${policy.dailyCapUsdc} USD over 24h window.`}
            state={dailyState}
            detail={`${policy.amountUsdc} / ${policy.dailyCapUsdc} USD`}
            index={2}
          />
        </ul>
      </div>

      {/* Next action */}
      <div className="px-5 py-4 flex flex-col gap-2">
        <span className="eyebrow text-text-secondary">Next action</span>
        {!isTerminal ? (
          <p className="text-[12.5px] text-text-tertiary leading-relaxed">
            The decision will resolve once the guard completes evaluation and
            the indexer confirms the terminal state.
          </p>
        ) : terminal.cta === "open-receipt" && realResult?.receiptId ? (
          <div className="flex flex-col gap-2">
            <p className="text-[12.5px] text-text-secondary leading-relaxed">
              {scenario === "overspend"
                ? "Open the receipt to file an AmountViolation challenge within the recourse window."
                : "Receipt minted. The ledger shows every check that ran."}
            </p>
            <Link
              href={`/receipt/${realResult.receiptId}`}
              className="inline-flex items-center gap-2 font-mono text-[12px] tnum text-accent hover:text-accent-bright underline-offset-4 hover:underline"
            >
              open receipt · {truncateAddress(realResult.receiptId, 6)} →
            </Link>
            {realResult.txHash && !USE_MOCKS && (
              <a
                href={`https://sepolia.basescan.org/tx/${realResult.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11.5px] tnum text-text-tertiary hover:text-text-primary underline-offset-4 hover:underline"
              >
                view tx on basescan ↗
              </a>
            )}
          </div>
        ) : terminal.kind === "blocked" ? (
          <p className="text-[12.5px] text-text-secondary leading-relaxed">
            The guard rejected this transfer{" "}
            <span className="text-text-primary font-medium">
              before any funds moved
            </span>
            . No receipt is issued; no challenge is required.
          </p>
        ) : terminal.cta === "retry" ? (
          <button
            type="button"
            onClick={onReplayRun}
            className="inline-flex items-center gap-2 font-mono text-[12px] tnum text-accent hover:text-accent-bright underline-offset-4 hover:underline text-left"
          >
            retry scenario →
          </button>
        ) : (
          <p className="text-[12.5px] text-text-tertiary leading-relaxed">
            Run complete.
          </p>
        )}
      </div>
    </aside>
  );
}
