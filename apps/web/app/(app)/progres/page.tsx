import { getMyRegularity } from "@/server/athlete-view.service";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDayMonth, m, strengthTestLabel } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Mark, Rows, Sheet, SheetSection } from "@/components/sheet";
import { Chip, EmptyState, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { InjuryDialog, PerformanceDialog, TestDialog } from "@/features/athletes/athlete-forms";
import { listExerciseIndex } from "@/server/exercise.service";
import { requireAthleteSpace } from "@/features/shell/space";
import { getMyFile } from "@/server/athlete.service";
import { ShareRecord } from "@/features/progress/share-record";
import { CalendarPhases } from "@/features/phases/calendar-phases";
import { todayIso } from "@/lib/dates";
import { addDays } from "@tartan/domain";

export const metadata: Metadata = { title: m.nav.progres };

const date = (iso: string) => `${formatDayMonth(iso)} ${iso.slice(0, 4)}`;

// Les courbes par exercice sont disponibles lorsque la progression est activée.
export default async function ProgresPage() {
  const ctx = await requireAthleteSpace();
  const { actor, organizationId, space, personal } = ctx;
  const source = personal && ctx.clubSpace.kind !== "personal" ? "?carnet=1" : "";
  const today = todayIso();
  const [file, regularity, exercises] = await Promise.all([
    getMyFile(actor.userId, organizationId),
    getMyRegularity(actor.userId, organizationId),
    // L'athlète autonome note lui-même ses tests : la bibliothèque de son espace sert au choix de l'exercice.
    personal ? listExerciseIndex(actor.userId, organizationId) : null,
  ]);
  const nothingYet = file.performances.length === 0 && file.tests.length === 0;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader
        title={m.nav.progres}
        actions={
          space.progressionEnabled ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link href={`/analyse${source}`}>{m.analysis.title}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/historique/${file.id}`}>{m.exerciseHistory.title}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/outils/charges${source}`}>{m.calculator.title}</Link>
              </Button>
            </div>
          ) : null
        }
      />
      {!personal && ctx.spaces.some((s) => s.kind === "personal") && (
        <Link href="/carnet/progres">{m.brand.notebook}</Link>
      )}
      {exercises ? (
        <section
          id="test-de-force"
          aria-labelledby="mesures-perso"
          className="on-card flex scroll-mt-24 flex-col gap-3 rounded-card bg-card p-4"
        >
          <div className="flex flex-col gap-1">
            <h2 id="mesures-perso" className="t-h2">
              {w.personal.progress.testTitle}
            </h2>
            <p className="max-w-prose text-soft">{w.personal.progress.testLead}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <TestDialog
              athleteId={file.id}
              exercises={exercises}
              progressionEnabled={space.progressionEnabled ?? true}
              label={w.personal.progress.addTest}
            />
            <PerformanceDialog athleteId={file.id} label={m.performances.add} />
          </div>
        </section>
      ) : null}
      <CalendarPhases ctx={ctx} from={today} to={addDays(today, 83)} today={today} open />
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
      {/* Ni record ni test : l'athlète de la rubrique attend la suite, au lieu de deux phrases vides. */}
      {nothingYet ? (
        <EmptyState
          rubric="progres"
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/calendrier">{w.progress.emptyAction}</Link>
            </Button>
          }
        >
          {w.progress.empty}
        </EmptyState>
      ) : null}
      {nothingYet && !file.healthVisible ? null : (
        <Sheet className="divide-y divide-card-line">
          {nothingYet ? null : (
            <SheetSection title={m.performances.title}>
              {file.performances.length === 0 ? <p className="text-soft">{w.progress.noRecords}</p> : null}
              <Rows>
                {file.performances.map((p) => (
                  <li
                    key={`${p.discipline}-${p.date}-${p.mark}`}
                    className="flex items-center justify-between gap-3 py-2"
                  >
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
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Mark>
                        {String(p.mark).replace(".", ",")} {p.unit}
                      </Mark>
                      {p.isPb && !p.isBaseline ? (
                        <ShareRecord
                          discipline={p.discipline}
                          href={`/api/v1/orgs/${organizationId}/athletes/${file.id}/performances/${p.id}/carte`}
                        />
                      ) : null}
                    </span>
                  </li>
                ))}
              </Rows>
            </SheetSection>
          )}
          {nothingYet ? null : (
            <SheetSection title={m.athletes.tests}>
              {file.tests.length === 0 ? <p className="text-soft">{w.progress.noTests}</p> : null}
              <Rows>
                {file.tests.map((t) => (
                  <li key={`${t.exerciseKey}-${t.date}`} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 leading-snug">
                      <span className="block font-semibold">{strengthTestLabel(t.exerciseKey)}</span>
                      <span className="t-caption block font-normal text-soft">
                        {m.testKind[t.kind]}, {date(t.date)}
                      </span>
                    </span>
                    <Mark>{w.progress.kilos(String(t.value).replace(".", ","))}</Mark>
                  </li>
                ))}
              </Rows>
            </SheetSection>
          )}
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
      )}
    </div>
  );
}
