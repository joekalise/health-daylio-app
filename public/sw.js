const SHELL_CACHE = "shell-v1";
const STATIC_CACHE = "static-v1";

// Cache the app shell on install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache =>
      cache.addAll(["/dashboard", "/manifest.json", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"])
    ).then(() => self.skipWaiting())
  );
});

// Clean up old caches on activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== STATIC_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Immutable Next.js bundles — cache first forever
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(res => {
            cache.put(request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // API calls — network only (auth-sensitive, never stale)
  if (url.pathname.startsWith("/api/")) return;

  // Navigation and public assets — network first, fall back to cache
  event.respondWith(
    fetch(request)
      .then(res => {
        const clone = res.clone();
        caches.open(SHELL_CACHE).then(c => c.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request))
  );
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Life Dashboard", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
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
