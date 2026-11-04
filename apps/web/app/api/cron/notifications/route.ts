import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { hasBearer } from "@/lib/secure-compare";
import { flushEmailOutbox } from "@/server/email-outbox.service";
import { sendHeartbeat } from "@/server/heartbeat";
import { dispatchPending, notificationDeliveryHealth } from "@/server/notification-delivery.service";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!hasBearer(request.headers.get("authorization"), env().CRON_SECRET)) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const dispatched = await dispatchPending();
  const outbox = await flushEmailOutbox();
  const health = await notificationDeliveryHealth();
  if (health.undeliveredLast24h) log.warn("notifications_undelivered_24h", { count: health.undeliveredLast24h });
  await sendHeartbeat("notifications");
  return NextResponse.json({ dispatched, outbox, ...health });
}
