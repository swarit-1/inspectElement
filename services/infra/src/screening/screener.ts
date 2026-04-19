import type { ScreeningProvider, ScreeningResult } from "./types.js";

/**
 * Screener — wraps a ScreeningProvider to add error handling
 * and guarantee the advisory contract.
 */
export interface Screener {
  screen(traceJson: string): Promise<ScreeningResult>;
}

export function createScreener(provider: ScreeningProvider): Screener {
  return {
    async screen(traceJson: string): Promise<ScreeningResult> {
      // Validate that the input is parseable JSON before sending to provider
      try {
        JSON.parse(traceJson);
      } catch {
        return {
          injectionScore: 0,
          signals: [],
          explanation: "Unable to parse trace JSON. Input is invalid.",
          advisory: true,
          screenedAt: new Date().toISOString(),
        };
      }

      try {
        const result = await provider.screenTrace(traceJson);

        // Enforce advisory invariant and clamp score to 0-100
        return {
          ...result,
          injectionScore: Math.min(100, Math.max(0, result.injectionScore)),
          advisory: true,
        };
      } catch {
        // Degrade gracefully — screening is advisory, never critical
        return {
          injectionScore: 0,
          signals: [],
          explanation: "Screening provider error. Unable to analyze trace.",
          advisory: true,
          screenedAt: new Date().toISOString(),
        };
      }
    },
  };
}
