import { CHUNK_SIZE } from "@tartan/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// La file d'envoi des vidéos (T10) : un faux serveur Mux répond comme le protocole d'envoi reprenable (308 pour
// continuer avec l'en-tête Range, 201 à la fin, 410 pour une adresse périmée). La file est le vrai code du navigateur ;
// seuls le réseau et le stockage local sont remplacés.

const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/features/offline/idb", () => ({
  idbAll: async () => [...store.values()],
  idbPut: async (_name: string, item: { id: string }) => void store.set(item.id, item),
  idbDelete: async (_name: string, id: string) => void store.delete(id),
}));

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;
const ORG = "11111111-1111-4111-8111-111111111111";
const ATHLETE = "22222222-2222-4222-8222-222222222222";

// Le faux serveur : il garde ce que Mux a reçu, et peut couper le réseau au morceau voulu.
const mux = () => {
  const state = { received: 0, renewed: 0, created: 0, cutAt: -1, puts: 0, expired: false };
  const handler: Handler = (url, init) => {
    if (url === `/api/v1/orgs/${ORG}/videos`) {
      state.created += 1;
      return Response.json({ videoId: "video-1", uploadUrl: "https://mux.invalid/u1" });
    }
    if (url === `/api/v1/orgs/${ORG}/videos/video-1/upload`) {
      state.renewed += 1;
      state.received = 0;
      state.expired = false;
      return Response.json({ videoId: "video-1", uploadUrl: "https://mux.invalid/u2" });
    }
    const range = new Headers(init.headers).get("Content-Range") ?? "";
    // Interrogation de reprise : « bytes */total ».
    if (range.startsWith("bytes */")) {
      if (state.expired) return new Response(null, { status: 410 });
      return new Response(null, {
        status: 308,
        headers: state.received ? { Range: `bytes=0-${state.received - 1}` } : {},
      });
    }
    state.puts += 1;
    if (state.puts === state.cutAt) throw new TypeError("network down");
    const match = range.match(/bytes (\d+)-(\d+)\/(\d+)/)!;
    const [end, total] = [Number(match[2]), Number(match[3])];
    state.received = end + 1;
    return state.received >= total
      ? new Response(null, { status: 201 })
      : new Response(null, { status: 308, headers: { Range: `bytes=0-${end}` } });
  };
  return { state, handler };
};

const load = async (handler: Handler) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => handler(url, init)),
  );
  const queue = await import("@/features/videos/upload-queue");
  queue.setUploadOwner("coach-1");
  return queue;
};

const file = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: "video/mp4" });
const input = { athleteId: ATHLETE } as never;
const video = (bytes: number) => ({ file: file(bytes), fps: null, timeScale: 1 });
const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  store.clear();
  vi.resetModules();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("navigator", { onLine: true });
});
afterEach(() => vi.unstubAllGlobals());

describe("file d'envoi des vidéos", () => {
  it("envoie une vidéo en morceaux de 4 Mio, puis la retire de la file", async () => {
    const server = mux();
    const queue = await load(server.handler);
    await queue.enqueueVideo(ORG, input, video(CHUNK_SIZE * 2 + 1_000));
    await settled();
    expect(await queue.processUploads()).toEqual({ finished: 0, refused: [] });
    expect(server.state).toMatchObject({ created: 1, puts: 3, received: CHUNK_SIZE * 2 + 1_000 });
    expect(store.size).toBe(0);
  });

  it("reprend après une coupure là où Mux s'est arrêté, sans renvoyer ce qu'il a reçu", async () => {
    const server = mux();
    server.state.cutAt = 2;
    const queue = await load(server.handler);
    await queue.enqueueVideo(ORG, input, video(CHUNK_SIZE * 3));
    await settled();
    // Le second morceau est coupé : la vidéo reste en attente, avec ce que Mux a déjà reçu.
    const [waiting] = [...store.values()] as { offset: number }[];
    expect(waiting?.offset).toBe(CHUNK_SIZE);
    // Au retour du réseau : une interrogation, puis seulement les deux morceaux manquants.
    server.state.cutAt = -1;
    const putsBefore = server.state.puts;
    expect(await queue.processUploads()).toEqual({ finished: 1, refused: [] });
    expect(server.state.puts - putsBefore).toBe(2);
    expect(server.state.created).toBe(1);
    expect(store.size).toBe(0);
  });

  it("redemande une adresse quand celle de Mux a expiré, et repart de zéro", async () => {
    const server = mux();
    server.state.cutAt = 2;
    const queue = await load(server.handler);
    await queue.enqueueVideo(ORG, input, video(CHUNK_SIZE * 2));
    await settled();
    server.state.cutAt = -1;
    server.state.expired = true;
    expect(await queue.processUploads()).toEqual({ finished: 1, refused: [] });
    expect(server.state).toMatchObject({ renewed: 1, created: 1, received: CHUNK_SIZE * 2 });
  });

  it("abandonne une vidéo refusée par le serveur, et garde celle que le réseau a interrompue", async () => {
    const refused = await load((url) =>
      url.endsWith("/videos")
        ? Response.json({ message: "Plafond de vidéos atteint." }, { status: 403 })
        : new Response(null, { status: 201 }),
    );
    await refused.enqueueVideo(ORG, input, video(1_000));
    await settled();
    expect(store.size).toBe(0);

    vi.resetModules();
    const offline = await load(() => {
      throw new TypeError("network down");
    });
    vi.stubGlobal("navigator", { onLine: false });
    await offline.enqueueVideo(ORG, input, video(1_000));
    await settled();
    expect(store.size).toBe(1);
  });
});

it("rejoue la même clé après une réponse de création perdue", async () => {
  const keys: string[] = [];
  const queue = await load((url, init) => {
    if (url.endsWith("/videos")) {
      keys.push(JSON.parse(String(init.body)).clientId);
      if (keys.length === 1) throw new TypeError("response lost");
      return Response.json({ videoId: "same-video", uploadUrl: "https://mux.invalid/same" });
    }
    return new Response(null, { status: 201 });
  });
  await queue.enqueueVideo(ORG, input, video(100));
  await settled();
  expect(store.size).toBe(1);
  expect(await queue.processUploads()).toEqual({ finished: 1, refused: [] });
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(new Set(keys).size).toBe(1);
});

it("un envoi déjà reçu est terminé sans nouvel asset ni refus", async () => {
  const queue = await load(() => Response.json({ code: "video_already_uploaded" }, { status: 409 }));
  vi.stubGlobal("navigator", { onLine: false });
  await queue.enqueueVideo(ORG, input, video(100));
  await settled();
  vi.stubGlobal("navigator", { onLine: true });
  expect(await queue.processUploads()).toEqual({ finished: 1, refused: [] });
  expect(store.size).toBe(0);
});

it("un changement de compte pendant la création arrête l'envoi du fichier", async () => {
  let resolve!: (response: Response) => void;
  const pending = new Promise<Response>((done) => {
    resolve = done;
  });
  let puts = 0;
  const queue = await load((url) => {
    if (url.endsWith("/videos")) return pending;
    puts += 1;
    return new Response(null, { status: 201 });
  });
  await queue.enqueueVideo(ORG, input, video(100));
  await settled();
  queue.setUploadOwner("another-user");
  resolve(Response.json({ videoId: "first-user-video", uploadUrl: "https://mux.invalid/first" }));
  await settled();
  expect(puts).toBe(0);
  expect(store.size).toBe(1);
});
