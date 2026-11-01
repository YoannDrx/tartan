import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ageAt, formatHeight } from "@tartan/domain";
import { formatDayMonth, m, strengthTestLabel } from "@tartan/i18n";
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
import { orNotFound, requireStaffSpace } from "@/features/shell/space";
import { requireOrgMember } from "@/server/access";
import { getAthleteFile } from "@/server/athlete.service";
import { listGroups } from "@/server/org.service";
import { getBarSheet, listVideos } from "@/server/video.service";

export const metadata: Metadata = { title: "Fiche athlète" };

const year = (iso: string) => `${formatDayMonth(iso)} ${iso.slice(0, 4)}`;

export default async function AthleteFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, organizationId } = await requireStaffSpace();
  const { id } = await params;
  const file = await orNotFound(() => getAthleteFile(actor.userId, organizationId, id));
  const access = await requireOrgMember(actor.userId, organizationId, "viewTracking");
  const [groups, videos, sheet] = await Promise.all([
    listGroups(access),
    listVideos(actor.userId, organizationId, { athleteId: id }),
    getBarSheet(actor.userId, organizationId, { athleteId: id }),
  ]);
  const activeInjury = file.injuries.find((i) => i.status !== "resolved");
  const canManage = access.role !== "assistant";
  const past = file.history.filter((h) => h.status !== "skipped");
  const score = past.reduce((n, h) => n + (h.status === "done" ? 1 : h.status === "partial" ? 0.5 : 0), 0);
  const rate = past.length ? Math.round((score / past.length) * 100) : null;
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
            </>
          ) : null
        }
      />

      {activeInjury ? (
        <p role="status" className="flex items-center gap-3 rounded-card bg-brand-tint p-3 text-brand-strong">
          <TriangleAlert aria-hidden className="size-5 shrink-0" />
          <span className="font-semibold">
            {m.coach.activeInjury} : {m.bodyArea[activeInjury.bodyArea as keyof typeof m.bodyArea]}
            {activeInjury.side !== "none" ? ` ${m.bodySide[activeInjury.side].toLowerCase()}` : ""}
            {activeInjury.restrictions ? `. ${activeInjury.restrictions}` : ""}
          </span>
        </p>
      ) : null}

      <div className="grid items-start gap-4 desktop:grid-cols-2">
        <section className="rounded-block border border-border bg-surface p-4">
          <h2 className="t-h2 mb-2">{m.athletes.profile}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-muted">{m.athletes.takeoffFoot}</dt>
            <dd>{file.takeoffFoot ? m.bodySide[file.takeoffFoot] : "Non renseigné"}</dd>
            <dt className="text-muted">{m.athletes.approachSteps}</dt>
            <dd className="t-num">{file.approachSteps ?? "Non renseigné"}</dd>
            <dt className="text-muted">{m.athletes.goals}</dt>
            <dd className="whitespace-pre-line">{file.goals ?? "Non renseigné"}</dd>
            <dt className="text-muted">{m.athletes.particularities}</dt>
            <dd className="whitespace-pre-line">{file.particularities ?? "Non renseigné"}</dd>
          </dl>
        </section>

        <section className="rounded-block border border-border bg-surface p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="t-h2">{m.athletes.tests}</h2>
            {canManage ? <TestDialog athleteId={file.id} /> : null}
          </div>
          {file.tests.length === 0 ? (
            <p className="text-muted">Aucun test. Sans test, les charges en % du max ne peuvent pas être calculées.</p>
          ) : null}
          <ul className="divide-y divide-border">
            {file.tests.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-3 py-2">
                <span>
                  {strengthTestLabel(t.exerciseKey)}{" "}
                  <span className="t-caption font-normal text-muted">
                    {m.testKind[t.kind]}, {year(t.date)}
                  </span>
                </span>
                <span className="t-num text-[22px]">{String(t.value).replace(".", ",")} kg</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-block border border-border bg-surface p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="t-h2">{m.athletes.records}</h2>
            {canManage ? <PerformanceDialog athleteId={file.id} /> : null}
          </div>
          {file.performances.length === 0 ? <p className="text-muted">Aucun record enregistré.</p> : null}
          <ul className="divide-y divide-border">
            {file.performances.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3 py-2">
                <span>
                  {p.discipline}{" "}
                  <span className="t-caption font-normal text-muted">
                    {[year(p.date), p.location].filter(Boolean).join(", ")}
                  </span>
                  {p.isPb ? (
                    <span className="ml-2">
                      <Chip tone="brand">Record</Chip>
                    </span>
                  ) : null}
                </span>
                <span className="t-num text-[22px]">
                  {String(p.mark).replace(".", ",")} {p.unit}
                </span>
              </li>
            ))}
          </ul>
          {sheet.rows.length > 0 ? (
            <div className="mt-4">
              <h3 className="t-section mb-2">{m.video.barSheet}</h3>
              <ul className="flex flex-wrap gap-1.5">
                {sheet.rows.map((r) => (
                  <li key={r.heightCm} className="flex min-w-14 flex-col items-center rounded-thumb bg-bg px-2 py-1">
                    <span className="t-num text-[17px]">{formatHeight(r.heightCm)}</span>
                    <span className="t-caption text-muted">{r.notation}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="rounded-block border border-border bg-surface p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="t-h2">{m.athletes.injuries}</h2>
            {file.healthVisible && file.canEditInjuries ? (
              <InjuryDialog
                athleteId={file.id}
                trigger={
                  <Button size="sm" variant="secondary">
                    {m.common.add}
                  </Button>
                }
              />
            ) : null}
          </div>
          {!file.healthVisible ? <p className="text-muted">{m.athletes.healthHidden}</p> : null}
          {file.healthVisible && file.injuries.length === 0 ? (
            <p className="text-muted">Aucune blessure enregistrée.</p>
          ) : null}
          <ul className="divide-y divide-border">
            {file.injuries.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {m.bodyArea[i.bodyArea as keyof typeof m.bodyArea]}
                    {i.side !== "none" ? ` ${m.bodySide[i.side].toLowerCase()}` : ""}{" "}
                    <Chip tone={i.status === "resolved" ? "neutral" : "warning"}>{m.injuryStatus[i.status]}</Chip>
                  </p>
                  <p className="t-caption font-normal text-muted">
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
          </ul>
        </section>

        <section className="rounded-block border border-border bg-surface p-4">
          <h2 className="t-h2 mb-2">
            {m.athletes.history}
            {rate !== null ? <span className="t-num ml-2 text-[18px] text-muted">{rate} % réalisé</span> : null}
          </h2>
          {file.history.length === 0 ? <p className="text-muted">Aucune séance réalisée pour l'instant.</p> : null}
          <ul className="divide-y divide-border">
            {file.history.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/seances/${h.sessionId}/suivi`}
                  className="flex min-h-11 items-center gap-3 py-1 text-ink no-underline hover:bg-bg"
                >
                  <StatusIcon status={h.status === "done" || h.status === "partial" ? h.status : "missed"} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{h.title}</span>
                    <span className="t-caption font-normal text-muted">
                      {year(h.date)}
                      {h.rpe ? `, effort ${h.rpe}/10` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {videos.length > 0 ? (
            <p className="mt-3">
              <Link href={`/videos?athlete=${file.id}`}>Voir ses {videos.length} vidéos</Link>
            </p>
          ) : null}
        </section>

        {file.canWriteNotes ? (
          <section className="rounded-block border border-border bg-surface p-4">
            <h2 className="t-h2 mb-2">{m.athletes.notes}</h2>
            <NoteForm athleteId={file.id} />
            <ul className="mt-3 divide-y divide-border">
              {file.notes.map((n) => (
                <li key={n.id} className="py-2">
                  <p className="whitespace-pre-line">{n.body}</p>
                  <p className="t-caption font-normal text-muted">
                    {n.authorName}, {year(n.createdAt.slice(0, 10))}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
