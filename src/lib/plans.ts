export const PREMIUM_PLANS = [
  { id: "monthly", label: "Monthly", price: 99, note: "per month" },
  { id: "yearly", label: "Yearly", price: 990, note: "per year · 2 months free" },
  { id: "lifetime", label: "Lifetime", price: 4990, note: "one-time payment" },
] as const;

export const DISCOUNT_PERCENTS = [75, 50, 25, 10] as const;

/** Price after a percentage discount, rounded to the nearest rupee. */
export function discountedPrice(price: number, percent: number) {
  return Math.round(price * (100 - percent) / 100);
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function randomCode() {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return "SMM-" + Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("");
}

export function isPremiumActive(expiresAt: string | null | undefined, now = new Date()) {
  return !expiresAt || new Date(expiresAt) > now;
}
