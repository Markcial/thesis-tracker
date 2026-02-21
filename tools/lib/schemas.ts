/**
 * Zod schemas for external API validation
 * Catches API changes at runtime with clear error messages
 */
import { z } from "zod";

// ============================================
// Fear & Greed Index API (alternative.me)
// ============================================

export const FearGreedDataPoint = z.object({
  value: z.string(),
  value_classification: z.string(),
  timestamp: z.string(),
  time_until_update: z.string().optional(),
});

export const FearGreedResponse = z.object({
  name: z.string(),
  data: z.array(FearGreedDataPoint),
  metadata: z.object({
    error: z.null().optional(),
  }).optional(),
});

export type FearGreedDataPointType = z.infer<typeof FearGreedDataPoint>;
export type FearGreedResponseType = z.infer<typeof FearGreedResponse>;

// ============================================
// CoinGecko Simple Price API
// ============================================

export const CoinGeckoPriceResponse = z.object({
  bitcoin: z.object({
    usd: z.number(),
  }),
});

export type CoinGeckoPriceResponseType = z.infer<typeof CoinGeckoPriceResponse>;

// ============================================
// Helper: Safe fetch with Zod validation
// ============================================

export async function fetchAndValidate<T>(
  url: string,
  schema: z.ZodType<T>,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();

  try {
    return schema.parse(json);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map(i => `  ${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(`API response validation failed:\n${issues}\n\nRaw response: ${JSON.stringify(json, null, 2).slice(0, 500)}`);
    }
    throw err;
  }
}
