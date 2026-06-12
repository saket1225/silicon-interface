// Silicon Interface service worker — Web Push delivery.
// Banners are suppressed when a tab is focused (the in-app UI already shows
// the message); `tag` dedupes against the in-tab Notification fallback.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Silicon Interface", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    (async () => {
      const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (tabs.some((tab) => tab.focused)) return;
      await self.registration.showNotification(data.title || "Silicon Interface", {
        body: data.body || "",
        tag: data.tag || undefined,
        icon: "/logo.png",
        badge: "/logo.png",
        data: { url: data.url || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const tab of tabs) {
        if ("focus" in tab) {
          await tab.focus();
          if ("navigate" in tab) await tab.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
