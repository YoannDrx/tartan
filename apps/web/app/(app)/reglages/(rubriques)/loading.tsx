import { m } from "@tartan/i18n";

// D'une rubrique à l'autre, le bandeau et la barre latérale restent en place : seule la feuille attend ses données.
export default function Loading() {
  return (
    <div role="status" aria-busy>
      <span className="sr-only">{m.common.loading}</span>
      <div aria-hidden className="on-card divide-y divide-card-line overflow-hidden rounded-card bg-card">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex min-h-16 items-center gap-3 px-4">
            <div className="h-4 w-2/5 rounded-full bg-card-raised" />
            <div className="ml-auto h-4 w-16 rounded-full bg-card-raised" />
          </div>
        ))}
      </div>
    </div>
  );
}
