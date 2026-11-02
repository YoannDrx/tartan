import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ageAt, formatHeight } from "@tartan/domain";
import { formatDayMonth, m, strengthTestLabel } from "@tartan/i18n";
import { BarSheet } from "@/components/bar-sheet";
import { Mark, Rows, Sheet, SheetSection } from "@/components/sheet";
import { Chip, PageHeader } from "@/components/states";
import { StatusIcon } from "@/components/status-cell";
import { Button } from "@/components/ui/button";
import {
  AthleteDialog,
  InjuryDialog,
  InviteAthleteDialog,
  NoteForm,
  PerformanceDialog,
  TestDialog,
} from "@/features/athletes/athlete-forms";
import { RemoveAthlete } from "@/features/athletes/remove-athlete";
import { orNotFound, requireStaffSpace } from "@/features/shell/space";
import { requireOrgMember } from "@/server/access";
import { getAthleteFile } from "@/server/athlete.service";
import { listGroups } from "@/server/org.service";
import { athleteWeeklyStats } from "@/server/stats.service";
import { getBarSheet, listVideos } from "@/server/video.service";

export const metadata: Metadata = { title: "Fiche athlète" };

const year = (iso: string) => `${formatDayMonth(iso)} ${iso.slice(0, 4)}`;

export default async function AthleteFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, organizationId } = await requireStaffSpace();
  const { id } = await params;
  const file = await orNotFound(() => getAthleteFile(actor.userId, organizationId, id));
  const access = await requireOrgMember(actor.userId, organizationId, "viewTracking");
  const [groups, videos, sheet, stats] = await Promise.all([
    listGroups(access),
    listVideos(actor.userId, organizationId, { athleteId: id }),
    getBarSheet(actor.userId, organizationId, { athleteId: id }),
    athleteWeeklyStats(actor.userId, organizationId, id),
  ]);
  const activeWeeks = stats.weeks.filter((w) => w.sessions > 0).reverse();
  const activeInjury = file.injuries.find((i) => i.status !== "resolved");
  const canManage = access.role !== "assistant";
  const past = file.history.filter((h) => h.status !== "skipped");
  const score = past.reduce((n, h) => n + (h.status === "done" ? 1 : h.status === "partial" ? 0.5 : 0), 0);
  const rate = past.length ? Math.round((score / past.length) * 100) : null;
  const best = sheet.bestCm;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${file.firstName} ${file.lastName}`}
        detail={[
          file.birthDate ? `${ageAt(file.birthDate, new Date())} ans` : null,
          file.level,
          file.groups.map((g) => g.name).join(", "),
        ]
          .filter(Boolean)
          .join(", ")}
        actions={
          canManage ? (
            <>
              {!file.hasAccount ? (
                <InviteAthleteDialog athleteId={file.id} groupIds={file.groups.map((g) => g.id)} />
              ) : null}
              <AthleteDialog
                trigger={
                  <Button size="sm" variant="secondary">
                    {m.common.edit}
                  </Button>
                }
                groups={groups}
                title={m.common.edit}
                initial={{
                  id: file.id,
                  firstName: file.firstName,
                  lastName: file.lastName,
                  birthDate: file.birthDate,
                  level: file.level,
                  takeoffFoot: file.takeoffFoot,
                  approachSteps: file.approachSteps,
                  goals: file.goals,
                  particularities: file.particularities,
                  groupIds: file.groups.map((g) => g.id),
                }}
              />
              <RemoveAthlete id={file.id} name={file.firstName} />
            </>
          ) : null
        }
      />

      {activeInjury ? (
        <p role="status" className="on-card flex items-center gap-3 rounded-card bg-card p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-thumb bg-st-missed text-on-status">
            <TriangleAlert aria-hidden className="size-5" />
          </span>
          <span className="font-semibold">
            {m.coach.activeInjury} : {m.bodyArea[activeInjury.bodyArea as keyof typeof m.bodyArea]}
            {activeInjury.side !== "none" ? ` ${m.bodySide[activeInjury.side].toLowerCase()}` : ""}
            {activeInjury.restrictions ? `. ${activeInjury.restrictions}` : ""}
          </span>
        </p>
      ) : null}

      <Sheet>
        <dl className="grid grid-cols-2 gap-px bg-card-line tablet:grid-cols-4">
          {[
            { label: m.athletes.takeoffFoot, value: file.takeoffFoot ? m.bodySide[file.takeoffFoot] : null },
            { label: m.athletes.approachSteps, value: file.approachSteps },
            { label: m.athletes.bestBar, value: best ? `${formatHeight(best)} m` : null },
            { label: m.athletes.doneRate, value: rate !== null ? `${rate}\u00a0%` : null },
          ].map((item) => (
            <div key={item.label} className="bg-card px-4 py-2">
              <dt className="t-caption font-normal text-soft">{item.label}</dt>
              <dd className={item.value === null ? "leading-7 text-soft" : "t-num text-[24px] leading-7"}>
                {item.value ?? m.athletes.notSet}
              </dd>
            </div>
          ))}
        </dl>

        {sheet.rows.length > 0 ? (
          <SheetSection
            className="border-t border-card-line"
            title={m.video.barSheet}
            action={
              videos.length > 0 ? (
                <Link href={`/videos?athlete=${file.id}`} className="inline-flex min-h-11 items-center">
                  {m.athletes.allVideos(videos.length)}
                </Link>
              ) : null
            }
          >
            <BarSheet rows={sheet.rows} current={best} />
          </SheetSection>
        ) : null}

        {activeWeeks.length > 0 ? (
          <SheetSection
            className="border-t border-card-line"
            title={m.athletes.load}
            aside={
              stats.loadTrendPct !== null ? (
                <span className="t-caption font-normal text-soft">{m.athletes.loadTrend(stats.loadTrendPct)}</span>
              ) : null
            }
          >
            <Rows>
              {activeWeeks.map((week) => (
                <li key={week.weekStart} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
                  <span>{m.athletes.weekOf(formatDayMonth(week.weekStart))}</span>
                  <span className="text-soft">{m.athletes.loadSessions(week.done, week.sessions)}</span>
                  {week.load !== null ? <span className="t-num">{m.athletes.loadValue(week.load)}</span> : null}
                </li>
              ))}
            </Rows>
            {stats.healthVisible ? <p className="t-caption mt-1 font-normal text-soft">{m.athletes.loadHint}</p> : null}
          </SheetSection>
        ) : null}

        <div className="grid border-t border-card-line desktop:grid-cols-2 desktop:divide-x desktop:divide-card-line">
          <div className="divide-y divide-card-line">
            <SheetSection
              title={m.athletes.records}
              action={canManage ? <PerformanceDialog athleteId={file.id} /> : null}
            >
              {file.performances.length === 0 ? <p className="text-soft">{m.athletes.noRecords}</p> : null}
              <Rows>
                {file.performances.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 leading-snug">
                      <span className="flex flex-wrap items-center gap-x-2 font-semibold">
                        {p.discipline}
                        {p.isPb ? <Chip tone="brand">{m.athletes.record}</Chip> : null}
                      </span>
                      <span className="t-caption block font-normal text-soft">
                        {[year(p.date), p.location].filter(Boolean).join(", ")}
                      </span>
                    </span>
                    <Mark>
                      {String(p.mark).replace(".", ",")} {p.unit}
                    </Mark>
                  </li>
                ))}
              </Rows>
            </SheetSection>

            <SheetSection title={m.athletes.tests} action={canManage ? <TestDialog athleteId={file.id} /> : null}>
              {file.tests.length === 0 ? <p className="text-soft">{m.athletes.noTests}</p> : null}
              <Rows>
                {file.tests.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 leading-snug">
                      <span className="block font-semibold">{strengthTestLabel(t.exerciseKey)}</span>
                      <span className="t-caption block font-normal text-soft">
                        {m.testKind[t.kind]}, {year(t.date)}
                      </span>
                    </span>
                    <Mark>{String(t.value).replace(".", ",")} kg</Mark>
                  </li>
                ))}
              </Rows>
            </SheetSection>

            <SheetSection
              title={m.athletes.injuries}
              action={
                file.healthVisible && file.canEditInjuries ? (
                  <InjuryDialog
                    athleteId={file.id}
                    trigger={
                      <Button size="sm" variant="secondary">
                        {m.common.add}
                      </Button>
                    }
                  />
                ) : null
              }
            >
              {!file.healthVisible ? <p className="text-soft">{m.athletes.healthHidden}</p> : null}
              {file.healthVisible && file.injuries.length === 0 ? (
                <p className="text-soft">{m.athletes.noInjuries}</p>
              ) : null}
              <Rows>
                {file.injuries.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0 flex-1 leading-snug">
                      <p className="flex flex-wrap items-center gap-x-2 font-semibold">
                        {m.bodyArea[i.bodyArea as keyof typeof m.bodyArea]}
                        {i.side !== "none" ? ` ${m.bodySide[i.side].toLowerCase()}` : ""}
                        <Chip tone={i.status === "resolved" ? "neutral" : "warning"}>{m.injuryStatus[i.status]}</Chip>
                      </p>
                      <p className="t-caption font-normal text-soft">
                        Depuis le {year(i.startDate)}
                        {i.endDate ? `, jusqu'au ${year(i.endDate)}` : ""}
                      </p>
                      {i.restrictions ? <p className="mt-1">{i.restrictions}</p> : null}
                    </div>
                    {file.canEditInjuries ? (
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
                    ) : null}
                  </li>
                ))}
              </Rows>
            </SheetSection>

            <SheetSection title={m.athletes.profile}>
              <dl className="grid gap-y-2 tablet:grid-cols-[auto_1fr] tablet:gap-x-4">
                <dt className="text-soft">{m.athletes.goals}</dt>
                <dd className="whitespace-pre-line break-words">{file.goals ?? m.athletes.notSet}</dd>
                <dt className="text-soft">{m.athletes.particularities}</dt>
                <dd className="whitespace-pre-line break-words">{file.particularities ?? m.athletes.notSet}</dd>
              </dl>
            </SheetSection>
          </div>

          <div className="divide-y divide-card-line max-desktop:border-t max-desktop:border-card-line">
            <SheetSection title={m.athletes.history} flush>
              {file.history.length === 0 ? <p className="px-4 pb-2 text-soft">{m.athletes.noHistory}</p> : null}
              <Rows>
                {file.history.map((h) => (
                  <li key={h.id}>
                    <Link
                      href={`/seances/${h.sessionId}/suivi`}
                      className="grid min-h-11 grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-1 text-inherit no-underline hover:bg-raise"
                    >
                      <StatusIcon status={h.status === "done" || h.status === "partial" ? h.status : "missed"} />
                      <span className="flex min-w-0 flex-col leading-snug">
                        <span className="truncate font-semibold">{h.title}</span>
                        <span className="t-caption font-normal text-soft">{year(h.date)}</span>
                      </span>
                      {h.rpe ? (
                        <span className="t-num text-[17px]">
                          <span className="sr-only">Effort </span>
                          {h.rpe}/10
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </Rows>
            </SheetSection>

            {file.canWriteNotes ? (
              <SheetSection title={m.athletes.notes}>
                <NoteForm athleteId={file.id} />
                {file.notes.length > 0 ? (
                  <Rows className="mt-3">
                    {file.notes.map((n) => (
                      <li key={n.id} className="py-2">
                        <p className="whitespace-pre-line break-words">{n.body}</p>
                        <p className="t-caption font-normal text-soft">
                          {n.authorName}, {year(n.createdAt.slice(0, 10))}
                        </p>
                      </li>
                    ))}
                  </Rows>
                ) : null}
              </SheetSection>
            ) : null}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
