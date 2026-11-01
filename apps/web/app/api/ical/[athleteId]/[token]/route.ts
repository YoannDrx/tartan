import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { icalFeed } from "@/server/ical.service";

export async function GET(_request: Request, { params }: { params: Promise<{ athleteId: string; token: string }> }) {
  const { athleteId, token } = await params;
  try {
    const body = await icalFeed(athleteId, token);
    return new NextResponse(body, { headers: { "Content-Type": "text/calendar; charset=utf-8" } });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }
}
