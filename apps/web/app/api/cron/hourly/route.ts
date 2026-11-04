import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { hasBearer } from "@/lib/secure-compare";
import { runHourlyJobs } from "@/server/cron.service";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!hasBearer(request.headers.get("authorization"), env().CRON_SECRET)) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const result = await runHourlyJobs();
  return NextResponse.json(result, { status: result.errors.length ? 500 : 200 });
}
