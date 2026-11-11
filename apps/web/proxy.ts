import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SPACE_COOKIE } from "@/features/shell/space-cookie";

const buildCsp = (nonce: string): string =>
  [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://image.mux.com https://i.ytimg.com https://*.public.blob.vercel-storage.com",
    "font-src 'self'",
    "media-src 'self' blob: https://stream.mux.com https://*.mux.com",
    "connect-src 'self' https://*.mux.com https://storage.googleapis.com https://vitals.vercel-insights.com https://*.ingest.de.sentry.io",
    "frame-src https://www.youtube-nocookie.com https://www.instagram.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(process.env.VERCEL_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

const SITE_PATHS = [
  "/",
  "/tarifs",
  "/confidentialite",
  "/conditions",
  "/cgv",
  "/mentions-legales",
  "/contact",
  "/aide",
  "/suppression-compte",
  "/robots.txt",
  "/sitemap.xml",
];
const isSitePath = (pathname: string): boolean =>
  SITE_PATHS.includes(pathname) ||
  pathname.startsWith("/r/") ||
  pathname.startsWith("/brand/") ||
  pathname.startsWith("/mobile/");

// Jamais new URL(chemin, base) : un chemin « //evil.com » changerait d'hôte.
const onHost = (base: string, pathname: string, search: string): URL => {
  const target = new URL(base);
  target.pathname = pathname;
  target.search = search;
  return target;
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  if (host === "www.tartan.coach") {
    return NextResponse.redirect(onHost("https://tartan.coach", pathname, request.nextUrl.search), 308);
  }
  // Lien de notification : il ouvre le bon espace. Le serveur revérifie l'appartenance à chaque lecture.
  const space = request.nextUrl.searchParams.get("espace");
  if (space) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("espace");
    const response = NextResponse.redirect(clean);
    response.cookies.set(SPACE_COOKIE, space, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  }
  // app.tartan.coach ouvre directement l'application ; tartan.coach reste le site.
  if (host.startsWith("app.") && pathname === "/") {
    return NextResponse.redirect(new URL("/accueil", request.url));
  }
  // La session vit sur app.tartan.coach : les pages d'application y sont toujours servies.
  if ((host === "tartan.coach" || host === "www.tartan.coach") && !isSitePath(pathname)) {
    return NextResponse.redirect(onHost("https://app.tartan.coach", pathname, request.nextUrl.search));
  }
  const nonce = btoa(crypto.randomUUID());
  const policy = buildCsp(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    { source: "/((?!api|_next/static|_next/image|.well-known|favicon|icon|apple-touch|manifest|sw.js|brand).*)" },
  ],
};
