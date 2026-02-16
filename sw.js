/* SoloTIAS / Altfly - Service Worker limpio y estable (v14) */

const VERSION = "solotias-sw-v19";
const STATIC_CACHE = `solotias-static-${VERSION}`;
const RUNTIME_CACHE = `solotias-runtime-${VERSION}`;

// ✅ Rutas absolutas (clave para instalación PWA estable)
const APP_SHELL = [
  "/",
  "/index.html",
  "/sw.js",
  "/css/styles.css",
  "/js/app.js",
  "/manifest.webmanifest",
  "/img/icon-192.png",
  "/img/icon-512.png",
  "/img/apple-touch-icon.png",
  "/img/favicon-32.png",
  "/img/favicon-16.png"
];

// Para decidir qué va en "network-first"
const NETWORK_FIRST = new Set(APP_SHELL.map((p) => new URL(p, self.location.origin).href));

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => {
        if (
          (k.startsWith("solotias-") || k.startsWith("altfly-")) &&
          k !== STATIC_CACHE &&
          k !== RUNTIME_CACHE
        ) {
          return caches.delete(k);
        }
      })
    );
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ✅ Network-first para el "core" (si hay red, trae lo nuevo)
  if (NETWORK_FIRST.has(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return (await cache.match(req)) || cache.match("/index.html");
      }
    })());
    return;
  }

  // ✅ Runtime cache (cache-first)
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    } catch {
      // ✅ Offline navegación: devolvemos shell
      if (req.mode === "navigate") return caches.match("/index.html");
      throw new Error("offline");
    }
  })());
});
