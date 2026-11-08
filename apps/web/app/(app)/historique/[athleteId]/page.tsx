import { notFound } from "next/navigation";
import { isoDate, uuid } from "@tartan/contracts";
import { historyRange, type HistoryPeriod } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { ExerciseHistoryView } from "@/features/progression/exercise-history";
import { requireSpace, orNotFound } from "@/features/shell/space";
import { getAthleteExerciseHistory, getAthleteHistoryContext } from "@/server/exercise-history.service";

export const metadata = { title: m.exerciseHistory.title };
export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ exercise?: string; days?: string; to?: string }>;
}) {
  const { actor, organizationId, space } = await requireSpace();
  const [{ athleteId }, query] = await Promise.all([params, searchParams]);
  if (!uuid.safeParse(athleteId).success) notFound();
  if (!space.progressionEnabled) return <p>{m.progression.disabled}</p>;
  const context = await orNotFound(() => getAthleteHistoryContext(actor.userId, organizationId, athleteId));
  const exerciseId = query.exercise ?? context.exercises[0]?.id;
  if (exerciseId && !uuid.safeParse(exerciseId).success) notFound();
  if (query.to && !isoDate.safeParse(query.to).success) notFound();
  const until = query.to ?? context.today;
  const days: HistoryPeriod = query.days === "84" ? 84 : query.days === "365" ? 365 : 28;
  const history = exerciseId
    ? await orNotFound(() =>
        getAthleteExerciseHistory(actor.userId, organizationId, athleteId, exerciseId, historyRange(until, days)),
      )
    : null;
  // Un lien direct reste consultable même après effacement des dernières séries.
  const exercises =
    history && !context.exercises.some((exercise) => exercise.id === exerciseId)
      ? [
          ...context.exercises,
          { ...history.exercise, hasRealizedSets: false, hasStrengthTests: false, hasStrengthReference: false },
        ]
      : context.exercises;
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader title={m.exerciseHistory.title} detail={`${context.athlete.firstName} ${context.athlete.lastName}`} />
      <ExerciseHistoryView
        key={`${organizationId}:${athleteId}:${exerciseId}:${days}:${until}`}
        exercises={exercises}
        history={history}
        days={days}
        today={context.today}
      />
    </div>
  );
}
