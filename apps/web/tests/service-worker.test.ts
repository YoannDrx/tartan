import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

// T21 : le vrai `public/sw.js`, chargé dans un faux contexte de worker. Seuls le navigateur (notifications, fenêtres,
// caches) et le réseau sont remplacés ; on déclenche les événements comme le ferait le navigateur.

const SOURCE = readFileSync(path.join(__dirname, "..", "public", "sw.js"), "utf8");
const ORIGIN = "https://app.tartan.test";

type Listener = (event: Record<string, unknown>) => void;
type Window = { focus: () => Promise<void>; navigate: (url: string) => Promise<unknown> };

const worker = (options: { windows?: Window[]; fetch?: (url: string, init?: RequestInit) => Promise<Response> } = {}) => {
  const listeners = new Map<string, Listener>();
  const stores = new Map<string, Map<string, Response>>();
  const store = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  };
  const keyOf = (request: string | Request) =>
    typeof request === "string" ? request : new URL(request.url).pathname;
  const cache = (name: string) => ({
    match: async (request: string | Request) => store(name).get(keyOf(request))?.clone(),
    put: async (request: string | Request, response: Response) => void store(name).set(keyOf(request), response),
  });
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const self = {
    location: { href: `${ORIGIN}/sw.js?v=essai`, origin: ORIGIN },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    registration: {
      showNotification: async (title: string, opts: Record<string, unknown>) => void shown.push({ title, options: opts }),
    },
    clients: {
      matchAll: async () => options.windows ?? [],
      openWindow: vi.fn(async (url: string) => url),
      claim: async () => undefined,
    },
    skipWaiting: vi.fn(),
  };
  const network = vi.fn(options.fetch ?? (async () => new Response("réseau")));
  const caches = {
    open: async (name: string) => cache(name),
    match: async (request: string | Request) => {
      for (const name of stores.keys()) {
        const hit = await cache(name).match(request);
        if (hit) return hit;
      }
      return undefined;
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  const context = { self, caches, fetch: network, Response, URL, setTimeout, Promise, JSON, Set };
  vm.runInNewContext(SOURCE, context);
  // Les constantes du worker, lues dans son propre contexte.
  const read = <T>(expression: string) => vm.runInContext(expression, context) as T;

  // Déclenche un événement et attend tout ce que le worker a confié à waitUntil ou respondWith.
  const dispatch = async (type: string, event: Record<string, unknown>) => {
    const pending: Promise<unknown>[] = [];
    let responded: Promise<Response> | undefined;
    listeners.get(type)!({
      ...event,
      waitUntil: (promise: Promise<unknown>) => void pending.push(promise),
      respondWith: (promise: Promise<Response>) => void (responded = promise),
    });
    await Promise.all(pending);
    return responded;
  };
  return { dispatch, shown, self, network, store, read };
};

// Les adresses servies par l'application : chaque `page.tsx` ou `route.ts` de `app/`, groupes entre parenthèses retirés.
const APP_DIR = path.join(__dirname, "..", "app");
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const routes = (dir = APP_DIR, prefix = ""): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isFile()) return /^(page|route)\.tsx?$/.test(entry.name) ? [prefix || "/"] : [];
    const segment = /^\(.+\)$/.test(entry.name) ? "" : `/${entry.name}`;
    return routes(path.join(dir, entry.name), `${prefix}${segment}`);
  });
const publicFiles = (dir = PUBLIC_DIR, prefix = ""): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? publicFiles(path.join(dir, entry.name), `${prefix}/${entry.name}`)
      : [`${prefix}/${entry.name}`],
  );

const pushEvent = (data?: unknown) => ({ data: data === undefined ? null : { json: () => data } });
const notification = (data: Record<string, unknown>) => ({ close: vi.fn(), data });
const request = (pathname: string, init: { mode?: string; method?: string; origin?: string } = {}) => ({
  url: `${init.origin ?? ORIGIN}${pathname}`,
  mode: init.mode ?? "navigate",
  method: init.method ?? "GET",
});

describe("ce que le worker garde existe (audit G5)", () => {
  const sw = worker();
  const appRoutes = routes();
  const files = publicFiles();

  it("chaque page rouvrable hors ligne est une vraie page, vidéos de l'athlète comprises", () => {
    const source = sw.read<RegExp>("OFFLINE_PATHS").source;
    const entries = source
      .replace(/^\^\\\/\(/, "")
      .replace(/\)$/, "")
      .split("|")
      .map((entry) => `/${entry.replace(/\\\//g, "/")}`);
    expect(entries.length).toBeGreaterThan(5);
    for (const entry of entries) {
      const exists = entry.endsWith("/")
        ? appRoutes.some((route) => route.startsWith(entry))
        : appRoutes.includes(entry);
      expect(exists, `${entry} n'est pas une page de app/`).toBe(true);
    }
    const offline = sw.read<RegExp>("OFFLINE_PATHS");
    expect(offline.test("/mes-videos")).toBe(true);
    expect(offline.test("/mes-videos/0b6f2a0e-5c55-4f43-9c0e-6f7d4a8f2c11")).toBe(true);
    expect(appRoutes).toContain(sw.read<string>("OFFLINE_PAGE"));
  });

  it("chaque fichier statique gardé existe dans public/ ou vient du build", async () => {
    for (const prefix of ["/icon-", "/apple-touch", "/brand/"])
      expect(files.some((file) => file.startsWith(prefix))).toBe(true);
    expect(files).toContain("/icon-192.png");
    // Un nom cité par une page qui ne correspond à aucun fichier n'est jamais demandé au réseau.
    const isStatic = sw.read<(url: URL) => boolean>("isStatic");
    expect(isStatic(new URL(`${ORIGIN}/exercise-guides/back-squat-v1.svg`))).toBe(false);
    for (const file of files.filter((file) => isStatic(new URL(`${ORIGIN}${file}`))))
      expect(existsSync(path.join(PUBLIC_DIR, file))).toBe(true);
  });

  it("une page qui cite un guide d'exercice ne déclenche aucune requête vers un fichier absent", async () => {
    const photo = "/exercise-photos/snap-down-v1.webp";
    const thumb = "/exercise-photos/snap-down-v1-thumb.webp";
    const page = `<link href="/_next/static/css/app.css"><img src="${photo}"><img src="${thumb}"><img src="/exercise-guides/back-squat-v1.svg">`;
    const net = worker({
      fetch: async (url) =>
        Object.defineProperty(new Response(url === "/aujourdhui" ? page : "body{}"), "url", {
          value: `${ORIGIN}${url}`,
        }),
    });
    await net.dispatch("message", { data: { type: "cache-pages", urls: ["/aujourdhui"] } });
    const asked = net.network.mock.calls.map(([url]) => String(url));
    expect(asked).toEqual(expect.arrayContaining(["/_next/static/css/app.css", photo, thumb]));
    for (const asset of [photo, thumb]) expect(net.store("tartan-static-essai").has(asset)).toBe(true);
    expect(asked.some((url) => url.includes("exercise-guides"))).toBe(false);
  });
});

