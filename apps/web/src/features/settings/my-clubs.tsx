"use client";

import type { SpaceSummary } from "@tartan/contracts";
import { m } from "@tartan/i18n";

export function MyClubs({ spaces }: { spaces: SpaceSummary[] }) {
  const clubs = spaces.filter((s) => !s.isDemo && s.kind !== "personal");
  if (!clubs.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="t-section">{m.brand.clubs}</h2>
      <ul className="on-card divide-y divide-card-line rounded-card bg-card px-3">
        {clubs.map((club) => (
          <li key={club.organizationId} className="flex flex-wrap items-center gap-2 py-2">
            <span className="mr-auto">
              {club.organizationName} · {m.roles[club.role]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
