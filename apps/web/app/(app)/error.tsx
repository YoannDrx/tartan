"use client";

import { m } from "@tartan/i18n";
import { useEffect } from "react";
import { TrackTile } from "@/components/states";
import { Button } from "@/components/ui/button";
import { BUILD_ID } from "@/lib/build-id";

const STALE =
  /ChunkLoadError|Loading chunk|Failed to load chunk|Failed to find Server Action|dynamically imported module/i;
const RELOADED = "tartan.stale-reload";

// Après un déploiement, un onglet ancien peut réclamer des fichiers disparus : un seul rechargement par version.
const reloadOnce = (error: Error) => {
  if (!STALE.test(`${error.name} ${error.message}`)) return;
  try {
    if (sessionStorage.getItem(RELOADED) === BUILD_ID) return;
    sessionStorage.setItem(RELOADED, BUILD_ID);
  } catch {
    return;
  }
  window.location.reload();
};

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => reloadOnce(error), [error]);
  return (
    <div className="relative flex min-h-40 flex-col items-start gap-4 overflow-hidden rounded-card on-card bg-card p-6 pr-32 tablet:pr-44">
      {/* Noé, tombé de l'autre côté de la barre : quelque chose n'a pas tenu. */}
      <TrackTile
        athlete="highJump"
        pose="landing"
        className="pointer-events-none absolute inset-y-3 right-3 w-24 tablet:w-36"
      />
      <h1 className="t-h1 relative text-balance">{m.common.genericError}</h1>
      <Button className="relative" onClick={reset}>
        {m.common.retry}
      </Button>
    </div>
  );
}
