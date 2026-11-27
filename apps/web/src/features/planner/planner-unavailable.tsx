import type { SpaceSummary } from "@tartan/contracts";
import { plannerServerEnabled } from "@tartan/domain";
import { w } from "@tartan/i18n/web";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { SpaceContext } from "@/features/shell/space";
import { env } from "@/lib/env";
import { NOTEBOOK_FOR_PLANNER } from "@/lib/onboarding-paths";
import { canOpenNotebook } from "@/server/personal-space.service";
import { EmptyState, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";

// L'athlète d'un club sans carnet planifie pour lui dans un carnet à ouvrir : il y est mené, sans écran « désactivé ».
export async function openNotebookForPlanner({ actor, space, spaces, staff }: SpaceContext): Promise<void> {
  if (staff || space.kind === "personal" || spaces.some((s) => s.kind === "personal")) return;
  if (plannerServerEnabled(env()) && (await canOpenNotebook(actor.userId))) redirect(NOTEBOOK_FOR_PLANNER);
}

// Espace Découverte : l'accès passe par une offre payante. Sinon : coupé par l'éditeur ou le serveur.
export function PlannerUnavailable({ space }: { space: SpaceSummary }) {
  const t = w.planner;
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader title={t.title} />
      {space.aiPlannerUpgrade ? (
        <EmptyState
          rubric="planificateur"
          action={
            <Button asChild>
              <Link href="/abonnement">{t.seeOffers}</Link>
            </Button>
          }
        >
          {t.paidOnly}
        </EmptyState>
      ) : (
        <EmptyState rubric="planificateur">{t.disabled}</EmptyState>
      )}
    </div>
  );
}
