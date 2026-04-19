import type { IncidentSummary, ScreeningProvider, SummaryContext } from "./types.js";

/**
 * Summarizer — wraps a ScreeningProvider to generate
 * incident summaries with error handling and advisory enforcement.
 */
export interface Summarizer {
  summarize(context: SummaryContext): Promise<IncidentSummary>;
}

export function createSummarizer(provider: ScreeningProvider): Summarizer {
  return {
    async summarize(context: SummaryContext): Promise<IncidentSummary> {
      try {
        const result = await provider.summarize(context);

        // Enforce advisory invariant
        return {
          ...result,
          advisory: true,
        };
      } catch {
        // Degrade gracefully — summary is advisory, never critical
        return {
          bullets: ["Summary unavailable due to a provider error."],
          summary: "Summary generation failed. This is an advisory feature only.",
          advisory: true,
          generatedAt: new Date().toISOString(),
        };
      }
    },
  };
}
