// Notifications navigateur (Web Push). Le contenu reste neutre : jamais de donnée de santé.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Tartan", {
      body: data.body || "",
      icon: "/icon-192.png",
      data: { link: data.link || "/accueil" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data.link));
});
