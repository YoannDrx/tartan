import { NextResponse } from "next/server";
import { isDatabaseHealthy } from "@/server/health.service";

export async function GET() {
  const healthy = await isDatabaseHealthy();
  return NextResponse.json({ status: healthy ? "ok" : "degraded" }, { status: healthy ? 200 : 503 });
}
