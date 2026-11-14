"use client";

import type { CreateVideoInput } from "@tartan/contracts";
import {
  classifyResponse,
  contentRange,
  MAX_FILE_SECONDS,
  nextChunk,
  offsetFromRangeHeader,
  planStretch,
  progressPct,
  statusProbeRange,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { idbAll, idbDelete, idbPut } from "@/features/offline/idb";

// Une vidéo attend ici jusqu'à la fin de son envoi : fermer l'onglet ou perdre le réseau ne la perd pas.
export type QueuedUpload = {
  id: string;
  ownerId: string;
  organizationId: string;
  input: CreateVideoInput;
  file: Blob;
  videoId: string | null;
  uploadUrl: string | null;
  offset: number;
  createdAt: number;
};

export const UPLOAD_EVENT = "tartan:upload";
export const UPLOAD_SETTLED_EVENT = "tartan:upload-settled";
export type UploadProgress = { waiting: number; pct: number | null };

let owner: string | null = null;
let running = false;
// Si le stockage refuse le fichier (quota, navigation privée), l'envoi continue, tant que la page reste ouverte.
const memory = new Map<string, QueuedUpload>();
let progress: UploadProgress = { waiting: 0, pct: null };

export const setUploadOwner = (userId: string) => {
  owner = userId;
};

export const uploadProgress = () => progress;

const publish = (next: UploadProgress) => {
  progress = next;
  window.dispatchEvent(new Event(UPLOAD_EVENT));
};

const stored = async (): Promise<QueuedUpload[]> => {
  const saved = await idbAll<QueuedUpload>("uploads").catch(() => []);
  return [...saved, ...memory.values()]
    .filter((item) => item.ownerId === owner)
    .sort((a, b) => a.createdAt - b.createdAt);
};

const save = async (item: QueuedUpload) => {
  if (memory.has(item.id)) {
    memory.set(item.id, item);
    return;
  }
  await idbPut("uploads", item).catch(() => {
    memory.set(item.id, item);
  });
};

const remove = async (id: string) => {
  memory.delete(id);
  await idbDelete("uploads", id).catch(() => undefined);
};

export type PreparedVideo = { file: Blob; fps: number | null; timeScale: number };

// Garde chaque image d'un ralenti : voir video-stretch. Un fichier qu'on ne sait pas lire part tel quel.
export const prepareVideo = async (file: File): Promise<PreparedVideo | { tooLongSeconds: number }> => {
  const plan = await planStretch(
    async (offset, length) => new Uint8Array(await file.slice(offset, offset + length).arrayBuffer()),
    file.size,
  );
  if (!plan) return { file, fps: null, timeScale: 1 };
  if (plan.durationSeconds * plan.timeScale > MAX_FILE_SECONDS) {
    return { tooLongSeconds: Math.floor(MAX_FILE_SECONDS / plan.timeScale) };
  }
  if (!plan.patch) return { file, fps: plan.fps, timeScale: 1 };
  const { offset, bytes } = plan.patch;
  const parts = [file.slice(0, offset), bytes as BlobPart, file.slice(offset + bytes.byteLength)];
  return { file: new Blob(parts, { type: file.type }), fps: plan.fps, timeScale: plan.timeScale };
};

export const enqueueVideo = async (organizationId: string, input: CreateVideoInput, video: PreparedVideo) => {
  const clientId = crypto.randomUUID();
  await save({
    id: clientId,
    ownerId: owner ?? "",
    organizationId,
    input: { ...input, clientId, fps: video.fps, timeScale: video.timeScale },
    file: video.file,
    videoId: null,
    uploadUrl: null,
    offset: 0,
    createdAt: Date.now(),
  });
  // L'écran n'attend pas la fin de l'envoi : le refus ou la réussite remonte par un événement.
  void processUploads().then((detail) => window.dispatchEvent(new CustomEvent(UPLOAD_SETTLED_EVENT, { detail })));
};

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

class Permanent extends Error {}
class AlreadyUploaded extends Error {}

// Adresse d'envoi : créée à la première connexion, renouvelée si elle a expiré.
const ensureAddress = async (item: QueuedUpload, renew: boolean): Promise<QueuedUpload> => {
  if (owner !== item.ownerId) throw new Error("upload_account_changed");
  if (item.videoId && item.uploadUrl && !renew) return item;
  const path = item.videoId
    ? `/api/v1/orgs/${item.organizationId}/videos/${item.videoId}/upload`
    : `/api/v1/orgs/${item.organizationId}/videos`;
  const res = await fetch(
    path,
    item.videoId ? { method: "POST" } : json({ ...item.input, clientId: item.input.clientId ?? item.id }),
  );
  // Session expirée ou serveur occupé : on réessaiera. Un refus (offre, accord retiré) est définitif.
  if (res.status === 401 || res.status >= 500) throw new Error("upload_address_unavailable");
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string; code?: string } | null;
    if (body?.code === "video_already_uploaded") throw new AlreadyUploaded();
    throw new Permanent(body?.message ?? m.video.failed);
  }
  const { videoId, uploadUrl } = (await res.json()) as { videoId: string; uploadUrl: string };
  if (owner !== item.ownerId) throw new Error("upload_account_changed");
  const next = { ...item, videoId, uploadUrl, offset: 0 };
  await save(next);
  return next;
};

