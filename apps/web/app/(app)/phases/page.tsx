import { notFound } from "next/navigation";
import Link from "next/link";
import { trainingPhaseQuery } from "@tartan/contracts";
import { addDays } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { PhaseManager } from "@/features/phases/phase-manager";
import { requireSpace, orNotFound } from "@/features/shell/space";
import { todayIso } from "@/lib/dates";
import { listTrainingPhases, getTrainingPhaseContext } from "@/server/training-phases.service";

export const metadata = { title: m.trainingPhases.title };
export default async function PhasesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; target?: string }>;
}) {
  const { actor, organizationId, space } = await requireSpace();
  const t = m.trainingPhases;
  if (!space.phasesEnabled) return <p>{t.disabled}</p>;
  const query = await searchParams;
  const today = todayIso();
  const [type, id] = query.target?.split(":") ?? [];
  if (query.target && ((type !== "group" && type !== "athlete") || !id)) notFound();
  const parsed = trainingPhaseQuery.safeParse({
    from: query.from ?? today,
    to: query.to ?? addDays(today, 83),
    ...(type === "group" ? { groupId: id } : type === "athlete" ? { athleteId: id } : {}),
  });
  if (!parsed.success) notFound();
  const { from, to } = parsed.data;
  const result = await orNotFound(() => listTrainingPhases(actor.userId, organizationId, parsed.data));
  const context = result.canManage ? await getTrainingPhaseContext(actor.userId, organizationId) : null;
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader
        title={t.title}
        detail={result.canManage ? t.lead : undefined}
        actions={
          <Button asChild variant="secondary">
            <Link href="/calendrier">{m.nav.calendrier}</Link>
          </Button>
        }
      />
      <form className="grid grid-cols-1 items-end gap-3 tablet:grid-cols-2 desktop:grid-cols-4" action="/phases">
        <Field label={t.start}>
          {(props) => <Input {...props} type="date" name="from" defaultValue={from} required />}
        </Field>
        <Field label={t.end}>{(props) => <Input {...props} type="date" name="to" defaultValue={to} required />}</Field>
        {context ? (
          <Field label={t.target}>
            {(props) => (
              <Select {...props} name="target" defaultValue={query.target ?? ""}>
                <option value="">{t.all}</option>
                <optgroup label={t.group}>
                  {context.groups.map((g) => (
                    <option key={g.id} value={`group:${g.id}`}>
                      {g.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t.athlete}>
                  {context.athletes.map((a) => (
                    <option key={a.id} value={`athlete:${a.id}`}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
              </Select>
            )}
          </Field>
        ) : null}
        <Button variant="secondary" type="submit">
          {t.filter}
        </Button>
      </form>
      <PhaseManager
        key={`${organizationId}:${from}:${to}:${query.target ?? ""}`}
        organizationId={organizationId}
        phases={result.phases}
        context={context}
        from={from}
        to={to}
        today={today}
      />
    </div>
  );
}
