import Link from "next/link";
import { notFound } from "next/navigation";
import { isoDate, uuid } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { WebPlanner } from "@/features/planner/web-planner";
import { requireSpace, orNotFound } from "@/features/shell/space";
import { AppError } from "@/lib/errors";
import { getPlannerProposal } from "@/server/ai/proposal.service";
import { getPlannerUsage } from "@/server/ai/usage.service";
import { getSessionBuilderContext } from "@/server/session-builder.service";

export const metadata = { title: m.aiPlanner.title };
export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ proposition?: string; date?: string; groupe?: string }>;
}) {
  const { actor, organizationId, space } = await requireSpace();
  if (!space.aiPlannerEnabled) return <p>{m.aiPlanner.disabled}</p>;
  const params = await searchParams;
  if (
    (params.proposition && !uuid.safeParse(params.proposition).success) ||
    (params.date && !isoDate.safeParse(params.date).success) ||
    (params.groupe && !uuid.safeParse(params.groupe).success)
  )
    notFound();
  const usage = await orNotFound(() => getPlannerUsage(actor.userId, organizationId));
  const context = await getSessionBuilderContext(actor.userId, organizationId);
  if (params.groupe && !context.groups.some((g) => g.id === params.groupe)) notFound();
  let initial = null;
  if (params.proposition) {
    try {
      initial = await orNotFound(() => getPlannerProposal(actor.userId, organizationId, params.proposition!));
    } catch (error) {
      if (!(error instanceof AppError) || error.status !== 410) throw error;
      return (
        <div className="flex flex-col gap-4">
          <PageHeader title={m.aiPlanner.title} />
          <p>{m.aiPlanner.expiredRequest}</p>
          <Button asChild>
            <Link href="/planificateur">{m.aiPlanner.newProposal}</Link>
          </Button>
        </div>
      );
    }
  }
  const date = params.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: usage.timeZone }).format(new Date());
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader
        title={m.aiPlanner.title}
        detail={m.aiPlanner.lead}
        actions={
          <Button asChild variant="secondary">
            <Link href="/planificateur/propositions" prefetch={false}>
              {m.aiPlanner.recent}
            </Link>
          </Button>
        }
      />
      <WebPlanner
        key={`${actor.userId}:${organizationId}:${params.proposition ?? "new"}`}
        orgId={organizationId}
        context={context}
        initial={initial}
        initialUsage={usage}
        initialSelection={{
          period: { from: date, to: date },
          groupIds: params.groupe ? [params.groupe] : [],
          athleteIds: [],
          exerciseIds: [],
          phaseChoices: [],
        }}
      />
    </div>
  );
}
