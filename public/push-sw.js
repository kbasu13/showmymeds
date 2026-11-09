// ShowMyMeds notification worker: shows dose reminders sent from the server.
// It does not cache pages; it only handles push messages and notification taps.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || "ShowMyMeds";
  const options = {
    body: data.body || "Time for your medicine",
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    image: data.image || undefined,
    tag: data.tag || "showmymeds-dose",
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [300, 120, 300, 120, 600],
    data: { url: data.url || "/today" },
    actions: [
      { action: "open", title: "Mark as taken" },
      { action: "later", title: "Remind me later" },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "later") return;
  const url = new URL((event.notification.data && event.notification.data.url) || "/today", self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin) { await c.focus(); return c.navigate(url); }
    }
    return self.clients.openWindow(url);
  })());
});
