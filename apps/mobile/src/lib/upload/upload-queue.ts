import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError } from "@tartan/api-client";
import type { CreateVideoInput } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import * as Crypto from "expo-crypto";
import { fetch as expoFetch } from "expo/fetch";
import { Directory, File, Paths } from "expo-file-system";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { api } from "../api";
import { errorMessage } from "../errors";
import { queryClient } from "../query-client";
import {
  classifyResponse,
  contentRange,
  nextChunk,
  offsetFromRangeHeader,
  retryDelayMs,
  statusProbeRange,
} from "./chunks";

export type UploadItem = {
  id: string;
  orgId: string;
  athleteName: string;
  fileUri: string;
  size: number;
  input: CreateVideoInput;
  videoId: string | null;
  uploadUrl: string | null;
  offset: number;
  attempts: number;
  state: "queued" | "uploading" | "failed";
  error: string | null;
  queuedAt: string;
};

type UploadState = {
  items: UploadItem[];
  running: boolean;
  add: (params: { orgId: string; athleteName: string; sourceUri: string; input: CreateVideoInput }) => Promise<void>;
  remove: (id: string) => void;
  retry: (id: string) => void;
  patch: (id: string, patch: Partial<UploadItem>) => void;
  setRunning: (running: boolean) => void;
};

const uploadsDir = () => {
  const dir = new Directory(Paths.document, "uploads");
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};

const deleteLocal = (uri: string) => {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Un fichier déjà supprimé n'empêche rien.
  }
};

export const useUploads = create<UploadState>()(
  persist(
    (set, get) => ({
      items: [],
      running: false,
      add: async ({ orgId, athleteName, sourceUri, input }) => {
        const id = Crypto.randomUUID();
        // Copie durable : le fichier temporaire du sélecteur peut disparaître avant l'envoi.
        const source = new File(sourceUri);
        const target = new File(uploadsDir(), `${id}.mp4`);
        source.copy(target);
        const item: UploadItem = {
          id,
          orgId,
          athleteName,
          fileUri: target.uri,
          size: target.size,
          input,
          videoId: null,
          uploadUrl: null,
          offset: 0,
          attempts: 0,
          state: "queued",
          error: null,
          queuedAt: new Date().toISOString(),
        };
        set({ items: [...get().items, item] });
        void flushUploads();
      },
      remove: (id) => {
        const item = get().items.find((i) => i.id === id);
        if (item) deleteLocal(item.fileUri);
        set({ items: get().items.filter((i) => i.id !== id) });
      },
      retry: (id) => {
        get().patch(id, { state: "queued", error: null, attempts: 0 });
        void flushUploads();
      },
      patch: (id, patch) => set({ items: get().items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }),
      setRunning: (running) => set({ running }),
    }),
    {
      name: "tartan.uploads",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        // Au redémarrage, un envoi coupé repart de l'état « en file ».
        items: s.items.map((i) => (i.state === "uploading" ? { ...i, state: "queued" as const } : i)),
      }),
    },
  ),
);

class Retry extends Error {}

const probeOffset = async (item: UploadItem): Promise<number | "complete"> => {
  const res = await expoFetch(item.uploadUrl as string, {
    method: "PUT",
    headers: { "Content-Range": statusProbeRange(item.size), "Content-Length": "0" },
    redirect: "manual",
  });
  const outcome = classifyResponse(res.status);
  if (outcome === "complete") return "complete";
  if (outcome === "continue") return offsetFromRangeHeader(res.headers.get("Range"));
  if (outcome === "retry") throw new Retry();
  throw new Error(m.mobile.video.uploadFailed);
};

const readChunk = (uri: string, start: number, length: number): Uint8Array<ArrayBuffer> => {
  const handle = new File(uri).open();
  try {
    handle.offset = start;
    return handle.readBytes(length);
  } finally {
    handle.close();
  }
};

const uploadOne = async (id: string): Promise<void> => {
  const { patch } = useUploads.getState();
  const current = () => useUploads.getState().items.find((i) => i.id === id);
  let item = current();
  if (!item) return;
  patch(id, { state: "uploading", error: null });

  if (!item.uploadUrl) {
    const created = await api.createVideo(item.orgId, item.input);
    patch(id, { videoId: created.videoId, uploadUrl: created.uploadUrl });
    item = current();
    if (!item) return;
  } else {
    // Reprise : Mux dit ce qu'il a déjà reçu, y compris si la réponse s'était perdue.
    const reached = await probeOffset(item);
    if (reached === "complete") return;
    patch(id, { offset: reached });
    item = current();
    if (!item) return;
  }

  while (item) {
    const range = nextChunk(item.offset, item.size);
    if (!range) return;
    const body = readChunk(item.fileUri, range.start, range.length);
    // eslint-disable-next-line no-await-in-loop -- un morceau à la fois, dans l'ordre
    const res = await expoFetch(item.uploadUrl as string, {
      method: "PUT",
      headers: { "Content-Range": contentRange(range, item.size), "Content-Type": "video/mp4" },
      body,
      redirect: "manual",
    });
    const outcome = classifyResponse(res.status);
    if (outcome === "complete") return;
    if (outcome === "retry") throw new Retry();
    if (outcome === "failed") throw new Error(m.mobile.video.uploadFailed);
    patch(id, { offset: offsetFromRangeHeader(res.headers.get("Range")) || range.end + 1, attempts: 0 });
    item = current();
  }
};

let retryTimer: ReturnType<typeof setTimeout> | null = null;

export const flushUploads = async (): Promise<void> => {
  const store = useUploads.getState();
  if (store.running) return;
  store.setRunning(true);
  try {
    for (;;) {
      const next = useUploads.getState().items.find((i) => i.state === "queued");
      if (!next) return;
      try {
        // eslint-disable-next-line no-await-in-loop -- une vidéo à la fois pour ménager le réseau
        await uploadOne(next.id);
        const done = useUploads.getState().items.find((i) => i.id === next.id);
        if (done) deleteLocal(done.fileUri);
        useUploads.setState((s) => ({ items: s.items.filter((i) => i.id !== next.id) }));
        void queryClient.invalidateQueries({ queryKey: ["videos"] });
      } catch (error) {
        const definitive =
          error instanceof ApiError && error.status < 500 && error.status !== 401 && error.status !== 429;
        const disabled = error instanceof ApiError && error.code === "video_disabled";
        const stopped =
          definitive || disabled || (error instanceof Error && error.message === m.mobile.video.uploadFailed);
        if (stopped) {
          useUploads.getState().patch(next.id, { state: "failed", error: errorMessage(error) });
          continue;
        }
        // Réseau coupé : on garde la vidéo et on réessaiera, sans bloquer l'interface.
        const attempts = next.attempts + 1;
        useUploads.getState().patch(next.id, { state: "queued", attempts });
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => void flushUploads(), retryDelayMs(attempts));
        return;
      }
    }
  } finally {
    useUploads.getState().setRunning(false);
  }
};
