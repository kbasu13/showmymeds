import { buildPushHTTPRequest } from "@pushforge/builder";

export type PushSub = { id: string; endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; image?: string | undefined; tag?: string; url?: string };

/** Sends one notification to a device. Returns false when the device subscription is gone. */
export async function sendPush(sub: PushSub, payload: PushPayload): Promise<boolean> {
  const privateJWK = process.env["VAPID_PRIVATE_JWK"];
  if (!privateJWK) throw new Error("Notifications are not configured");
  const { endpoint, headers, body } = await buildPushHTTPRequest({
    privateJWK,
    subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    message: { payload: JSON.parse(JSON.stringify({ icon: "/icon-192.png", ...payload })), adminContact: "mailto:support@showmymeds.app", options: { ttl: 3600, urgency: "high" } },
  });
  const res = await fetch(endpoint, { method: "POST", headers, body });
  return !(res.status === 404 || res.status === 410);
}

/** Turns a stored medicine photo into a URL the phone can download. */
export async function medicineImageUrl(imageUrl: string | null, db: { storage: { from: (b: string) => { createSignedUrl: (p: string, s: number) => Promise<{ data: { signedUrl: string } | null }> } } }) {
  if (!imageUrl) return undefined;
  if (imageUrl.startsWith("http")) return imageUrl;
  const { data } = await db.storage.from("prescriptions").createSignedUrl(imageUrl, 86400);
  return data?.signedUrl;
}

export function doseBody(time: string, dosage: string | null, notes?: string | null) {
  const [h, m] = time.split(":").map(Number);
  const label = `${((h! + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h! < 12 ? "AM" : "PM"}`;
  return [`Dose due at ${label}`, dosage, notes].filter(Boolean).join(" · ");
}
