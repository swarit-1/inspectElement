import type { ScenarioResult } from "../../../agents/shared.js";

export interface DemoState {
  readonly scenarioId: string;
  readonly status: "running" | "completed" | "failed";
  readonly result: ScenarioResult | null;
  readonly startedAt: number;
}

export interface DemoStateStore {
  startRun(scenarioId: string, startedAt?: number): DemoState;
  finishRun(
    scenarioId: string,
    status: "completed" | "failed",
    result: ScenarioResult
  ): DemoState | null;
  getLastRun(): DemoState | null;
}

export function createDemoStateStore(): DemoStateStore {
  let lastRun: DemoState | null = null;

  return {
    startRun(scenarioId, startedAt = Date.now()) {
      lastRun = {
        scenarioId,
        status: "running",
        result: null,
        startedAt,
      };
      return lastRun;
    },

    finishRun(scenarioId, status, result) {
      if (!lastRun || lastRun.scenarioId !== scenarioId) {
        return lastRun;
      }

      lastRun = {
        ...lastRun,
        status,
        result,
      };
      return lastRun;
    },

    getLastRun() {
      return lastRun;
    },
  };
}
