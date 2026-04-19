import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import http from "http";
import { createLiveFeedRouter, type FeedEventBus } from "../../src/api/live-feed.js";

function createTestApp(bus: FeedEventBus) {
  const app = express();
  app.use(express.json());
  app.use("/v1/feed", createLiveFeedRouter(bus));
  return app;
}

function createEventBus(): FeedEventBus {
  const listeners = new Map<string, Set<(event: unknown) => void>>();

  return {
    subscribe(owner: string, cb: (event: unknown) => void) {
      const key = owner.toLowerCase();
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(cb);
      return () => {
        listeners.get(key)?.delete(cb);
      };
    },
    emit(owner: string, event: unknown) {
      const key = owner.toLowerCase();
      listeners.get(key)?.forEach((cb) => cb(event));
    },
  };
}

describe("GET /v1/feed/live", () => {
  let server: http.Server;
  let bus: FeedEventBus;

  beforeEach(() => {
    bus = createEventBus();
    const app = createTestApp(bus);
    server = app.listen(0);
  });

  afterEach(() => {
    server.close();
  });

  function getPort(): number {
    const addr = server.address();
    if (typeof addr === "object" && addr !== null) return addr.port;
    throw new Error("Server not listening");
  }

  it("returns text/event-stream content-type", async () => {
    const owner = "0x" + "22".repeat(20);
    const url = `http://localhost:${getPort()}/v1/feed/live?owner=${owner}`;

    const response = await fetch(url);
    expect(response.headers.get("content-type")).toMatch(/text\/event-stream/);
    response.body?.cancel();
  });

  it("returns 400 without owner param", async () => {
    const url = `http://localhost:${getPort()}/v1/feed/live`;
    const response = await fetch(url);
    expect(response.status).toBe(400);
  });

  it("emits new-receipt events to connected clients", async () => {
    const owner = "0x" + "22".repeat(20);
    const url = `http://localhost:${getPort()}/v1/feed/live?owner=${owner}`;

    const response = await fetch(url);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Emit an event after a brief delay
    const receiptEvent = {
      type: "new-receipt",
      data: { receiptId: "0x" + "aa".repeat(32), amount: "2000000" },
    };

    // Give SSE connection time to establish
    await new Promise((r) => setTimeout(r, 50));
    bus.emit(owner, receiptEvent);

    // Read from the stream
    const { value } = await reader.read();
    const text = decoder.decode(value);

    expect(text).toContain("event:");
    expect(text).toContain("data:");
    reader.cancel();
  });

  it("emits new-challenge events to connected clients", async () => {
    const owner = "0x" + "22".repeat(20);
    const url = `http://localhost:${getPort()}/v1/feed/live?owner=${owner}`;

    const response = await fetch(url);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const challengeEvent = {
      type: "new-challenge",
      data: { challengeId: "1", status: "UPHELD" },
    };

    await new Promise((r) => setTimeout(r, 50));
    bus.emit(owner, challengeEvent);

    const { value } = await reader.read();
    const text = decoder.decode(value);

    expect(text).toContain("event:");
    reader.cancel();
  });

  it("handles client disconnect cleanup", async () => {
    const owner = "0x" + "22".repeat(20);
    const url = `http://localhost:${getPort()}/v1/feed/live?owner=${owner}`;

    const controller = new AbortController();
    const response = await fetch(url, { signal: controller.signal });

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    // After disconnect, emitting should not throw
    await new Promise((r) => setTimeout(r, 50));
    expect(() => {
      bus.emit(owner, { type: "test", data: {} });
    }).not.toThrow();
  });
});
