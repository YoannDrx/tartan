import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError } from "@tartan/api-client";
import type { CreateVideoInput } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import * as Crypto from "expo-crypto";
import { fetch as expoFetch } from "expo/fetch";
import { Directory, File, Paths } from "expo-file-system";
import * as LegacyFS from "expo-file-system/legacy";
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
  planUpload,
  progressPct,
  retryDelayMs,
  settleProbe,
  statusProbeRange,
} from "./chunks";
import { clearUploadProgress, showUploadProgress, startUploadService, stopUploadService } from "./progress-notification";
import { stretchInPlace, type StretchOutcome } from "./stretch";

export type UploadItem = {
  id: string;
  orgId: string;
  athleteName: string;
  fileUri: string;
  size: number;
  input: CreateVideoInput;
  videoId: string | null;
  uploadUrl: string | null;
  // Un envoi a déjà été lancé : au prochain essai, on demande d'abord à Mux où il en est.
  started: boolean;
  offset: number;
  attempts: number;
  state: "queued" | "uploading" | "failed";
  error: string | null;
  queuedAt: string;
};

type UploadState = {
  items: UploadItem[];
  running: boolean;
  // Null si la vidéo est en file ; sinon la durée maximale à cette fréquence, en secondes.
  add: (params: {
    orgId: string;
    athleteName: string;
    sourceUri: string;
    input: CreateVideoInput;
  }) => Promise<{ tooLongSeconds: number } | null>;
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

// L'en-tête est réécrit sur la copie : le fichier d'origine (pellicule, capture) reste tel quel.
const stretchCopy = async (uri: string): Promise<StretchOutcome> => {
  const file = new File(uri);
  const handle = file.open();
  try {
    return await stretchInPlace({
      size: handle.size ?? file.size,
      read: async (offset, length) => {
        handle.offset = offset;
        return handle.readBytes(length);
      },
      write: (offset, bytes) => {
        handle.offset = offset;
        handle.writeBytes(bytes);
      },
    });
  } finally {
    handle.close();
  }
};

export const useUploads = create<UploadState>()(
  persist(
    (set, get) => ({
      items: [],
      running: false,
      add: async ({ orgId, athleteName, sourceUri, input }) => {
        const id = Crypto.randomUUID();
        // Copie durable, hors du cache que le système peut vider : le fichier temporaire du sélecteur
        // peut disparaître avant l'envoi. Copie asynchrone : une longue vidéo ne fige pas l'écran.
        const target = new File(uploadsDir(), `${id}.mp4`);
        await LegacyFS.copyAsync({ from: sourceUri, to: target.uri });
        let stretch: StretchOutcome;
        try {
          stretch = await stretchCopy(target.uri);
        } catch (error) {
          deleteLocal(target.uri);
          throw error;
        }
        if (stretch.kind === "too-long") {
          deleteLocal(target.uri);
          return { tooLongSeconds: stretch.maxSeconds };
        }
        const item: UploadItem = {
          id,
          orgId,
          athleteName,
          fileUri: target.uri,
          size: target.size,
          // Dans la file persistante : une reprise après fermeture crée la vidéo avec le bon `timeScale`.
          input: { ...input, fps: stretch.fps ?? input.fps ?? null, timeScale: stretch.timeScale },
          videoId: null,
          uploadUrl: null,
          started: false,
          offset: 0,
          attempts: 0,
          state: "queued",
          error: null,
          queuedAt: new Date().toISOString(),
        };
        set({ items: [...get().items, item] });
        void flushUploads();
        return null;
      },
      remove: (id) => {
        const item = get().items.find((i) => i.id === id);
        void runningTasks
          .get(id)
          ?.cancelAsync()
          .catch(() => undefined);
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
class Expired extends Error {}

const checkOutcome = (status: number): "complete" | "continue" => {
  const outcome = classifyResponse(status);
  if (outcome === "retry") throw new Retry();
  if (outcome === "expired") throw new Expired();
  if (outcome === "failed") throw new Error(m.mobile.video.uploadFailed);
  return outcome;
};

const probeOffset = async (item: UploadItem): Promise<number | "complete"> => {
  const res = await expoFetch(item.uploadUrl as string, {
    method: "PUT",
    headers: { "Content-Range": statusProbeRange(item.size), "Content-Length": "0" },
    redirect: "manual",
  });
  if (checkOutcome(res.status) === "complete") return "complete";
  return offsetFromRangeHeader(res.headers.get("Range"));
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

const uploadChunks = async (id: string): Promise<void> => {
  const { patch } = useUploads.getState();
  let item = useUploads.getState().items.find((i) => i.id === id);
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
    if (checkOutcome(res.status) === "complete") return;
    patch(id, { offset: offsetFromRangeHeader(res.headers.get("Range")) || range.end + 1, attempts: 0 });
    showUploadProgress(item.athleteName, progressPct(item.offset, item.size));
    item = useUploads.getState().items.find((i) => i.id === id);
  }
};

const PROBE_SPACING_MS = 5000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const runningTasks = new Map<string, LegacyFS.UploadTask>();

// Le PUT unique continue quand l'app passe en arrière-plan (session d'arrière-plan sur iOS).
const uploadSinglePut = async (id: string): Promise<void> => {
  const { patch } = useUploads.getState();
  const item = useUploads.getState().items.find((i) => i.id === id);
  if (!item?.uploadUrl) return;
  patch(id, { started: true });
  let lastPct = -1;
  const task = LegacyFS.createUploadTask(
    item.uploadUrl,
    item.fileUri,
    {
      httpMethod: "PUT",
      uploadType: LegacyFS.FileSystemUploadType.BINARY_CONTENT,
      sessionType: LegacyFS.FileSystemSessionType.BACKGROUND,
      headers: { "Content-Type": "video/mp4" },
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      const pct = progressPct(totalBytesSent, totalBytesExpectedToSend || item.size);
      if (pct === lastPct) return;
      lastPct = pct;
      patch(id, { offset: Math.min(totalBytesSent, item.size) });
      showUploadProgress(item.athleteName, pct);
    },
  );
  runningTasks.set(id, task);
  try {
    const result = await task.uploadAsync();
    if (!result) throw new Retry();
    checkOutcome(result.status);
  } finally {
    runningTasks.delete(id);
  }
};

const renew = async (id: string): Promise<void> => {
  const { patch } = useUploads.getState();
  const item = useUploads.getState().items.find((i) => i.id === id);
  if (!item?.videoId) return;
  const renewed = await api.renewVideoUpload(item.orgId, item.videoId);
  patch(id, { videoId: renewed.videoId, uploadUrl: renewed.uploadUrl, offset: 0, started: false });
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
  }

  for (let renewals = 0; renewals < 2; renewals += 1) {
    try {
      item = current();
      if (!item) return;
      // Déjà commencé : l'app a pu dormir ou être tuée, Mux seul sait ce qu'il a reçu.
      // eslint-disable-next-line no-await-in-loop -- sondage puis envoi, dans l'ordre
      const probing = item;
      const probe = item.started
        ? await settleProbe(
            () => probeOffset(probing),
            () => sleep(PROBE_SPACING_MS),
          )
        : null;
      const step = planUpload(probe);
      if (step.kind === "done") return;
      if (step.kind === "single-put") {
        // eslint-disable-next-line no-await-in-loop -- un seul envoi à la fois
        await uploadSinglePut(id);
        return;
      }
      patch(id, { offset: step.from });
      // eslint-disable-next-line no-await-in-loop -- un seul envoi à la fois
      await uploadChunks(id);
      return;
    } catch (error) {
      if (!(error instanceof Expired)) throw error;
      // eslint-disable-next-line no-await-in-loop -- nouvelle adresse puis nouvel essai
      await renew(id);
    }
  }
  throw new Error(m.mobile.video.uploadFailed);
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
      // Android : le service au premier plan garde l'envoi en vie quand l'écran s'éteint.
      startUploadService(next.athleteName);
      try {
        // eslint-disable-next-line no-await-in-loop -- une vidéo à la fois pour ménager le réseau
        await uploadOne(next.id);
        const done = useUploads.getState().items.find((i) => i.id === next.id);
        if (done) deleteLocal(done.fileUri);
        clearUploadProgress();
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
          clearUploadProgress();
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
    stopUploadService();
    useUploads.getState().setRunning(false);
  }
};
