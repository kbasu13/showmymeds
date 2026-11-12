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

export const GST_PERCENT = 18;
export const UPI_ID = "kaustabh.basu-3@oksbi";
export const UPI_NAME = "Effemon Consultancy";

/** Price including 18% GST, to the paisa. */
export function withGst(price: number) {
  return Math.round(price * (100 + GST_PERCENT)) / 100;
}

export function upiLink(amount: number, note: string) {
  return `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;
}

/** Seller details printed on invoices. GSTIN is added once registered. */
export const SELLER = {
  name: "Effemon Consultancy (ShowMyMeds)",
  gstin: "" as string,
  address: "" as string,
  state: "" as string,
};

export const AUTO_TERMS =
  "By submitting this payment you accept the ShowMyMeds Terms of Use (EULA), Privacy Policy, Refund Policy and Data Rights (DPDP/GDPR) policy. Premium starts after the payment is verified.";

export function planLabel(id: string) {
  return PREMIUM_PLANS.find((p) => p.id === id)?.label ?? id;
}

/** UTR / UPI reference: 8–30 letters or digits, spaces ignored. */
export function cleanUtr(v: string) {
  return v.replace(/\s/g, "").toUpperCase();
}
export function validUtr(v: string) {
  return /^[A-Z0-9]{8,30}$/.test(cleanUtr(v));
}
export function validGstin(v: string) {
  const g = v.trim().toUpperCase();
  return g === "" || /^[0-9]{2}[A-Z0-9]{13}$/.test(g);
}
