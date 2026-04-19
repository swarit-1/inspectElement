import type { BlockedReason, DemoScenario, DemoStatus } from "@/lib/types";

/**
 * The stage has five fixed nodes. Packet travels between them.
 * Positions are % across the corridor — tuned for visual rhythm, not math.
 */
export type StageNode = "owner" | "agent" | "guard" | "target" | "receipt";

/** Percent along the corridor; even rhythm so five grid columns align without overlap. */
export const NODE_POSITION: Record<StageNode, number> = {
  owner: 10,
  agent: 30,
  guard: 50,
  target: 70,
  receipt: 90,
};

export const NODE_LABEL: Record<StageNode, string> = {
  owner: "Owner",
  agent: "Agent",
  guard: "Guard",
  target: "Target",
  receipt: "Receipt",
};

/** Optional second-line caption for stages that have room (decision panel, evidence). */
export const NODE_SUBLABEL: Record<StageNode, string> = {
  owner: "Intent",
  agent: "Runtime",
  guard: "Checkpoint",
  target: "Contract",
  receipt: "Recourse",
};

/**
 * `normal` — plain forward beat, default tone
 * `guard-evaluating` — guard flashes while evaluating, packet paused at guard
 * `guard-deny` — terminal for `blocked`: dramatic stop; packet crashes into guard
 * `guard-warn` — for `overspend`: guard passes amber; barrier bends, doesn't break
 * `hold` — awaits real result; theater stalls here, shows "Awaiting…"
 * `terminal` — last beat, must mirror real outcome
 */
export type PhaseKind =
  | "normal"
  | "guard-evaluating"
  | "guard-deny"
  | "guard-warn"
  | "hold"
  | "terminal";

export interface Phase {
  id: string;
  /** Vertical timeline label. */
  label: string;
  /** Single-line detail shown in the waterfall under the label. */
  detail: string;
  /** Which node the packet is at (or heading to) during this phase. */
  node: StageNode;
  /** Duration, ms. `hold`/`terminal` phases ignore this. */
  durationMs: number;
  kind: PhaseKind;
  /** If true, theater pauses here until `realResult` is known. */
  holdsForRealResult?: boolean;
}

const LEGIT: Phase[] = [
  {
    id: "intent",
    label: "Intent matched",
    detail: "Owner's signed manifest loaded from vault.",
    node: "owner",
    durationMs: 500,
    kind: "normal",
  },
  {
    id: "dispatch",
    label: "Agent dispatched",
    detail: "Runtime assembles tx · 2.0 USD → allowlisted merchant.",
    node: "agent",
    durationMs: 650,
    kind: "normal",
  },
  {
    id: "guard-eval",
    label: "Guard evaluating",
    detail: "Policy check · allowlist · per-tx cap · daily cap.",
    node: "guard",
    durationMs: 700,
    kind: "guard-evaluating",
  },
  {
    id: "guard-pass",
    label: "Policy OK",
    detail: "Guard signs · tx forwarded to target.",
    node: "guard",
    durationMs: 450,
    kind: "normal",
  },
  {
    id: "exec",
    label: "Target executed",
    detail: "Stablecoin transferred on-chain.",
    node: "target",
    durationMs: 600,
    kind: "normal",
  },
  {
    id: "await",
    label: "Awaiting receipt",
    detail: "Indexer catching the confirmed receipt…",
    node: "receipt",
    durationMs: 0,
    kind: "hold",
    holdsForRealResult: true,
  },
  {
    id: "terminal",
    label: "Receipt confirmed",
    detail: "Ledger updated.",
    node: "receipt",
    durationMs: 0,
    kind: "terminal",
  },
];

const BLOCKED: Phase[] = [
  {
    id: "intent",
    label: "Intent matched",
    detail: "Owner's signed manifest loaded from vault.",
    node: "owner",
    durationMs: 500,
    kind: "normal",
  },
  {
    id: "dispatch",
    label: "Agent dispatched",
    detail: "Runtime assembles tx · 20.0 USD → unknown target.",
    node: "agent",
    durationMs: 650,
    kind: "normal",
  },
  {
    id: "guard-eval",
    label: "Guard evaluating",
    detail: "Counterparty not on owner's allowlist.",
    node: "guard",
    durationMs: 900,
    kind: "guard-evaluating",
  },
  {
    id: "await",
    label: "Awaiting verdict",
    detail: "Confirming denial with indexer…",
    node: "guard",
    durationMs: 0,
    kind: "hold",
    holdsForRealResult: true,
  },
  {
    id: "terminal",
    label: "Blocked at guard",
    detail: "Stablecoin never moved. No receipt issued.",
    node: "guard",
    durationMs: 0,
    kind: "terminal",
  },
];

