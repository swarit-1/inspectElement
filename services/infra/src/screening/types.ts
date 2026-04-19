/**
 * Gemini advisory screening & incident summary types.
 *
 * IMPORTANT: All outputs from this module are ADVISORY ONLY.
 * They never affect deterministic challenge outcomes (AmountViolation)
 * and never block or approve live payments.
 */

/**
 * A single signal detected during trace screening.
 */
export interface ScreeningSignal {
  /** Signal category (e.g. "prompt_injection", "goal_hijacking", "data_exfiltration") */
  readonly category: string;
  /** Severity: low, medium, high, critical */
  readonly severity: "low" | "medium" | "high" | "critical";
  /** Human-readable description of the signal */
  readonly description: string;
  /** The source content that triggered this signal (prompt text, tool call, etc.) */
  readonly evidence: string;
}

/**
 * Result of screening a DecisionTrace for manipulation signals.
 */
export interface ScreeningResult {
  /** 0-100 injection likelihood score */
  readonly injectionScore: number;
  /** Detected signals, ordered by severity */
  readonly signals: readonly ScreeningSignal[];
  /** Human-readable explanation of the screening outcome */
  readonly explanation: string;
  /** Always true — screening is advisory, never authoritative */
  readonly advisory: true;
  /** ISO timestamp when screening was performed */
  readonly screenedAt: string;
}

/**
 * Incident summary generated from trace + receipt + optional challenge context.
 */
export interface IncidentSummary {
  /** 2-3 bullet point summary of the incident */
  readonly bullets: readonly string[];
  /** Full narrative summary */
  readonly summary: string;
  /** Always true — summaries are advisory, never authoritative */
  readonly advisory: true;
  /** ISO timestamp when summary was generated */
  readonly generatedAt: string;
}

/**
 * Input context for incident summary generation.
 */
export interface SummaryContext {
  /** The stored decision trace JSON (parsed) */
  readonly trace: Record<string, unknown> | null;
  /** Receipt data */
  readonly receipt: {
    readonly receiptId: string;
    readonly owner: string;
    readonly agentId: string;
    readonly target: string;
    readonly token: string;
    readonly amount: string;
    readonly timestamp: number;
  };
  /** Challenge data if a challenge has been filed */
  readonly challenge?: {
    readonly challengeId: string;
    readonly status: string;
    readonly payout: string | null;
    readonly filedAt: number;
    readonly resolvedAt: number | null;
  };
}

/**
 * Provider interface for LLM-based screening.
 * Allows swapping Gemini for mocks in tests.
 */
export interface ScreeningProvider {
  /**
   * Analyze a decision trace for prompt-injection or manipulation signals.
   */
  screenTrace(traceJson: string): Promise<ScreeningResult>;

  /**
   * Generate an incident summary from stored evidence.
   */
  summarize(context: SummaryContext): Promise<IncidentSummary>;
}
