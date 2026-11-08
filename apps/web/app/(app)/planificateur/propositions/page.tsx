import Link from "next/link";
import { notFound } from "next/navigation";
import { uuid } from "@tartan/contracts";
import { m, historyDate } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { requireSpace, orNotFound } from "@/features/shell/space";
import { listPlannerProposals } from "@/server/ai/proposal.service";
import { getPlannerUsage } from "@/server/ai/usage.service";

export const metadata = { title: m.aiPlanner.recent };
export default async function PlannerProposalsPage({ searchParams }: { searchParams: Promise<{ avant?: string }> }) {
  const { actor, organizationId, space } = await requireSpace();
  const t = m.aiPlanner;
  if (!space.aiPlannerEnabled) return <p>{t.disabled}</p>;
  const { avant } = await searchParams;
  if (avant && !uuid.safeParse(avant).success) notFound();
  const usage = await orNotFound(() => getPlannerUsage(actor.userId, organizationId));
  const result = await orNotFound(() => listPlannerProposals(actor.userId, organizationId, { before: avant }));
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader
        title={t.recent}
        detail={t.recentHint}
        actions={
          <Button asChild variant="secondary">
            <Link href="/planificateur">{t.newProposal}</Link>
          </Button>
        }
      />
      <p className="text-soft">{t.recentRetention}</p>
      {!result.items.length ? <p>{t.recentEmpty}</p> : null}
      <ul className="flex flex-col gap-3">
        {result.items.map((p) => (
          <li key={p.id} className="rounded-card border border-card-line p-4">
            <Link
              href={`/planificateur?proposition=${p.id}`}
              prefetch={false}
              className="flex min-h-11 flex-col gap-1 break-words font-semibold underline decoration-1 underline-offset-4"
            >
              {t.recentOpen(historyDate(p.period.from), historyDate(p.period.to), t.recentStates[p.state])}
            </Link>
            <p className="text-soft">
              {t.recentCreated(new Date(p.createdAt).toLocaleString("fr-FR", { timeZone: usage.timeZone }))}
            </p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        {avant ? (
          <Button asChild variant="secondary">
            <Link href="/planificateur/propositions" prefetch={false}>
              {t.recentRefresh}
            </Link>
          </Button>
        ) : null}
        {result.nextCursor ? (
          <Button asChild variant="secondary">
            <Link href={`/planificateur/propositions?avant=${result.nextCursor}`} prefetch={false}>
              {t.recentEarlier}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
