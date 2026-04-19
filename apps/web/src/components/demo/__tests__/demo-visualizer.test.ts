import { describe, expect, it } from "vitest";
import {
  canLeaveHold,
  getPhases,
  getTerminalIndex,
  PHASES_BY_SCENARIO,
  POLICY_BY_SCENARIO,
  resolveTerminal,
} from "../demo-visualizer";

describe("demo-visualizer · phase definitions", () => {
  it("every scenario has a terminal last phase", () => {
    for (const scenario of ["legit", "blocked", "overspend"] as const) {
      const phases = getPhases(scenario);
      expect(phases[phases.length - 1]?.kind).toBe("terminal");
      expect(getTerminalIndex(scenario)).toBe(phases.length - 1);
    }
  });

  it("every scenario has exactly one hold phase before terminal", () => {
    for (const scenario of ["legit", "blocked", "overspend"] as const) {
      const phases = PHASES_BY_SCENARIO[scenario];
      const holds = phases.filter((p) => p.kind === "hold");
      expect(holds).toHaveLength(1);
      expect(holds[0].holdsForRealResult).toBe(true);
    }
  });

  it("blocked scenario parks the packet at the guard node", () => {
    const phases = PHASES_BY_SCENARIO.blocked;
    const terminal = phases[phases.length - 1];
    expect(terminal.node).toBe("guard");
  });

  it("legit and overspend scenarios settle at the receipt node", () => {
    expect(PHASES_BY_SCENARIO.legit.at(-1)?.node).toBe("receipt");
    expect(PHASES_BY_SCENARIO.overspend.at(-1)?.node).toBe("receipt");
  });
});

describe("demo-visualizer · canLeaveHold", () => {
  const holdPhase = PHASES_BY_SCENARIO.legit.find((p) => p.kind === "hold")!;

  it("blocks when real result is null", () => {
    expect(canLeaveHold(holdPhase, null)).toBe(false);
  });

  it("blocks while real result is still running", () => {
    expect(
      canLeaveHold(holdPhase, { scenario: "legit", status: "running" }),
    ).toBe(false);
  });

  it("allows advance when real result has landed", () => {
    expect(
      canLeaveHold(holdPhase, {
        scenario: "legit",
        status: "success",
        receiptId: "0xabc" as `0x${string}`,
      }),
    ).toBe(true);
  });

  it("lets non-hold phases pass through regardless of result", () => {
    const normalPhase = PHASES_BY_SCENARIO.legit[0];
    expect(canLeaveHold(normalPhase, null)).toBe(true);
  });
});

describe("demo-visualizer · resolveTerminal (truthful reconciliation)", () => {
  it("reports failed when runtime failed, regardless of scenario", () => {
    const result = resolveTerminal("legit", {
      scenario: "legit",
      status: "failed",
      error: "runtime offline",
    });
    expect(result.kind).toBe("failed");
    expect(result.detail).toContain("runtime offline");
    expect(result.cta).toBe("retry");
  });

  it("overrides scripted success when real result carries a reasonCode", () => {
    const result = resolveTerminal("legit", {
      scenario: "legit",
      status: "success",
      reasonCode: "COUNTERPARTY_NOT_ALLOWED",
    });
    expect(result.kind).toBe("blocked");
    expect(result.reasonCode).toBe("COUNTERPARTY_NOT_ALLOWED");
  });

  it("presents overspend with recourse cta when receiptId exists", () => {
    const result = resolveTerminal("overspend", {
      scenario: "overspend",
      status: "success",
      receiptId: "0xabc" as `0x${string}`,
    });
    expect(result.kind).toBe("overspend");
    expect(result.cta).toBe("open-receipt");
  });

  it("falls back to pending when real result is missing", () => {
    const result = resolveTerminal("legit", null);
    expect(result.title).toMatch(/await/i);
  });
});

describe("demo-visualizer · policy snapshots", () => {
  it("legit allows within caps", () => {
    const p = POLICY_BY_SCENARIO.legit;
    expect(p.verdict).toBe("allow");
    expect(p.counterpartyAllowed).toBe(true);
    expect(p.amountExceedsPerTx).toBe(false);
  });

  it("blocked denies with a reasonCode", () => {
    const p = POLICY_BY_SCENARIO.blocked;
    expect(p.verdict).toBe("deny");
    expect(p.counterpartyAllowed).toBe(false);
    expect(p.reasonCode).toBe("COUNTERPARTY_NOT_ALLOWED");
  });

  it("overspend flags but allows counterparty", () => {
    const p = POLICY_BY_SCENARIO.overspend;
    expect(p.verdict).toBe("flag");
    expect(p.counterpartyAllowed).toBe(true);
    expect(p.amountExceedsPerTx).toBe(true);
  });
});
