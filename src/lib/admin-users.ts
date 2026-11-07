import { z } from "zod";

export const contactSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  email: z.union([z.literal(""), z.string().trim().email()]),
  phone: z.union([z.literal(""), z.string().regex(/^\+[1-9]\d{6,14}$/, "Use a country code, for example +919876543210")]),
});
export const accessSchema = z.object({ userId: z.string().uuid(), suspended: z.boolean() });
export const premiumSchema = z.object({ userId: z.string().uuid(), expires: z.string().datetime().nullable(), revoke: z.boolean() });

export function assertAdmin(allowed: boolean | null | undefined) {
  if (allowed !== true) throw new Error("Only the app owner can manage accounts.");
}
export function assertCanSuspend(actor: string, target: string, suspended: boolean, targetAdmin: boolean) {
  if (suspended && (actor === target || targetAdmin)) throw new Error("An app owner account cannot be suspended.");
}
export function matchesUser(user: { name: string; email: string; phone: string }, search: string) {
  const value = search.trim().toLowerCase();
  return [user.name, user.email, user.phone].some((field) => field.toLowerCase().includes(value));
}