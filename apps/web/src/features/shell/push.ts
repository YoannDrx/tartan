"use client";

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
  await navigator.serviceWorker.register("/sw.js");
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
