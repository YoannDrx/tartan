import { NextResponse, type NextRequest } from "next/server";
import { ATTRIBUTION_WINDOW_DAYS } from "@tartan/domain";

export const REFERRAL_COOKIE = "tartan_ref";

// Dernier lien cliqué dans une fenêtre de 30 jours (§ 17.4).
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const response = NextResponse.redirect(new URL("/connexion", request.url));
  if (/^[A-Za-z0-9-]{4,40}$/.test(code)) {
    response.cookies.set(REFERRAL_COOKIE, code.toUpperCase(), {
      maxAge: ATTRIBUTION_WINDOW_DAYS * 86400,
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    });
  }
  return response;
}
