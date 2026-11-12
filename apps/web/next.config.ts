import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

// Identifiant du déploiement : compare l'onglet ouvert à ce qui est en ligne, et versionne le service worker.
const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.TARTAN_BUILD_ID ?? "dev";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  // Avec la protection contre les décalages de Vercel, un onglet ancien continue de charger ses propres fichiers.
  ...(process.env.VERCEL_DEPLOYMENT_ID ? { deploymentId: process.env.VERCEL_DEPLOYMENT_ID } : {}),
  // La recette de production ne remplace pas le build utilisé par un serveur local existant.
  distDir: process.env.TARTAN_E2E_BUILD === "true" ? ".next-e2e" : ".next",
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  transpilePackages: [
    "@tartan/api-client",
    "@tartan/contracts",
    "@tartan/design-tokens",
    "@tartan/domain",
    "@tartan/game",
    "@tartan/i18n",
    "@tartan/mascot",
  ],
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  // La carte de record lit ses polices et le logo sur le disque au moment du rendu : ils partent avec la fonction.
  outputFileTracingIncludes: {
    "/api/v1/orgs/[orgId]/athletes/[athleteId]/performances/[performanceId]/carte": [
      "./assets/fonts/*.ttf",
      "./public/brand/logo-on-dark.svg",
    ],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.mux.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Même entre nos pages, le référent reste le domaine : un jeton d'URL ne part pas avec la mesure d'audience.
          { key: "Referrer-Policy", value: "strict-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
      // Un service worker à jour doit être vu tout de suite.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

// Cartes de code envoyées seulement si le jeton est présent : un build sans Sentry reste identique.
const finalConfig: NextConfig = process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      release: { name: buildId },
    })
  : nextConfig;

export default finalConfig;
