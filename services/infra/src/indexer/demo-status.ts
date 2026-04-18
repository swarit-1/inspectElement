import { logger } from "../utils/logger.js";
import { blockedAttemptExists, insertBlockedAttempt } from "../store/blocked.js";
import type { Address, Hex } from "viem";

/**
 * Optional poller for Dev 2's `GET /demo/status`.
 *
 * If `DEMO_STATUS_URL` is set, we poll it every `DEMO_STATUS_POLL_MS` and,
 * whenever the latest scenario is a "blocked" outcome, we materialize a
 * `blocked` row in the feed. This is the server-side merge default agreed in
 * Dev 3 spec §3.4. If the env var is unset, the poller is a no-op (Dev 4 can
 * still merge client-side as the documented fallback).
 */
export interface DemoStatusEnvelope {
  last?: {
    scenarioId?: string;
    outcome?: "success" | "blocked" | "failed";
    txHash?: string;
    receiptId?: string;
    reasonCode?: string;
    reasonLabel?: string;
    owner?: string;
    agentId?: string;
    target?: string;
    token?: string;
    amount?: string;
    error?: string;
  };
}

export class DemoStatusPoller {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly url: string,
    private readonly intervalMs: number = 3000,
  ) {}

  static fromEnv(): DemoStatusPoller | null {
    const url = process.env.DEMO_STATUS_URL;
    if (!url) return null;
    const intervalMs = Number(process.env.DEMO_STATUS_POLL_MS ?? 3000);
    return new DemoStatusPoller(url, intervalMs);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info({ url: this.url, intervalMs: this.intervalMs }, "Demo-status poller started");
    void this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        await this.tick();
      } catch (e) {
        logger.warn({ err: (e as Error).message }, "Demo-status poll failed");
      }
      await new Promise<void>((r) => {
        this.timer = setTimeout(r, this.intervalMs);
      });
    }
  }

  private async tick(): Promise<void> {
    const res = await fetch(this.url, { method: "GET" });
    if (!res.ok) return;
    const json = (await res.json()) as DemoStatusEnvelope;
    const last = json.last;
    if (!last || last.outcome !== "blocked" || !last.reasonCode) return;
    const scenarioId = last.scenarioId ?? `${last.reasonCode}:${Date.now()}`;
    if (blockedAttemptExists(scenarioId)) return;
    insertBlockedAttempt({
      scenarioId,
      reasonCode: last.reasonCode,
      reasonLabel: last.reasonLabel ?? null,
      owner: (last.owner ?? null) as Address | null,
      agentId: (last.agentId ?? null) as Hex | null,
      target: (last.target ?? null) as Address | null,
      token: (last.token ?? null) as Address | null,
      amount: last.amount ? BigInt(last.amount) : null,
      source: "demo-status",
    });
    logger.info({ scenarioId, reasonCode: last.reasonCode }, "Recorded blocked attempt");
  }
}
