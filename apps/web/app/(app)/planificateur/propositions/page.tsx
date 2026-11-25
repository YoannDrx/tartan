import Link from "next/link";
import { notFound } from "next/navigation";
import { uuid } from "@tartan/contracts";
import { RemoveProposal } from "@/features/planner/remove-proposal";
import { historyDate, m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { PlannerUnavailable } from "@/features/planner/planner-unavailable";
import { requireResourceSpace, orNotFound } from "@/features/shell/space";
import { listPlannerProposals } from "@/server/ai/proposal.service";
import { getPlannerUsage } from "@/server/ai/usage.service";

const t = w.planner;
export const metadata = { title: t.recent };
export default async function PlannerProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ avant?: string; filtre?: string }>;
}) {
  const { actor, organizationId, space } = await requireResourceSpace();
  if (!space.aiPlannerEnabled) return <PlannerUnavailable space={space} />;
  const { avant, filtre = "all" } = await searchParams;
  if (filtre !== "all" && filtre !== "created" && filtre !== "pending") notFound();
  if (avant && !uuid.safeParse(avant).success) notFound();
  const usage = await orNotFound(() => getPlannerUsage(actor.userId, organizationId));
  const result = await orNotFound(() =>
    listPlannerProposals(actor.userId, organizationId, { before: avant, filter: filtre }),
  );
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
        <nav aria-label={t.recent} className="flex flex-wrap gap-2">
          {(["pending", "created", "all"] as const).map((filter) => (
            <Button key={filter} asChild variant={filter === filtre ? "primary" : "secondary"} size="sm">
              <Link
                aria-current={filter === filtre ? "page" : undefined}
                href={`/planificateur/propositions?filtre=${filter}`}
              >
                {m.aiPlanner.historyFilters[filter]}
              </Link>
            </Button>
          ))}
        </nav>
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
                  {m.aiPlanner.historyActions[p.state]} ·{" "}
                  {t.proposals.open(historyDate(p.period.from), historyDate(p.period.to), t.proposals.states[p.state])}
                </Link>
                <p className="t-caption font-normal text-soft">
                  {t.proposals.sent(new Date(p.createdAt).toLocaleString("fr-FR", { timeZone: usage.timeZone }))}
                </p>
                {p.actions?.includes("remove") && p.version !== undefined ? (
                  <RemoveProposal
                    canDuplicate={p.actions.includes("duplicate")}
                    orgId={organizationId}
                    id={p.id}
                    version={p.version}
                    period={m.aiPlanner.recentOpen(
                      historyDate(p.period.from),
                      historyDate(p.period.to),
                      m.aiPlanner.recentStates[p.state],
                    )}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {avant || result.nextCursor ? (
          <div className="flex flex-wrap gap-3">
            {avant ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={`/planificateur/propositions?filtre=${filtre}`} prefetch={false}>
                  {t.proposals.refresh}
                </Link>
              </Button>
            ) : null}
            {result.nextCursor ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={`/planificateur/propositions?filtre=${filtre}&avant=${result.nextCursor}`} prefetch={false}>
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
