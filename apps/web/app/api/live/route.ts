import { NextResponse } from "next/server";

// Sonde fréquente : disponibilité HTTP sans connexion à Neon. La sonde approfondie reste /api/health.
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