describe("worker du site (T21)", () => {
  it("affiche la notification reçue telle quelle, avec le lien et les réponses prévues", async () => {
    const sw = worker();
    await sw.dispatch(
      "push",
      pushEvent({
        title: "Séance demain",
        body: "Vitesse et appuis, 18 h 30",
        link: "/seance/abc?espace=org",
        actions: [{ action: "yes", title: "Je viens" }],
        api: { yes: { path: "/api/v1/attendance", body: { going: true } } },
      }),
    );
    expect(sw.shown).toEqual([
      {
        title: "Séance demain",
        options: {
          body: "Vitesse et appuis, 18 h 30",
          icon: "/icon-192.png",
          actions: [{ action: "yes", title: "Je viens" }],
          data: { link: "/seance/abc?espace=org", api: { yes: { path: "/api/v1/attendance", body: { going: true } } } },
        },
      },
    ]);
  });

  it("une notification sans contenu reste neutre et mène à l'accueil", async () => {
    const sw = worker();
    await sw.dispatch("push", pushEvent());
    expect(sw.shown[0]).toEqual({
      title: "Tartan",
      options: { body: "", icon: "/icon-192.png", actions: [], data: { link: "/accueil", api: null } },
    });
  });

  it("au clic, réutilise une fenêtre ouverte, sinon en ouvre une", async () => {
    const open: Window = { focus: vi.fn(async () => undefined), navigate: vi.fn(async (url: string) => url) };
    const withWindow = worker({ windows: [open] });
    const shown = notification({ link: "/suivi", api: null });
    await withWindow.dispatch("notificationclick", { notification: shown, action: "" });
    expect(shown.close).toHaveBeenCalled();
    expect(open.focus).toHaveBeenCalled();
    expect(open.navigate).toHaveBeenCalledWith("/suivi");
    expect(withWindow.self.clients.openWindow).not.toHaveBeenCalled();

    const without = worker();
    await without.dispatch("notificationclick", { notification: notification({ link: "/suivi", api: null }), action: "" });
    expect(without.self.clients.openWindow).toHaveBeenCalledWith("/suivi");
  });

  it("une réponse depuis la notification part au serveur sans ouvrir l'app ; en échec, la page s'ouvre", async () => {
    const api = { yes: { path: "/api/v1/attendance", body: { going: true } } };
    const ok = worker({ fetch: async () => new Response(null, { status: 200 }) });
    await ok.dispatch("notificationclick", { notification: notification({ link: "/seance/abc", api }), action: "yes" });
    expect(ok.network).toHaveBeenCalledWith("/api/v1/attendance", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ going: true }),
    });
    expect(ok.self.clients.openWindow).not.toHaveBeenCalled();

    const refused = worker({ fetch: async () => new Response(null, { status: 403 }) });
    await refused.dispatch("notificationclick", { notification: notification({ link: "/seance/abc", api }), action: "yes" });
    expect(refused.self.clients.openWindow).toHaveBeenCalledWith("/seance/abc");
  });

  it("laisse passer l'API, les envois et les autres sites ; sans réseau, sert la page gardée puis la page hors ligne", async () => {
    const sw = worker({
      fetch: async () => {
        throw new TypeError("hors ligne");
      },
    });
    expect(await sw.dispatch("fetch", { request: request("/api/v1/me") })).toBeUndefined();
    expect(await sw.dispatch("fetch", { request: request("/aujourdhui", { method: "POST" }) })).toBeUndefined();
    expect(await sw.dispatch("fetch", { request: request("/", { origin: "https://ailleurs.test" }) })).toBeUndefined();

    sw.store("tartan-pages-essai").set("/aujourdhui", new Response("séance gardée"));
    sw.store("tartan-static-essai").set("/hors-ligne", new Response("page hors ligne"));
    const saved = await sw.dispatch("fetch", { request: request("/aujourdhui") });
    expect(await saved!.text()).toBe("séance gardée");
    // Une page publique n'est jamais gardée : sans réseau, c'est la page hors ligne.
    const offline = await sw.dispatch("fetch", { request: request("/tarifs") });
    expect(await offline!.text()).toBe("page hors ligne");
  });
});
