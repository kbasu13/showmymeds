import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY = "BLucv6IXIS2O0r4VeG0wTfATxyiSQIU6R2mLLHUKTB4VmbPxrMw86_5BI3MbunzI5jqiNoHqxVaGEjqNn86v4jY";

export type Platform = "ios" | "android" | "desktop";
export type PushStatus = "unsupported" | "needs-install" | "blocked" | "off" | "on";

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export async function isBrave(): Promise<boolean> {
  const b = (navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }).brave;
  try { return !!(b?.isBrave && (await b.isBrave())); } catch { return false; }
}

export function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function keyBytes(base64: string) {
  const s = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function registration() {
  return navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
}

export async function currentSubscription() {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function pushStatus(): Promise<PushStatus> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return detectPlatform() === "ios" && !isInstalled() ? "needs-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  return (await currentSubscription()) ? "on" : "off";
}

export async function enablePush(userId: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(permission === "denied" ? "blocked" : "dismissed");
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: userId, endpoint: sub.endpoint, p256dh: json.keys!["p256dh"]!, auth: json.keys!["auth"]!,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata", user_agent: navigator.userAgent.slice(0, 300),
  }, { onConflict: "endpoint" });
  if (error) throw error;
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
