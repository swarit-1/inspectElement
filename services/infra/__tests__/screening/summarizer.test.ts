import { describe, expect, it } from "vitest";
import { createSummarizer } from "../../src/screening/summarizer.js";
import type {
  IncidentSummary,
  ScreeningProvider,
  SummaryContext,
} from "../../src/screening/types.js";

/** Mock provider that produces predictable summaries. */
function createMockProvider(): ScreeningProvider {
  return {
    async screenTrace() {
      return {
        injectionScore: 0,
        signals: [],
        explanation: "",
        advisory: true as const,
        screenedAt: new Date().toISOString(),
      };
    },
    async summarize(context: SummaryContext): Promise<IncidentSummary> {
      const bullets: string[] = [];

      bullets.push(
        `Agent ${context.receipt.agentId.slice(0, 10)} executed a ${context.receipt.amount} wei payment to ${context.receipt.target.slice(0, 10)}.`
      );

      if (context.trace) {
        const trace = context.trace as Record<string, unknown>;
        const prompts = trace.prompts as Array<{ content: string }> | undefined;
        if (prompts && prompts.length > 0) {
          bullets.push(
            `The decision trace contains ${prompts.length} prompt(s) leading to this action.`
          );
        }
      } else {
        bullets.push("No decision trace was available for this incident.");
      }

      if (context.challenge) {
        bullets.push(
          `Challenge ${context.challenge.challengeId} was filed with status: ${context.challenge.status}.`
        );
      }

      return {
        bullets,
        summary: bullets.join(" "),
        advisory: true,
        generatedAt: new Date().toISOString(),
      };
    },
  };
}

function makeReceiptContext(): SummaryContext {
  return {
    trace: {
      schemaVersion: "1.0.0",
      agentId: "0x" + "11".repeat(32),
      owner: "0x" + "22".repeat(20),
      intentHash: "0x" + "33".repeat(32),
      prompts: [
        { role: "user", content: "Pay merchant 2 USDC", timestamp: 1700000001 },
      ],
      toolCalls: [],
      observations: [],
      proposedAction: {
        target: "0x" + "44".repeat(20),
        token: "0x" + "55".repeat(20),
        amount: "2000000",
        callData: "0x",
        rationale: "Legit payment.",
      },
      nonce: 0,
    },
    receipt: {
      receiptId: "0x" + "aa".repeat(32),
      owner: "0x" + "22".repeat(20),
      agentId: "0x" + "11".repeat(32),
      target: "0x" + "44".repeat(20),
      token: "0x" + "55".repeat(20),
      amount: "2000000",
      timestamp: 1700000100,
    },
  };
}

describe("createSummarizer", () => {
  const provider = createMockProvider();
  const summarizer = createSummarizer(provider);

  it("generates summary from trace + receipt data", async () => {
    const context = makeReceiptContext();
    const result = await summarizer.summarize(context);

    expect(result.summary).toBeDefined();
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("summary contains 2-3 bullet points", async () => {
    const context = makeReceiptContext();
    const result = await summarizer.summarize(context);

    expect(result.bullets.length).toBeGreaterThanOrEqual(2);
    expect(result.bullets.length).toBeLessThanOrEqual(3);
  });

  it("handles missing trace gracefully", async () => {
    const context: SummaryContext = {
      ...makeReceiptContext(),
      trace: null,
    };
    const result = await summarizer.summarize(context);

    expect(result.summary).toBeDefined();
    expect(result.advisory).toBe(true);
    expect(result.bullets.some((b) => /no.*trace/i.test(b))).toBe(true);
  });

  it("summary is always marked advisory", async () => {
    const context = makeReceiptContext();
    const result = await summarizer.summarize(context);

    expect(result.advisory).toBe(true);
  });

  it("includes generatedAt timestamp", async () => {
    const context = makeReceiptContext();
    const result = await summarizer.summarize(context);

    expect(result.generatedAt).toBeDefined();
    expect(() => new Date(result.generatedAt)).not.toThrow();
  });

  it("includes challenge context in summary when present", async () => {
    const context: SummaryContext = {
      ...makeReceiptContext(),
      challenge: {
        challengeId: "1",
        status: "UPHELD",
        payout: "15000000",
        filedAt: 1700000200,
        resolvedAt: 1700000300,
      },
    };
    const result = await summarizer.summarize(context);

    expect(result.bullets.length).toBeGreaterThanOrEqual(2);
    expect(result.bullets.some((b) => /challenge/i.test(b))).toBe(true);
  });

  it("handles receipt-only case (no challenge)", async () => {
    const context = makeReceiptContext();
    const result = await summarizer.summarize(context);

    // Should still produce a valid summary without challenge info
    expect(result.bullets.length).toBeGreaterThanOrEqual(2);
    expect(result.advisory).toBe(true);
  });
});
