import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { assertRevenueCatAuth, handleRevenueCatEvent } from "@/server/billing.service";

const payload = z.object({
  event: z.object({
    id: z.string(),
    type: z.string(),
    app_user_id: z.string(),
    product_id: z.string().optional(),
    expiration_at_ms: z.number().nullable().optional(),
    period_type: z.string().optional(),
  }),
});

export async function POST(request: Request) {
  try {
    assertRevenueCatAuth(request.headers.get("authorization"));
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    throw error;
  }
  const parsed = payload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Charge invalide" }, { status: 400 });
  await handleRevenueCatEvent(parsed.data.event);
  return NextResponse.json({ received: true });
}
