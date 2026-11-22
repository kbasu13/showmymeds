/** Monthly Ask allowance per Premium user (replies). */
export const ASK_MONTHLY_LIMIT = 100;
/** Warn once usage reaches this share of the allowance. */
export const ASK_WARN_SHARE = 0.8;

/** Credit prices for openai/gpt-6-astra (per token, under 272k context). */
const PRICE = { input: 0.00004, cached: 0.000004, output: 0.0002 };

export function askCredits(u: { inputTokens?: number; cachedInputTokens?: number; outputTokens?: number }) {
  const cached = u.cachedInputTokens ?? 0;
  const fresh = Math.max(0, (u.inputTokens ?? 0) - cached);
  return fresh * PRICE.input + cached * PRICE.cached + (u.outputTokens ?? 0) * PRICE.output;
}

export function askAllowanceState(used: number) {
  if (used >= ASK_MONTHLY_LIMIT) return "blocked" as const;
  if (used >= ASK_MONTHLY_LIMIT * ASK_WARN_SHARE) return "warn" as const;
  return "ok" as const;
}

export function monthStartIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