const probeOffset = async (url: string, total: number): Promise<number | "complete" | "expired"> => {
  const res = await fetch(url, { method: "PUT", headers: { "Content-Range": statusProbeRange(total) } });
  const outcome = classifyResponse(res.status);
  if (outcome === "complete") return "complete";
  if (outcome === "expired") return "expired";
  return outcome === "continue" ? offsetFromRangeHeader(res.headers.get("Range")) : 0;
};

const sendFile = async (initial: QueuedUpload, onProgress: (pct: number) => void): Promise<void> => {
  let item = await ensureAddress(initial, false);
  let renewals = 0;
  const renewAddress = () => {
    if (++renewals > 3) throw new Error("upload_renewal_limit");
    return ensureAddress(item, true);
  };
  const total = item.file.size;
  // Reprise après une coupure ou une fermeture : on demande à Mux où il en est.
  let offset: number;
  const probe = item.offset > 0 ? await probeOffset(item.uploadUrl as string, total) : 0;
  if (probe === "complete") return;
  if (probe === "expired") {
    item = await renewAddress();
    offset = 0;
  } else {
    offset = probe;
  }
  for (;;) {
    if (owner !== item.ownerId) throw new Error("upload_account_changed");
    const range = nextChunk(offset, total);
    if (!range) return;
    onProgress(progressPct(offset, total));
    const res = await fetch(item.uploadUrl as string, {
      method: "PUT",
      headers: { "Content-Range": contentRange(range, total) },
      body: item.file.slice(range.start, range.end + 1),
    });
    const outcome = classifyResponse(res.status);
    if (outcome === "complete") return;
    if (outcome === "expired") {
      item = await renewAddress();
      offset = 0;
      continue;
    }
    if (outcome === "retry") throw new Error("upload_retry");
    if (outcome === "failed") throw new Permanent(m.video.failed);
    const header = res.headers.get("Range");
    offset = header ? offsetFromRangeHeader(header) : range.end + 1;
    item = { ...item, offset };
    await save(item);
  }
};

export type UploadOutcome = { finished: number; refused: string[] };

export const processUploads = async (): Promise<UploadOutcome> => {
  const outcome: UploadOutcome = { finished: 0, refused: [] };
  if (running) return outcome;
  running = true;
  try {
    for (;;) {
      const items = await stored();
      const [item] = items;
      if (!item) {
        publish({ waiting: 0, pct: null });
        return outcome;
      }
      publish({ waiting: items.length, pct: null });
      if (!navigator.onLine) return outcome;
      try {
        await sendFile(item, (pct) => publish({ waiting: items.length, pct }));
        outcome.finished += 1;
      } catch (error) {
        if (error instanceof AlreadyUploaded) {
          outcome.finished += 1;
          await remove(item.id);
          continue;
        }
        if (!(error instanceof Permanent)) {
          // Réseau coupé ou page suspendue : la vidéo reste en attente, on reprendra.
          publish({ waiting: items.length, pct: null });
          return outcome;
        }
        outcome.refused.push(error.message);
      }
      await remove(item.id);
    }
  } finally {
    running = false;
  }
};