const OVERSPEND: Phase[] = [
  {
    id: "intent",
    label: "Intent matched",
    detail: "Owner's signed manifest loaded from vault.",
    node: "owner",
    durationMs: 500,
    kind: "normal",
  },
  {
    id: "dispatch",
    label: "Agent dispatched",
    detail: "Runtime assembles tx · 15.0 USD → allowlisted merchant.",
    node: "agent",
    durationMs: 650,
    kind: "normal",
  },
  {
    id: "guard-eval",
    label: "Guard evaluating",
    detail: "Counterparty OK · amount exceeds per-tx cap (10.0).",
    node: "guard",
    durationMs: 800,
    kind: "guard-warn",
  },
  {
    id: "guard-pass-amber",
    label: "Forwarded · flagged",
    detail: "Executes under recourse window. Challengeable.",
    node: "guard",
    durationMs: 500,
    kind: "guard-warn",
  },
  {
    id: "exec",
    label: "Target executed",
    detail: "Stablecoin transferred · receipt marked challengeable.",
    node: "target",
    durationMs: 600,
    kind: "normal",
  },
  {
    id: "await",
    label: "Awaiting receipt",
    detail: "Indexer confirming challengeable receipt…",
    node: "receipt",
    durationMs: 0,
    kind: "hold",
    holdsForRealResult: true,
  },
  {
    id: "terminal",
    label: "Receipt · recourse open",
    detail: "File AmountViolation challenge from receipt page.",
    node: "receipt",
    durationMs: 0,
    kind: "terminal",
  },
];

export const PHASES_BY_SCENARIO: Record<DemoScenario, Phase[]> = {
  legit: LEGIT,
  blocked: BLOCKED,
  overspend: OVERSPEND,
};

export function getPhases(scenario: DemoScenario): Phase[] {
  return PHASES_BY_SCENARIO[scenario];
}

export function getTerminalIndex(scenario: DemoScenario): number {
  return PHASES_BY_SCENARIO[scenario].length - 1;
}

/** Pure: given a phase index and a real result, can the theater advance past a hold? */
export function canLeaveHold(
  phase: Phase,
  realResult: DemoStatus | null
): boolean {
  if (!phase.holdsForRealResult) return true;
  return realResult !== null && realResult.status !== "running";
}

/**
 * The terminal phase must mirror the real outcome. When the real run diverges
 * from the scripted scenario (e.g. user picked `legit` but demo-control
 * returned `failed`), the terminal beat carries the truth.
 */
export interface TerminalPresentation {
  kind: "success" | "blocked" | "overspend" | "failed";
  title: string;
  detail: string;
  /** Optional key to render an action (receipt link, retry, etc). */
  cta?: "open-receipt" | "retry" | "view-tx";
  reasonCode?: BlockedReason;
}

export function resolveTerminal(
  scenario: DemoScenario,
  realResult: DemoStatus | null
): TerminalPresentation {
  if (!realResult || realResult.status === "running") {
    // Theater shouldn't reach terminal before real result — but if it does,
    // present the scripted expectation without claiming success.
    if (scenario === "blocked") {
      return {
        kind: "blocked",
        title: "Awaiting denial",
        detail: "Expected outcome pending confirmation.",
      };
    }
    return {
      kind: scenario === "overspend" ? "overspend" : "success",
      title: "Awaiting confirmation",
      detail: "Expected outcome pending receipt.",
    };
  }

  if (realResult.status === "failed") {
    return {
      kind: "failed",
      title: "Run failed",
      detail: realResult.error ?? "Unknown error from runtime.",
      cta: "retry",
    };
  }

  if (realResult.reasonCode) {
    return {
      kind: "blocked",
      title: "Blocked at guard",
      detail: `Reason · ${realResult.reasonCode.replace(/_/g, " ").toLowerCase()}. The stablecoin never moved.`,
      reasonCode: realResult.reasonCode,
    };
  }

  if (scenario === "overspend" && realResult.receiptId) {
    return {
      kind: "overspend",
      title: "Receipt · recourse open",
      detail: "Amount exceeded per-tx cap. File challenge from receipt.",
      cta: "open-receipt",
    };
  }

  if (realResult.receiptId) {
    return {
      kind: "success",
      title: "Payment executed",
      detail: "Receipt minted · ledger updated.",
      cta: "open-receipt",
    };
  }

  return {
    kind: "success",
    title: "Run complete",
    detail: "No receipt returned.",
  };
}

/**
 * The three gauges the math panel renders. Scenario-data driven so the panel
 * renders the same numbers the guard is evaluating in prose above.
 */
export interface PolicySnapshot {
  amountUsdc: string;
  perTxCapUsdc: string;
  dailyCapUsdc: string;
  counterparty: string;
  counterpartyAllowed: boolean;
  amountExceedsPerTx: boolean;
  verdict: "allow" | "deny" | "flag";
  reasonCode?: BlockedReason;
}

export const POLICY_BY_SCENARIO: Record<DemoScenario, PolicySnapshot> = {
  legit: {
    amountUsdc: "2.0",
    perTxCapUsdc: "10.0",
    dailyCapUsdc: "50.0",
    counterparty: "0x0a01…0a01",
    counterpartyAllowed: true,
    amountExceedsPerTx: false,
    verdict: "allow",
  },
  blocked: {
    amountUsdc: "20.0",
    perTxCapUsdc: "10.0",
    dailyCapUsdc: "50.0",
    counterparty: "0xbeef…dead",
    counterpartyAllowed: false,
    amountExceedsPerTx: true,
    verdict: "deny",
    reasonCode: "COUNTERPARTY_NOT_ALLOWED",
  },
  overspend: {
    amountUsdc: "15.0",
    perTxCapUsdc: "10.0",
    dailyCapUsdc: "50.0",
    counterparty: "0x0a01…0a01",
    counterpartyAllowed: true,
    amountExceedsPerTx: true,
    verdict: "flag",
  },
};
