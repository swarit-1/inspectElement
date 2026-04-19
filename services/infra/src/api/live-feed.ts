import { Router } from "express";
import { z } from "zod";
import { badRequest } from "./errors.js";

/**
 * GET /v1/feed/live?owner=0x...
 *
 * Server-Sent Events endpoint that streams new receipts, blocked attempts,
 * challenges, and screening results to connected clients in real time.
 */

/**
 * Simple event bus for feed events.
 * In production, this could be backed by Supabase Realtime, Redis pub/sub, etc.
 */
export interface FeedEventBus {
  subscribe(owner: string, callback: (event: unknown) => void): () => void;
  emit(owner: string, event: unknown): void;
}

/**
 * Create an in-memory feed event bus.
 */
export function createFeedEventBus(): FeedEventBus {
  const listeners = new Map<string, Set<(event: unknown) => void>>();

  return {
    subscribe(owner: string, callback: (event: unknown) => void) {
      const key = owner.toLowerCase();
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(callback);

      return () => {
        listeners.get(key)?.delete(callback);
        if (listeners.get(key)?.size === 0) {
          listeners.delete(key);
        }
      };
    },

    emit(owner: string, event: unknown) {
      const key = owner.toLowerCase();
      listeners.get(key)?.forEach((cb) => {
        try {
          cb(event);
        } catch {
          // Swallow errors from individual listeners
        }
      });
    },
  };
}

const LiveFeedQuery = z.object({
  owner: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

export function createLiveFeedRouter(bus: FeedEventBus): Router {
  const router = Router();

  router.get("/live", (req, res) => {
    const parsed = LiveFeedQuery.safeParse(req.query);
    if (!parsed.success) {
      const err = badRequest("owner query parameter required", parsed.error.flatten());
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }

    const owner = parsed.data.owner;

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    res.flushHeaders();

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ owner, timestamp: Date.now() })}\n\n`);

    // Subscribe to events for this owner
    const unsubscribe = bus.subscribe(owner, (event) => {
      const evt = event as { type?: string; data?: unknown };
      const rawType = evt.type ?? "message";

      // Sanitize event type — SSE uses newlines as delimiters,
      // so a newline in the type field could split into a malformed frame
      if (/[\r\n]/.test(rawType)) return;
      const eventType = rawType;
      const eventData = evt.data ?? event;

      res.write(`event: ${eventType}\ndata: ${JSON.stringify(eventData)}\n\n`);
    });

    // Keepalive ping every 30 seconds
    const keepalive = setInterval(() => {
      res.write(`: keepalive ${Date.now()}\n\n`);
    }, 30_000);

    // Cleanup on client disconnect
    req.on("close", () => {
      clearInterval(keepalive);
      unsubscribe();
    });
  });

  return router;
}
