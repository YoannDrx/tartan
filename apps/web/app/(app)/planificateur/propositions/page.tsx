import Link from "next/link";
import { notFound } from "next/navigation";
import { uuid } from "@tartan/contracts";
import { historyDate } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { PlannerUnavailable } from "@/features/planner/planner-unavailable";
import { requireSpace, orNotFound } from "@/features/shell/space";
import { listPlannerProposals } from "@/server/ai/proposal.service";
import { getPlannerUsage } from "@/server/ai/usage.service";

const t = w.planner;
export const metadata = { title: t.recent };
export default async function PlannerProposalsPage({ searchParams }: { searchParams: Promise<{ avant?: string }> }) {
  const { actor, organizationId, space } = await requireSpace();
  if (!space.aiPlannerEnabled) return <PlannerUnavailable space={space} />;
  const { avant } = await searchParams;
  if (avant && !uuid.safeParse(avant).success) notFound();
  const usage = await orNotFound(() => getPlannerUsage(actor.userId, organizationId));
  const result = await orNotFound(() => listPlannerProposals(actor.userId, organizationId, { before: avant }));
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader
        title={t.recent}
        detail={t.proposals.hint}
        actions={
          <Button asChild variant="secondary">
            <Link href="/planificateur">{t.newProposal}</Link>
          </Button>
        }
      />
      <section className="on-card flex min-w-0 flex-col gap-3 rounded-card bg-card p-4 desktop:p-6">
        <p className="t-caption font-normal text-soft">{t.proposals.retention}</p>
        {!result.items.length ? <p>{t.proposals.empty}</p> : null}
        {result.items.length ? (
          <ul className="divide-y divide-card-line border-y border-card-line">
            {result.items.map((p) => (
              <li key={p.id} className="flex min-w-0 flex-col py-2">
                <Link
                  href={`/planificateur?proposition=${p.id}`}
                  prefetch={false}
                  className="flex min-h-11 items-center break-words font-semibold underline decoration-1 underline-offset-4"
                >
                  {t.proposals.open(historyDate(p.period.from), historyDate(p.period.to), t.proposals.states[p.state])}
                </Link>
                <p className="t-caption font-normal text-soft">
                  {t.proposals.sent(new Date(p.createdAt).toLocaleString("fr-FR", { timeZone: usage.timeZone }))}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
        {avant || result.nextCursor ? (
          <div className="flex flex-wrap gap-3">
            {avant ? (
              <Button asChild size="sm" variant="secondary">
                <Link href="/planificateur/propositions" prefetch={false}>
                  {t.proposals.refresh}
                </Link>
              </Button>
            ) : null}
            {result.nextCursor ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={`/planificateur/propositions?avant=${result.nextCursor}`} prefetch={false}>
                  {t.proposals.earlier}
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
