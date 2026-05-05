self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Life Dashboard", {
      body: data.body ?? "",
      tag: data.tag ?? "default",
      renotify: true,
      data: { url: data.url ?? "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      const target = event.notification.data?.url ?? "/dashboard";
      for (const client of list) {
        if (client.url.includes("/dashboard") && "focus" in client) {
          client.focus();
          return;
        }
      }
      clients.openWindow(target);
    })
  );
});
