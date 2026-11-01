"use client";

// Le navigateur garde les pages utiles au stade : à l'ouverture, au plus toutes les 30 min, et si l'espace change.
const LAST_SYNC = "tartan.offline-sync";
const SYNC_EVERY_MS = 30 * 60 * 1000;

const worker = async (): Promise<ServiceWorker | null> => {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.register("/sw.js");
  const ready = await navigator.serviceWorker.ready;
  return ready.active ?? registration.active;
};

const readSync = (): { space: string; at: number } | null => {
  try {
    return JSON.parse(localStorage.getItem(LAST_SYNC) ?? "null") as { space: string; at: number } | null;
  } catch {
    return null;
  }
};

export const syncOfflinePages = async (organizationId: string): Promise<void> => {
  const active = await worker().catch(() => null);
  if (!active || !navigator.onLine) return;
  const last = readSync();
  if (last?.space === organizationId && Date.now() - last.at < SYNC_EVERY_MS) return;
  if (last && last.space !== organizationId) active.postMessage({ type: "clear-pages" });
  const res = await fetch(`/api/v1/orgs/${organizationId}/offline-urls`).catch(() => null);
  if (!res?.ok) return;
  const { urls } = (await res.json()) as { urls: string[] };
  active.postMessage({ type: "cache-pages", urls });
  try {
    localStorage.setItem(LAST_SYNC, JSON.stringify({ space: organizationId, at: Date.now() }));
  } catch {
    // Stockage indisponible : la synchronisation se refera à la prochaine ouverture.
  }
};

// À la déconnexion : plus aucune page personnelle sur cet appareil.
export const clearOfflinePages = async (): Promise<void> => {
  try {
    localStorage.removeItem(LAST_SYNC);
    const registration = await navigator.serviceWorker?.getRegistration();
    registration?.active?.postMessage({ type: "clear-pages" });
  } catch {
    // Rien à effacer.
  }
};
