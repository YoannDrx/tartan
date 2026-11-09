import { NextResponse, type NextRequest } from "next/server";
import { ATTRIBUTION_WINDOW_DAYS } from "@tartan/domain";

// Dernier lien cliqué dans une fenêtre de 30 jours (§ 17.4).
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const host = request.headers.get("host") ?? "";
  const onProduction = ["tartan.coach", "www.tartan.coach", "app.tartan.coach"].includes(host);
  const response = NextResponse.redirect(
    new URL("/connexion", onProduction ? "https://app.tartan.coach" : request.url),
  );
  if (/^[A-Za-z0-9-]{4,40}$/.test(code)) {
    response.cookies.set("tartan_ref", code.toUpperCase(), {
      maxAge: ATTRIBUTION_WINDOW_DAYS * 86400,
      sameSite: "lax",
      httpOnly: true,
      path: "/",
      // Le lien vit sur tartan.coach, l'inscription sur app.tartan.coach.
      ...(onProduction ? { domain: ".tartan.coach", secure: true } : {}),
    });
  }
  return response;
}
