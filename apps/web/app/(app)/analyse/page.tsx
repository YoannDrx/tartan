import { DateInput } from "@/components/ui/date-input";
import { notFound } from "next/navigation";
import { trainingAnalysisQuery } from "@tartan/contracts";
import { historyRange } from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { TrainingAnalysisView } from "@/features/analysis/training-analysis";
import { requireSpace, orNotFound } from "@/features/shell/space";
import { getTrainingAnalysis, getTrainingAnalysisContext } from "@/server/training-analysis.service";
export const metadata = { title: m.analysis.title };
export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; target?: string; from?: string; to?: string; rangePhase?: string }>;
}) {
  const { actor, organizationId, space } = await requireSpace();
  if (!space.progressionEnabled) return <p>{m.progression.disabled}</p>;
  const context = await getTrainingAnalysisContext(actor.userId, organizationId);
  const search = await searchParams;
  const period = search.period ?? "28";
  const phase = period.startsWith("phase:") ? context.phases.find((p) => p.id === period.slice(6)) : null;
  if (!phase && !["28", "84", "365"].includes(period)) notFound();
  const [kind, id] = search.target?.split(":") ?? [];
  if (search.target && (!["group", "athlete"].includes(kind!) || !id)) notFound();
  const keepRange = !search.rangePhase || search.rangePhase === phase?.id;
  const from = (keepRange ? search.from : undefined) ?? phase?.startDate;
  const to = (keepRange ? search.to : undefined) ?? phase?.endDate;
  const query = trainingAnalysisQuery.safeParse({
    ...(phase ? { from, to, phaseId: phase.id } : historyRange(context.today, Number(period) as 28 | 84 | 365)),
    ...(kind === "athlete" ? { athleteId: id } : kind === "group" ? { groupId: id } : {}),
  });
  const overlapsSharedPhase =
    !phase ||
    space.role === "owner" ||
    space.role === "coach" ||
    (query.success && query.data.from <= phase.endDate && query.data.to >= phase.startDate);
  const data =
    query.success && overlapsSharedPhase
      ? await orNotFound(() => getTrainingAnalysis(actor.userId, organizationId, query.data))
      : null;
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader title={m.analysis.title} />
      <form className="grid items-end gap-3 sm:grid-cols-3">
        {phase ? (
          <>
            <input type="hidden" name="rangePhase" value={phase.id} />
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="to" value={to} />
          </>
        ) : null}
        <Field label={m.trainingPhases.target}>
          {(props) => (
            <Select {...props} name="target" defaultValue={search.target ?? ""}>
              <option value="">{m.trainingPhases.all}</option>
              {context.groups.map((g) => (
                <option key={g.id} value={`group:${g.id}`}>
                  {g.name} · {m.trainingPhases.group}
                </option>
              ))}
              {context.athletes.map((a) => (
                <option key={a.id} value={`athlete:${a.id}`}>
                  {a.name} · {m.trainingPhases.athlete}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={m.analysis.period}>
          {(props) => (
            <Select {...props} name="period" defaultValue={period}>
              <option value="28">{m.analysis.fourWeeks}</option>
              <option value="84">{m.analysis.twelveWeeks}</option>
              <option value="365">{m.analysis.year}</option>
              {context.phases.map((p) => (
                <option key={p.id} value={`phase:${p.id}`}>
                  {p.targetName} : {p.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="submit">{m.analysis.apply}</Button>
      </form>
      {phase ? (
        <details open={!query.success || !overlapsSharedPhase}>
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">
            {m.analysis.phaseRange}
            {query.success ? ` : ${historyDate(query.data.from)} – ${historyDate(query.data.to)}` : ""}
          </summary>
          <form aria-label={m.analysis.phaseRange} className="grid items-end gap-3 sm:grid-cols-3">
            <input type="hidden" name="period" value={period} />
            <input type="hidden" name="rangePhase" value={phase.id} />
            {search.target ? <input type="hidden" name="target" value={search.target} /> : null}
            <p className="text-soft sm:col-span-3">{m.analysis.phaseRangeHint}</p>
            <Field label={m.analysis.rangeFrom}>
              {(props) => <DateInput {...props} name="from" required defaultValue={from} />}
            </Field>
            <Field label={m.analysis.rangeTo}>
              {(props) => <DateInput {...props} name="to" required defaultValue={to} />}
            </Field>
            <Button type="submit">{m.analysis.applyRange}</Button>
          </form>
        </details>
      ) : null}
      {data ? <TrainingAnalysisView data={data} /> : <p role="alert">{m.analysis.invalid}</p>}
    </div>
  );
}
