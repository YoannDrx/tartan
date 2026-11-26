"use client";

import type { SpaceSummary } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { chooseHomeAction } from "@/features/shell/shell.action";
import { Button } from "@/components/ui/button";
import { onErr } from "./shared";

export function MyClubs({ spaces }: { spaces: SpaceSummary[] }) {
  const { execute, isPending } = useAction(chooseHomeAction, { onError: onErr });
  const clubs = spaces.filter((s) => !s.isDemo && s.kind !== "personal");
  const standalone = clubs.every((club) => club.role !== "athlete") && spaces.find((s) => s.kind === "personal");
  if (!clubs.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="t-section">{m.brand.clubs}</h2>
      <ul className="on-card divide-y divide-card-line rounded-card bg-card px-3">
        {clubs.map((club, i) => (
          <li key={club.organizationId} className="flex flex-wrap items-center gap-2 py-2">
            <span className="mr-auto">
              {club.organizationName} · {m.roles[club.role]}
            </span>
            {i === 0 ? (
              <span>{m.brand.usual}</span>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => execute({ organizationId: club.organizationId })}
              >
                {m.brand.makeUsual}
              </Button>
            )}
            <Button asChild size="sm">
              <Link
                prefetch={false}
                href={`/${club.role === "athlete" ? "aujourdhui" : "suivi"}?espace=${club.organizationId}`}
              >
                {m.brand.openClub}
              </Link>
            </Button>
          </li>
        ))}
      </ul>
      {standalone && (
        <Link prefetch={false} href={`/aujourdhui?espace=${standalone.organizationId}`}>
          {m.brand.notebook}
        </Link>
      )}
    </section>
  );
}
