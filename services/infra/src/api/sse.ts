import { Router } from "express";
import type { Request, Response } from "express";
import { logger } from "../utils/logger.js";

/**
 * SSE (Server-Sent Events) for live updates.
 *
 * GET /v1/events?owner=0x… — subscribe to events for an owner address.
 *
 * Events:
 *   - receipt.created
 *   - attempt.blocked
 *   - challenge.filed
 *   - challenge.resolved
 *   - summary.ready
 */

export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

type SSEClient = {
  id: string;
  owner: string | null;
  res: Response;
};

const clients: SSEClient[] = [];

let clientIdCounter = 0;

/**
 * Emit an event to all connected SSE clients.
 * If the event data contains an `owner` field, only clients
 * subscribed to that owner (or with no owner filter) receive it.
 */
export function emitEvent(event: SSEEvent): void {
  const eventOwner = (event.data.owner as string | undefined)?.toLowerCase();

  for (const client of clients) {
    const match =
      !client.owner || !eventOwner || client.owner === eventOwner;
    if (!match) continue;

    try {
      client.res.write(`event: ${event.type}\n`);
      client.res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    } catch {
      // Client disconnected — will be cleaned up on close
    }
  }
}

export function createSSERouter(): Router {
  const router = Router();

  router.get("/", (req: Request, res: Response) => {
    const owner = typeof req.query.owner === "string"
      ? req.query.owner.toLowerCase()
      : null;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Send initial connection event
    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ message: "SSE connected", owner })}\n\n`);

    const clientId = `sse-${++clientIdCounter}`;
    const client: SSEClient = { id: clientId, owner, res };
    clients.push(client);

    logger.info({ clientId, owner }, "SSE client connected");

    // Heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        res.write(`:heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 30_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      const idx = clients.indexOf(client);
      if (idx >= 0) clients.splice(idx, 1);
      logger.info({ clientId, owner }, "SSE client disconnected");
    });
  });

  return router;
}
