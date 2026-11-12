"use client";

import { m } from "@tartan/i18n";
import { useParams } from "next/navigation";
import { BandSkeleton } from "@/components/states";
import { Stay } from "@/components/ui/view-transition";
import { sessionCardName } from "@/features/athlete-view/session-card";

// L'écran d'attente d'une séance porte déjà sa feuille, sous le même nom que la carte d'où l'on vient :
// la carte s'ouvre en feuille tout de suite, et le contenu la remplit quand il arrive.
export default function Loading() {
  const { id } = useParams<{ id: string }>();
  return (
    <div role="status" aria-busy className="mx-auto flex max-w-2xl flex-col gap-4">
      <BandSkeleton />
      <span className="sr-only">{m.common.loading}</span>
      <Stay name={sessionCardName(id)}>
        <div aria-hidden className="on-card flex h-56 flex-col gap-3 rounded-card bg-card p-4">
          <div className="h-6 w-2/3 rounded-full bg-card-raised" />
          <div className="h-12 rounded-full bg-card-raised" />
          <div className="h-12 rounded-full bg-card-raised" />
        </div>
      </Stay>
      <div aria-hidden className="on-card h-40 rounded-card bg-card" />
    </div>
  );
}
