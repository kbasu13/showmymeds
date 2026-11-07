import { z } from "zod";
export const sharingMethods = ["whatsapp", "sms", "email", "share", "copy"] as const;
export type SharingMethod = typeof sharingMethods[number];
export const inviteSchema = z.object({ recipient: z.string().trim().min(1, "Enter the person's name").max(120, "Keep the name within 120 characters"), method: z.enum(sharingMethods), message: z.string().trim().min(1, "Enter an invitation message").max(3000, "Keep your message within 3,000 characters") });
export const referralSchema = inviteSchema.extend({ phone: z.string().regex(/^\+[1-9]\d{6,14}$/, "Enter your mobile number with its country code, such as +91 or +1") });
export type InvitationErrors = Partial<Record<"recipient" | "message" | "phone", string>>;
export function invitationFieldErrors(error: z.ZodError): InvitationErrors {
  const fields: InvitationErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if ((field === "recipient" || field === "message" || field === "phone") && !fields[field]) fields[field] = issue.message;
  }
  return fields;
}
export function invitationShareError(error: unknown, fallback: string) {
  if (error instanceof DOMException && error.name === "NotAllowedError") return "Sharing was blocked by your browser. Allow sharing or try Copy.";
  return fallback;
}
export function inviteExpired(created: string, now = Date.now()) { return now >= new Date(created).getTime() + 15 * 86400000; }
export function invitationText(message: string, link: string, code?: string) {
  let text = message.replaceAll("{link}", link).replaceAll("{code}", code ?? "");
  if (!text.includes(link)) text += `\n${link}`;
  if (code && !text.includes(code)) text += `\nReferral code: ${code}`;
  return text;
}
export async function openInvitation(method: SharingMethod, text: string) {
  const encoded = encodeURIComponent(text);
  if (method === "whatsapp") window.location.assign(`https://wa.me/?text=${encoded}`);
  else if (method === "sms") window.location.assign(`sms:?&body=${encoded}`);
  else if (method === "email") window.location.assign(`mailto:?subject=${encodeURIComponent("Join me on ShowMyMeds")}&body=${encoded}`);
  else if (method === "share" && navigator.share) await navigator.share({ title: "ShowMyMeds", text });
  else await navigator.clipboard.writeText(text);
}
