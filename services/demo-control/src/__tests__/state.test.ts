import { describe, expect, it } from "vitest";
import { createDemoStateStore } from "../state.js";

describe("createDemoStateStore", () => {
  it("tracks the current run lifecycle", () => {
    const store = createDemoStateStore();

    store.startRun("scenario-1", 1700000000);
    store.finishRun("scenario-1", "completed", {
      scenario: "legit",
      outcome: "success",
      txHash: "0xabc",
      receiptId: "0xdef",
    });

    expect(store.getLastRun()).toEqual({
      scenarioId: "scenario-1",
      status: "completed",
      result: {
        scenario: "legit",
        outcome: "success",
        txHash: "0xabc",
        receiptId: "0xdef",
      },
      startedAt: 1700000000,
    });
  });

  it("ignores stale completions after a newer run has started", () => {
    const store = createDemoStateStore();

    store.startRun("scenario-1", 1700000000);
    store.startRun("scenario-2", 1700000001);

    store.finishRun("scenario-1", "completed", {
      scenario: "legit",
      outcome: "success",
      txHash: "0xold",
    });

    expect(store.getLastRun()).toEqual({
      scenarioId: "scenario-2",
      status: "running",
      result: null,
      startedAt: 1700000001,
    });
  });

  it("records failures for the active run", () => {
    const store = createDemoStateStore();

    store.startRun("scenario-3", 1700000002);
    store.finishRun("scenario-3", "failed", {
      scenario: "blocked",
      outcome: "failed",
      error: "boom",
    });

    expect(store.getLastRun()).toEqual({
      scenarioId: "scenario-3",
      status: "failed",
      result: {
        scenario: "blocked",
        outcome: "failed",
        error: "boom",
      },
      startedAt: 1700000002,
    });
  });
});
