import webpush from "web-push";
import { env } from "./env";

export type DeliveryResult =
  | { state: "accepted" }
  | { state: "receipt"; receiptId: string }
  | { state: "retry"; code: string; poll?: boolean }
  | { state: "invalid" | "failed"; code: string };

// Codes techniques connus seulement : les messages des prestataires peuvent contenir des jetons.
const expoError = (code: unknown): DeliveryResult => {
  if (code === "DeviceNotRegistered") return { state: "invalid", code: "expo_device_unregistered" };
  if (code === "MessageTooBig") return { state: "failed", code: "expo_message_too_big" };
  if (code === "InvalidCredentials" || code === "MismatchSenderId") return { state: "retry", code: "expo_credentials" };
  if (code === "MessageRateExceeded") return { state: "retry", code: "expo_rate_limit" };
  return { state: "retry", code: "expo_error" };
};

type ExpoResponse = { data?: unknown };
const postExpo = async (path: string, body: unknown): Promise<ExpoResponse | null> => {
  const token = env().EXPO_ACCESS_TOKEN;
  try {
    const res = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as ExpoResponse;
  } catch {
    return null;
  }
};

type Ticket = { status?: unknown; id?: unknown; details?: { error?: unknown } };

export const sendExpoNotification = async (message: unknown): Promise<DeliveryResult> => {
  const response = await postExpo("send", [message]);
  const ticket = (Array.isArray(response?.data) ? response.data[0] : undefined) as Ticket | undefined;
  if (ticket?.status === "ok" && typeof ticket.id === "string" && ticket.id) {
    return { state: "receipt", receiptId: ticket.id };
  }
  if (ticket?.status === "error") return expoError(ticket.details?.error);
  return { state: "retry", code: "expo_unavailable" };
};

export const readExpoReceipt = async (receiptId: string): Promise<DeliveryResult> => {
  const response = await postExpo("getReceipts", { ids: [receiptId] });
  const receipt = (response?.data as Record<string, Ticket> | undefined)?.[receiptId];
  if (receipt?.status === "ok") return { state: "accepted" };
  if (receipt?.status === "error") return expoError(receipt.details?.error);
  // Un accusé absent n'autorise pas un nouvel envoi : le premier est peut-être déjà arrivé.
  return { state: "retry", code: "expo_receipt_pending", poll: true };
};

export const sendWebNotification = async (rawSubscription: string, body: string): Promise<DeliveryResult> => {
  const e = env();
  if (!e.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !e.VAPID_PRIVATE_KEY) return { state: "retry", code: "web_push_unconfigured" };
  let subscription: webpush.PushSubscription;
  try {
    subscription = JSON.parse(rawSubscription) as webpush.PushSubscription;
  } catch {
    return { state: "invalid", code: "web_subscription_invalid" };
  }
  try {
    webpush.setVapidDetails(e.VAPID_SUBJECT, e.NEXT_PUBLIC_VAPID_PUBLIC_KEY, e.VAPID_PRIVATE_KEY);
    await webpush.sendNotification(subscription, body, { timeout: 10_000, TTL: 6 * 60 * 60 });
    return { state: "accepted" };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return { state: "invalid", code: "web_subscription_expired" };
    return { state: "retry", code: "web_push_failed" };
  }
};
