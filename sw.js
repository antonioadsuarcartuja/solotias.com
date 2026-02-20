/* SoloTIAS / Altfly - Service Worker (JSON nunca cacheado) */

const VERSION = "solotias-sw-v21";
const STATIC_CACHE = `solotias-static-${VERSION}`;
const RUNTIME_CACHE = `solotias-runtime-${VERSION}`;

// App shell (lo esencial de la PWA)
const APP_SHELL = [
  "/",
  "/index.html",
  "/sw.js",
  "/css/styles.css",
  "/manifest.webmanifest",
  "/img/icon-192.png",
  "/img/icon-512.png",
  "/img/apple-touch-icon.png",
  "/img/favicon-32.png",
  "/img/favicon-16.png"
];

// Para identificar el core que queremos network-first
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

function looksLikeJsonRequest(req, url) {
  // 1) Si el cliente pide JSON explícitamente
  const accept = req.headers.get("accept") || "";
  if (accept.includes("application/json")) return true;

  // 2) URLs que suelen ser JSON
  if (url.pathname.endsWith(".json")) return true;

  // 3) Heurísticas típicas de API
  // (ajusta/añade aquí tus rutas si quieres)
  if (url.pathname.startsWith("/api/")) return true;

  return false;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Solo controlamos mismo origen
  if (url.origin !== self.location.origin) return;
  // ❌ Nunca cachear app.js
if (url.pathname.endsWith("/js/app.js")) {
  return fetch(req, { cache: "no-store" });
}


  event.respondWith((async () => {
    // ✅ 1) Core: network-first (trae lo nuevo si hay red)
    if (NETWORK_FIRST.has(url.href)) {
      const cache = await caches.open(STATIC_CACHE);
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return (await cache.match(req)) || cache.match("/index.html");
      }
    }

    // ✅ 2) Si parece JSON por request -> SIEMPRE red, NUNCA caché
    if (looksLikeJsonRequest(req, url)) {
      return fetch(req, { cache: "no-store" });
    }

    // ✅ 3) Resto: runtime cache (cache-first), PERO sin cachear JSON por respuesta
    const cache = await caches.open(RUNTIME_CACHE);

    // Intentar caché para assets estáticos
    const cached = await cache.match(req);
    if (cached) return cached;

    // Si no hay, ir a red
    try {
      const fresh = await fetch(req);

      // Si la respuesta es JSON -> no cachear jamás
      const ct = (fresh.headers.get("content-type") || "").toLowerCase();
      const isJsonResponse = ct.includes("application/json");

      if (fresh && fresh.ok && !isJsonResponse) {
        cache.put(req, fresh.clone());
      }

      return fresh;
    } catch {
      // Offline navegación: devolver shell
      if (req.mode === "navigate") return caches.match("/index.html");
      throw new Error("offline");
    }
  })());
});
