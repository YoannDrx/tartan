// Tartan hors ligne (§ 10.4) et notifications. Le contenu des notifications reste neutre : jamais de donnée de santé.
const VERSION = "v1";
const STATIC_CACHE = `tartan-static-${VERSION}`;
const PAGES_CACHE = `tartan-pages-${VERSION}`;
const OFFLINE_PAGE = "/hors-ligne";
const NETWORK_TIMEOUT_MS = 4000;

// Pages rouvrables sans réseau. Les pages publiques et de connexion n'en font pas partie.
const OFFLINE_PATHS = /^\/(accueil|aujourdhui|calendrier|annonces|progres|mes-sauts|suivi|videos|seance\/|seances\/)/;

const isStatic = (url) => url.pathname.startsWith("/_next/static/") || /^\/(icon-|apple-touch|brand\/)/.test(url.pathname);

// Une réponse redirigée ne peut pas servir une navigation : on la recopie.
const storable = async (response) =>
  response.redirected
    ? new Response(await response.clone().blob(), { status: response.status, headers: response.headers })
    : response.clone();

const assetsIn = (text) => [...new Set(text.match(/\/_next\/static\/[^"'\\\s)]+/g) ?? [])];

const cacheAssets = async (text) => {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(
    assetsIn(text).map(async (asset) => {
      if (await cache.match(asset)) return;
      const res = await fetch(asset).catch(() => null);
      if (!res?.ok) return;
      await cache.put(asset, res.clone());
      // Les polices sont citées par les feuilles de style.
      if (asset.endsWith(".css")) await cacheAssets(await res.text());
    }),
  );
};

const cachePages = async (urls) => {
  const cache = await caches.open(PAGES_CACHE);
  for (const url of urls) {
    const res = await fetch(url, { credentials: "same-origin" }).catch(() => null);
    if (!res?.ok || new URL(res.url).pathname === "/connexion") continue;
    await cache.put(url, await storable(res));
    await cacheAssets(await res.clone().text());
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then(async (cache) => {
        const res = await fetch(OFFLINE_PAGE);
        if (res.ok) {
          await cache.put(OFFLINE_PAGE, res.clone());
          await cacheAssets(await res.text());
        }
      })
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, PAGES_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "cache-pages") event.waitUntil(cachePages(event.data.urls));
  if (event.data?.type === "clear-pages") event.waitUntil(caches.delete(PAGES_CACHE));
});

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

const navigate = async (request) => {
  const url = new URL(request.url);
  const cache = await caches.open(PAGES_CACHE);
  const key = url.pathname;
  const saved = OFFLINE_PATHS.test(url.pathname) ? await cache.match(key) : null;
  const network = fetch(request).then(async (res) => {
    if (res.ok && OFFLINE_PATHS.test(url.pathname) && new URL(res.url).pathname !== "/connexion") {
      await cache.put(key, await storable(res));
    }
    return res;
  });
  try {
    // Réseau de stade : passé le délai, on sert ce qu'on a et la réponse tardive met le cache à jour.
    return saved ? await withTimeout(network, NETWORK_TIMEOUT_MS) : await network;
  } catch {
    network.catch(() => undefined);
    return saved ?? (await caches.match(OFFLINE_PAGE)) ?? Response.error();
  }
};

const staticFirst = async (request) => {
  const saved = await caches.match(request);
  if (saved) return saved;
  const res = await fetch(request);
  if (res.ok) (await caches.open(STATIC_CACHE)).put(request, res.clone());
  return res;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") event.respondWith(navigate(request));
  else if (isStatic(url)) event.respondWith(staticFirst(request));
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Tartan", {
      body: data.body || "",
      icon: "/icon-192.png",
      actions: data.actions || [],
      data: { link: data.link || "/accueil", api: data.api || null },
    }),
  );
});

const openLink = async (link) => {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const open = windows.find((w) => "focus" in w);
  if (open) {
    await open.focus();
    if ("navigate" in open) return open.navigate(link).catch(() => self.clients.openWindow(link));
    return open;
  }
  return self.clients.openWindow(link);
};

// Android : répondre depuis la notification, sans ouvrir l'app. En cas d'échec, on ouvre la page.
const answer = async (notification, action) => {
  const api = notification.data.api?.[action];
  if (api) {
    const res = await fetch(api.path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(api.body),
    }).catch(() => null);
    if (res?.ok) return;
  }
  await openLink(notification.data.link);
};

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(event.action ? answer(event.notification, event.action) : openLink(event.notification.data.link));
});
