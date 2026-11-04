// Wetin Dey service worker
//
// Two jobs:
//   1. Cache static assets (Next hashed bundles, icons) so repeat loads
//      are instant and offline works.
//   2. Receive push notifications and handle click-to-open.
//
// Caching strategy:
//   - /_next/static/* and app icons   → cache-first (immutable, hashed)
//   - HTML navigations                → network-first, fallback to /offline
//   - /api/*                          → network only, never cached
//   - cross-origin                    → untouched
//
// Bump CACHE_VERSION whenever the caching rules change. On activate we
// delete every cache that doesn't match the current version.

const CACHE_VERSION = "wetindey-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

const PRECACHE_URLS = [
  "/offline",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon.svg",
  "/favicon.ico",
  "/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Best-effort. Missing files should not block install.
      await cache.addAll(PRECACHE_URLS).catch(() => {});
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isNextStatic(pathname) {
  return pathname.startsWith("/_next/static/");
}

function isPrecached(pathname) {
  return PRECACHE_URLS.includes(pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only GET is cacheable.
  if (req.method !== "GET") return;

  // Skip local dev — HMR + localhost behavior differ.
  const host = self.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return;

  const url = new URL(req.url);

  // Same origin only. Supabase, Resend, Telegram all live elsewhere.
  if (url.origin !== self.location.origin) return;

  // Never cache API responses.
  if (url.pathname.startsWith("/api/")) return;

  // Static assets: cache-first.
  if (isNextStatic(url.pathname) || isPrecached(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res.ok) {
            const cache = await caches.open(ASSET_CACHE);
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        } catch (err) {
          const fallback = await caches.match(req);
          if (fallback) return fallback;
          throw err;
        }
      })()
    );
    return;
  }

  // HTML navigations: network-first, offline fallback.
  const isNavigation =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const offline = await caches.match("/offline");
          if (offline) return offline;
          return new Response(
            "<!doctype html><meta charset=utf-8><title>Offline</title>" +
              "<body style=\"font-family:sans-serif;padding:2rem;text-align:center\">" +
              "<h1>You dey offline</h1><p>Check your internet and try again.</p></body>",
            {
              status: 200,
              headers: { "content-type": "text/html; charset=utf-8" }
            }
          );
        }
      })()
    );
    return;
  }

  // Everything else: no cache, no interceptor.
});

// ─── Push handling ─────────────────────────────────────────────────
// Do not modify without reading app/api/push/subscribe and lib/push-server.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Wetin Dey", body: event.data.text() };
  }

  const title = payload.title || "Wetin Dey";
  const options = {
    body: payload.body || "New message",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "wetindey",
    data: { url: payload.url || "/" },
    renotify: true,
    requireInteraction: false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (
            client.url.includes(self.location.origin) &&
            "focus" in client
          ) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});