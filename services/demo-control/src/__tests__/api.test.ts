import type { Application } from "express";
import { describe, expect, it, vi } from "vitest";
import { createDemoControlApp } from "../index.js";

const MOCK_ENV = {
  account: { address: "0x" + "22".repeat(20) },
  ownerAccount: { address: "0x" + "33".repeat(20) },
  ownerAddress: ("0x" + "33".repeat(20)) as `0x${string}`,
  agentId: ("0x" + "44".repeat(32)) as `0x${string}`,
  rpcUrl: "http://localhost:8545",
  traceServiceUrl: "http://localhost:7403",
  signerProvider: "local" as const,
} as const;

describe("createDemoControlApp", () => {
  it("runs the legit scenario for the requested owner and exposes the latest success via /demo/status", async () => {
    const runExecuteFlow = vi.fn(async () => ({
      scenario: "legit",
      outcome: "success" as const,
      txHash: "0xabc",
      receiptId: "0xdef",
    }));
    const loadAgentEnv = vi.fn(async (ownerAddress?: `0x${string}`) => ({
      ...MOCK_ENV,
      ownerAddress: ownerAddress ?? MOCK_ENV.ownerAddress,
    }));

    const app = createDemoControlApp({
      loadAgentEnv: loadAgentEnv as never,
      runExecuteFlow,
      createScenarioId: () => "scenario-legit",
    });

    const requestedOwner = ("0x" + "55".repeat(20)) as `0x${string}`;
    const start = await invokeRoute(app, "post", "/demo/run-legit", {
      ownerAddress: requestedOwner,
    });
    expect(start.statusCode).toBe(200);
    expect(start.body).toEqual({
      status: "running",
      scenarioId: "scenario-legit",
    });

    const status = await invokeRoute(app, "get", "/demo/status");
    expect(status.statusCode).toBe(200);
    expect(status.body.last).toEqual({
      scenarioId: "scenario-legit",
      status: "completed",
      outcome: "success",
      txHash: "0xabc",
      reasonCode: null,
      reasonCodeHex: null,
      receiptId: "0xdef",
      error: null,
    });
    expect(loadAgentEnv).toHaveBeenCalledWith(requestedOwner);
    expect(runExecuteFlow).toHaveBeenCalledWith(
      "legit",
      expect.objectContaining({ ownerAddress: requestedOwner })
    );
  });

  it("uses the preflight-only flow for blocked runs", async () => {
    const runExecuteFlow = vi.fn();
    const runPreflightOnlyFlow = vi.fn(async () => ({
      scenario: "blocked",
      outcome: "blocked" as const,
      reasonCode: "COUNTERPARTY_NOT_ALLOWED",
      reasonCodeHex: "0x" + "aa".repeat(32),
    }));

    const app = createDemoControlApp({
      loadAgentEnv: async () => MOCK_ENV as never,
      runExecuteFlow,
      runPreflightOnlyFlow,
      createScenarioId: () => "scenario-blocked",
    });

    const start = await invokeRoute(app, "post", "/demo/run-blocked");
    expect(start.statusCode).toBe(200);
    expect(start.body.scenarioId).toBe("scenario-blocked");

    const status = await invokeRoute(app, "get", "/demo/status");
    expect(status.body.last).toEqual({
      scenarioId: "scenario-blocked",
      status: "completed",
      outcome: "blocked",
      txHash: null,
      reasonCode: "COUNTERPARTY_NOT_ALLOWED",
      reasonCodeHex: "0x" + "aa".repeat(32),
      receiptId: null,
      error: null,
    });
    expect(runPreflightOnlyFlow).toHaveBeenCalledWith(MOCK_ENV);
    expect(runExecuteFlow).not.toHaveBeenCalled();
  });

  it("records failures for async scenario execution", async () => {
    const app = createDemoControlApp({
      loadAgentEnv: async () => MOCK_ENV as never,
      runExecuteFlow: vi.fn(async () => {
        throw new Error("trace upload failed");
      }),
      createScenarioId: () => "scenario-failed",
    });

    const start = await invokeRoute(app, "post", "/demo/run-overspend");
    expect(start.statusCode).toBe(200);

    const status = await invokeRoute(app, "get", "/demo/status");
    expect(status.body.last).toEqual({
      scenarioId: "scenario-failed",
      status: "failed",
      outcome: "failed",
      txHash: null,
      reasonCode: null,
      reasonCodeHex: null,
      receiptId: null,
      error: "trace upload failed",
    });
  });

  it("exposes live runtime config for the dashboard", async () => {
    const app = createDemoControlApp({
      loadAgentEnv: async () => MOCK_ENV as never,
    });

    const response = await invokeRoute(app, "get", "/demo/config");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      agentId: MOCK_ENV.agentId,
      operatorAddress: MOCK_ENV.account.address,
      ownerAddress: MOCK_ENV.ownerAddress,
      signerProvider: MOCK_ENV.signerProvider,
    });
  });

  it("rejects malformed owner addresses", async () => {
    const runExecuteFlow = vi.fn();
    const app = createDemoControlApp({
      loadAgentEnv: async () => MOCK_ENV as never,
      runExecuteFlow,
    });

    const response = await invokeRoute(app, "post", "/demo/run-legit", {
      ownerAddress: "not-an-address",
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "ownerAddress must be a valid address",
    });
    expect(runExecuteFlow).not.toHaveBeenCalled();
  });
});

async function invokeRoute(
  app: Application,
  method: "get" | "post",
  path: string,
  bodyInput?: Record<string, unknown>
): Promise<{
  readonly statusCode: number;
  readonly body: unknown;
}> {
  const handler = getRouteHandler(app, method, path);
  let statusCode = 200;
  let body: unknown = null;

  const res = {
    header: () => res,
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (payload: unknown) => {
      body = payload;
      return res;
    },
    sendStatus: (code: number) => {
      statusCode = code;
      return res;
    },
  };

  await Promise.resolve(
    handler(
      { body: bodyInput ?? {}, params: {}, query: {} },
      res,
      () => undefined
    )
  );

  return { statusCode, body };
}

function getRouteHandler(
  app: Application,
  method: "get" | "post",
  path: string
): (...args: unknown[]) => unknown {
  const stack = ((app as any)._router?.stack as any[] | undefined) ?? [];

  for (const layer of stack) {
    if (layer.route?.path === path && layer.route?.methods?.[method]) {
      const routeLayer = layer.route.stack[layer.route.stack.length - 1];
      return routeLayer.handle;
    }
  }

  throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
}
