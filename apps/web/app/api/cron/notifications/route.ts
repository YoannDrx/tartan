import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { sendHeartbeat } from "@/server/heartbeat";
import { dispatchPending, notificationDeliveryHealth } from "@/server/notification-delivery.service";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const dispatched = await dispatchPending();
  const health = await notificationDeliveryHealth();
  if (health.undeliveredLast24h) log.warn("notifications_undelivered_24h", { count: health.undeliveredLast24h });
  await sendHeartbeat("notifications");
  return NextResponse.json({ dispatched, ...health });
}
