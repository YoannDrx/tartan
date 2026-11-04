import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runHourlyJobs } from "@/server/cron.service";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const result = await runHourlyJobs();
  return NextResponse.json(result, { status: result.errors.length ? 500 : 200 });
}
