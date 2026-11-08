import { getMyRegularity } from "@/server/athlete-view.service";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDayMonth, m, strengthTestLabel } from "@tartan/i18n";
import { Mark, Rows, Sheet, SheetSection } from "@/components/sheet";
import { Chip, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { InjuryDialog } from "@/features/athletes/athlete-forms";
import { requireAthleteSpace } from "@/features/shell/space";
import { getMyFile } from "@/server/athlete.service";
import { CalendarPhases } from "@/features/phases/calendar-phases";
import { todayIso } from "@/lib/dates";
import { addDays } from "@tartan/domain";

export const metadata: Metadata = { title: m.nav.progres };

const date = (iso: string) => `${formatDayMonth(iso)} ${iso.slice(0, 4)}`;

// Les courbes par exercice sont disponibles lorsque la progression est activée.
export default async function ProgresPage() {
  const ctx = await requireAthleteSpace();
  const { actor, organizationId, space } = ctx;
  const today = todayIso();
  const [file, regularity] = await Promise.all([
    getMyFile(actor.userId, organizationId),
    getMyRegularity(actor.userId, organizationId),
  ]);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader
        title={m.nav.progres}
        actions={
          space.progressionEnabled ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link href="/analyse">{m.analysis.title}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/historique/${file.id}`}>{m.exerciseHistory.title}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/outils/charges">{m.calculator.title}</Link>
              </Button>
            </div>
          ) : null
        }
      />
      <CalendarPhases ctx={ctx} from={today} to={addDays(today, 83)} today={today} />
      {regularity.total > 0 ? (
        <Sheet>
          <SheetSection title={m.athletes.regularityTitle}>
            <p>
              <Mark>{m.athletes.regularity(regularity.done, regularity.total)}</Mark>
            </p>
          </SheetSection>
        </Sheet>
      ) : null}
      {file.goals ? (
        <section className="flex flex-col gap-1">
          <h2 className="t-section">{m.athletes.goals}</h2>
          <p className="whitespace-pre-line break-words">{file.goals}</p>
        </section>
      ) : null}
      <Sheet className="divide-y divide-card-line">
        <SheetSection title={m.performances.title}>
          {file.performances.length === 0 ? (
            <p className="text-soft">Tes records apparaîtront ici dès que ton coach les aura notés.</p>
          ) : null}
          <Rows>
            {file.performances.map((p) => (
              <li key={`${p.discipline}-${p.date}-${p.mark}`} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 leading-snug">
                  <span className="flex flex-wrap items-center gap-x-2 font-semibold">
                    {p.discipline}
                    {p.isBaseline ? (
                      <Chip>{m.performances.baseline}</Chip>
                    ) : p.isPb ? (
                      <Chip tone="brand">{m.athletes.record}</Chip>
                    ) : null}
                  </span>
                  <span className="t-caption block font-normal text-soft">
                    {[
                      date(p.date),
                      p.comparisonContext,
                      p.recordDirection === "lower"
                        ? m.performances.lower
                        : p.recordDirection === "higher"
                          ? m.performances.higher
                          : m.performances.unknown,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <Mark>
                  {String(p.mark).replace(".", ",")} {p.unit}
                </Mark>
              </li>
            ))}
          </Rows>
        </SheetSection>
        <SheetSection title={m.athletes.tests}>
          {file.tests.length === 0 ? (
            <p className="text-soft">Tes tests de force apparaîtront ici dès que ton coach les aura notés.</p>
          ) : null}
          <Rows>
            {file.tests.map((t) => (
              <li key={`${t.exerciseKey}-${t.date}`} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 leading-snug">
                  <span className="block font-semibold">{strengthTestLabel(t.exerciseKey)}</span>
                  <span className="t-caption block font-normal text-soft">
                    {m.testKind[t.kind]}, {date(t.date)}
                  </span>
                </span>
                <Mark>{String(t.value).replace(".", ",")} kg</Mark>
              </li>
            ))}
          </Rows>
        </SheetSection>
        {file.healthVisible ? (
          <SheetSection
            title={m.athletes.injuries}
            action={
              <InjuryDialog
                athleteId={file.id}
                trigger={
                  <Button size="sm" variant="secondary">
                    {m.common.add}
                  </Button>
                }
              />
            }
          >
            {file.injuries.length === 0 ? <p className="text-soft">{m.athletes.noInjuries}</p> : null}
            <Rows>
              {file.injuries.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0 flex-1 leading-snug">
                    <p className="flex flex-wrap items-center gap-x-2 font-semibold">
                      {m.bodyArea[i.bodyArea as keyof typeof m.bodyArea]}
                      <Chip tone={i.status === "resolved" ? "neutral" : "warning"}>{m.injuryStatus[i.status]}</Chip>
                    </p>
                    {i.restrictions ? <p className="mt-1">{i.restrictions}</p> : null}
                  </div>
                  <InjuryDialog
                    athleteId={file.id}
                    trigger={
                      <Button size="sm" variant="quiet">
                        {m.common.edit}
                      </Button>
                    }
                    initial={{
                      id: i.id,
                      bodyArea: i.bodyArea as keyof typeof m.bodyArea,
                      side: i.side,
                      description: i.description ?? "",
                      startDate: i.startDate,
                      endDate: i.endDate ?? "",
                      status: i.status,
                      restrictions: i.restrictions ?? "",
                    }}
                  />
                </li>
              ))}
            </Rows>
          </SheetSection>
        ) : null}
      </Sheet>
    </div>
  );
}
