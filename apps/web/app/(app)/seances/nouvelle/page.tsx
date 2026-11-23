import { sessionReturnTo } from "@/lib/session-navigation";
import { isoDate, uuid } from "@tartan/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Button } from "@/components/ui/button";
import { BuilderPage } from "@/features/sessions/builder-page";
import { requirePlannerSpace } from "@/features/shell/space";

export const metadata: Metadata = { title: m.coach.newSession };

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; groupe?: string; retour?: string; modele?: string }>;
}) {
  const { actor, organizationId, space, personal } = await requirePlannerSpace();
  const { date, groupe, retour, modele } = await searchParams;
  const day = isoDate.safeParse(date).success ? date : undefined;
  // L'autre façon de commencer une séance : l'écrire ou la dicter. Elle garde le jour et le groupe de cette page.
  const planner = new URLSearchParams({
    ...(day ? { date: day } : {}),
    ...(uuid.safeParse(groupe).success ? { groupe: groupe! } : {}),
  }).toString();
  return (
    <BuilderPage
      userId={actor.userId}
      organizationId={organizationId}
      defaultDate={day}
      defaultGroupId={groupe}
      returnTo={sessionReturnTo(retour)}
      // Un modèle choisi depuis les premiers pas : la séance part de lui.
      templateId={uuid.safeParse(modele).success ? modele : undefined}
      personalAthleteId={personal ? (space.athleteId ?? undefined) : undefined}
      headerActions={
        space.aiPlannerEnabled ? (
          <Button asChild size="sm" variant="secondary">
            <Link href={`/planificateur${planner ? `?${planner}` : ""}`} prefetch={false}>
              <Sparkles aria-hidden className="size-4" />
              {w.planner.entry.withPlanner}
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
}
