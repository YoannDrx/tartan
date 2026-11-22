import type { SpaceSummary } from "@tartan/contracts";
import { w } from "@tartan/i18n/web";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";

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
