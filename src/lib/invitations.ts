import { z } from "zod";
export const sharingMethods = ["whatsapp", "sms", "email", "share", "copy"] as const;
export type SharingMethod = typeof sharingMethods[number];
export const inviteSchema = z.object({ recipient: z.string().trim().min(1, "Enter the person's name").max(120), method: z.enum(sharingMethods), message: z.string().trim().min(1).max(3000) });
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
