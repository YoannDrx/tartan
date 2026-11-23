import Link from "next/link";
import { notFound } from "next/navigation";
import { isoDate, trainingEquipment, uuid } from "@tartan/contracts";
import { w } from "@tartan/i18n/web";
import { PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { PlannerConsent, PlannerConsentWithdraw } from "@/features/planner/planner-consent";
import { PlannerUnavailable } from "@/features/planner/planner-unavailable";
import { WebPlanner } from "@/features/planner/web-planner";
import { requireSpace, orNotFound } from "@/features/shell/space";
import { AppError } from "@/lib/errors";
import { hasAiConsent } from "@/server/ai/consent.service";
import { getPlannerProposal } from "@/server/ai/proposal.service";
import { getPlannerUsage } from "@/server/ai/usage.service";
import { listExerciseLists } from "@/server/exercise-list.service";
import { getSessionBuilderContext } from "@/server/session-builder.service";
import { getOrganization } from "@/server/org.service";

const t = w.planner;
export const metadata = { title: t.title };
export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ proposition?: string; date?: string; groupe?: string }>;
}) {
  const { actor, organizationId, space, personal } = await requireSpace();
  if (!space.aiPlannerEnabled) return <PlannerUnavailable space={space} />;
  if (!(await hasAiConsent(actor.userId))) return <PlannerConsent />;
  const params = await searchParams;
  if (
    (params.proposition && !uuid.safeParse(params.proposition).success) ||
    (params.date && !isoDate.safeParse(params.date).success) ||
    (params.groupe && !uuid.safeParse(params.groupe).success)
  )
    notFound();
  const usage = await orNotFound(() => getPlannerUsage(actor.userId, organizationId));
  const [context, organization, lists] = await Promise.all([
    getSessionBuilderContext(actor.userId, organizationId),
    getOrganization(actor.userId, organizationId),
    // Les listes du coach : ajouter, remplacer et compléter cherchent dans toute sa bibliothèque.
    listExerciseLists(actor.userId, organizationId),
  ]);
  if (params.groupe && !context.groups.some((g) => g.id === params.groupe)) notFound();
  let initial = null;
  if (params.proposition) {
    try {
      initial = await orNotFound(() => getPlannerProposal(actor.userId, organizationId, params.proposition!));
    } catch (error) {
      if (!(error instanceof AppError) || error.status !== 410) throw error;
      return (
        <div className="flex flex-col gap-4">
          <PageHeader title={t.title} />
          <p>{t.expiredRequest}</p>
          <div>
            <Button asChild>
              <Link href="/planificateur">{t.newProposal}</Link>
            </Button>
          </div>
        </div>
      );
    }
  }
  const date = params.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: usage.timeZone }).format(new Date());
  // Un seul groupe dans l'espace : il est déjà choisi, la demande part en un champ et un clic.
  const groupIds = params.groupe ? [params.groupe] : context.groups.length === 1 ? [context.groups[0]!.id] : [];
  // Espace personnel : la séance est pour son titulaire, sans autre destinataire.
  const athleteIds = personal && space.athleteId ? [space.athleteId] : [];
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader
        title={t.title}
        detail={t.lead}
        actions={
          <Button asChild variant="secondary">
            <Link href="/planificateur/propositions" prefetch={false}>
              {t.recent}
            </Link>
          </Button>
        }
      />
      <WebPlanner
        key={`${actor.userId}:${organizationId}`}
        orgId={organizationId}
        context={context}
        lists={lists}
        initial={initial}
        routeProposal={params.proposition ?? null}
        initialUsage={usage}
        // Le matériel du profil de l'espace : les précisions le reprennent, le coach le change pour une séance.
        equipment={trainingEquipment.array().catch([]).parse(organization.availableEquipment)}
        solo={personal}
        initialSelection={{
          period: { from: date, to: date },
          groupIds,
          athleteIds,
          exerciseIds: [],
          phaseChoices: [],
        }}
      />
      <PlannerConsentWithdraw />
    </div>
  );
}
