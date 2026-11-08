import { latestRelease } from "@tartan/i18n";
import { BUILD_ID } from "@/lib/build-id";

// Public et sans lecture de base : interrogé à chaque retour sur l'onglet.
export const GET = () =>
  Response.json({ build: BUILD_ID, releaseId: latestRelease("web")?.id ?? null }, { headers: { "Cache-Control": "no-store" } });
