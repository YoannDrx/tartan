"use client";

import { registerServiceWorker } from "@/features/offline/service-worker";

export type PushOutcome = "on" | "denied" | "unavailable";

export const pushSupported = (): boolean =>
  typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;

// La clé publique en octets : Safari ne prend pas la forme texte.
const keyBytes = (key: string): Uint8Array<ArrayBuffer> => {
  const text = atob(
    key
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(key.length / 4) * 4, "="),
  );
  return Uint8Array.from(text, (c) => c.charCodeAt(0));
};

export const enablePush = async (vapidKey: string): Promise<PushOutcome> => {
  if (!pushSupported()) return "unavailable";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  await registerServiceWorker();
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(vapidKey),
  });
  const res = await fetch("/api/v1/devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pushToken: JSON.stringify(subscription), platform: "web" }),
  });
  return res.ok ? "on" : "unavailable";
};

export const currentPushSubscription = async (): Promise<PushSubscription | null> => {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
};

// Le navigateur peut renouveler l'abonnement sans prévenir : on renvoie le courant à chaque ouverture.
export const refreshPushSubscription = async (): Promise<void> => {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await fetch("/api/v1/devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pushToken: JSON.stringify(subscription), platform: "web" }),
  });
};

// Coupe réellement cet appareil : côté navigateur et côté serveur.
export const disablePush = async (): Promise<void> => {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await fetch("/api/v1/devices", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pushToken: JSON.stringify(subscription) }),
  });
  await subscription.unsubscribe();
};
