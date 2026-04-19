import { z } from "zod";

// ── Screen request / response ──

export const ScreenRequestSchema = z.object({
  trace: z.unknown(),
  contextDigest: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  owner: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  agentId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  proposedAction: z.string().min(1),
  intentConfig: z
    .object({
      maxSpendPerTx: z.string().optional(),
      maxSpendPerDay: z.string().optional(),
      allowedCounterparties: z.array(z.string()).optional(),
      expiry: z.number().optional(),
    })
    .optional(),
});

export type ScreenRequest = z.infer<typeof ScreenRequestSchema>;

export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const RecommendedActionSchema = z.enum(["allow", "review", "block"]);

export const ScreenResponseSchema = z.object({
  injectionScore: z.number().min(0).max(1),
  severity: SeveritySchema,
  signals: z.array(z.string()),
  explanation: z.string(),
  recommendedAction: RecommendedActionSchema,
  model: z.string(),
  advisoryOnly: z.literal(true),
});

export type ScreenResponse = z.infer<typeof ScreenResponseSchema>;

// ── Summary response ──

export const SummaryResponseSchema = z.object({
  headline: z.string(),
  summaryBullets: z.array(z.string()),
  riskAssessment: z.string(),
  whyItWasAllowedOrBlocked: z.string(),
  recommendedReviewerFocus: z.array(z.string()),
  advisoryOnly: z.literal(true),
  model: z.string(),
});

export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

// ── Gemini raw output schemas (what we request from the model) ──

export const GeminiScreenOutputSchema = z.object({
  injectionScore: z.number().min(0).max(1),
  severity: SeveritySchema,
  signals: z.array(z.string()),
  explanation: z.string(),
  recommendedAction: RecommendedActionSchema,
});

export type GeminiScreenOutput = z.infer<typeof GeminiScreenOutputSchema>;

export const GeminiSummaryOutputSchema = z.object({
  headline: z.string(),
  summaryBullets: z.array(z.string()),
  riskAssessment: z.string(),
  whyItWasAllowedOrBlocked: z.string(),
  recommendedReviewerFocus: z.array(z.string()),
});

export type GeminiSummaryOutput = z.infer<typeof GeminiSummaryOutputSchema>;
