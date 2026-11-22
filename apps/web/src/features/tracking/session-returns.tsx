"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Sheet } from "@/components/sheet";
import { Chip } from "@/components/states";
import { StatusIcon } from "@/components/status-cell";
import { Button } from "@/components/ui/button";
import { withSessionReturn } from "@/lib/session-navigation";
import type { getSessionDetailForCoach } from "@/server/tracking.service";
import { CoachLog } from "./coach-log";
import { RosterMore, RosterSearch, useLinkedRow, useRoster } from "./roster";
import { RemindButton, SEARCH_FROM } from "./session-followup";

export type SessionAthlete = Awaited<ReturnType<typeof getSessionDetailForCoach>>["athletes"][number];

const STATUSES = ["done", "partial", "missed", "upcoming", "no_return"] as const;

const painLabel = (pain: { bodyArea: string; side: string; intensity: number }) => {
  const area = m.bodyArea[pain.bodyArea as keyof typeof m.bodyArea] ?? pain.bodyArea;
  const side = pain.side === "none" ? "" : ` ${m.bodySide[pain.side as keyof typeof m.bodySide].toLowerCase()}`;
  return w.tracking.pain(`${area}${side}`, pain.intensity);
};

const idOf = (athlete: SessionAthlete) => athlete.athleteId;
const nameOf = (athlete: SessionAthlete) => athlete.name;

// Les retours des athlètes d'une séance. Un grand groupe se lit par tranches de trente : le compte par état porte
// sur tout le groupe, la recherche retrouve un nom, et un lien vers un athlète précis l'ouvre où qu'il soit.
export const SessionReturns = ({
  sessionId,
  athletes,
  canEdit,
  progressionEnabled,
  returnTo,
}: {
  sessionId: string;
  athletes: SessionAthlete[];
  canEdit: boolean;
  progressionEnabled: boolean;
  returnTo?: string;
}) => {
  const roster = useRoster(athletes, nameOf);
  useLinkedRow(roster, athletes, idOf);
  return (
    <Sheet>
      <section aria-label={m.coach.athleteReturns}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-card-line bg-card-raised px-4 py-2">
          {STATUSES.map((status) => {
            const count = athletes.filter((a) => a.status === status).length;
            return count > 0 ? (
              <span key={status} className="flex items-center gap-1.5">
                <StatusIcon status={status} size={18} />
                <span className="t-num text-[17px] leading-5">{count}</span>
                <span className="t-caption font-normal text-soft">{m.status[status]}</span>
              </span>
            ) : null;
          })}
        </div>
        {athletes.length > SEARCH_FROM ? (
          <RosterSearch roster={roster} total={athletes.length} className="border-b border-card-line p-3" />
        ) : null}
        <ul className="divide-y divide-card-line">
          {roster.visible.map((a) => (
            <li
              key={a.athleteId}
              id={a.athleteId}
              className="grid scroll-mt-20 grid-cols-[26px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-4 py-2"
            >
              <StatusIcon status={a.status} className="mt-px" />
              <div className="min-w-0 leading-snug">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {/* La cible du nom fait 44 px de haut sans écarter les lignes : la marge négative rend la place. */}
                  <Link
                    href={`/athletes/${a.athleteId}`}
                    className="-my-3 break-words py-3 font-semibold text-inherit no-underline hover:underline"
                  >
                    {a.name}
                  </Link>
                  {a.variant ? <Chip>{m.variant[a.variant]}</Chip> : null}
                  {a.attendance === "absent" ? (
                    <Chip tone="warning">
                      {a.absenceReason
                        ? m.coach.absentBecause(m.today.absenceReasons[a.absenceReason])
                        : m.coach.absent}
                    </Chip>
                  ) : null}
                </p>
                {a.rpe || a.durationMin ? (
                  <p className="t-num mt-0.5 text-[17px] leading-5">
                    {[a.rpe ? w.tracking.effort(a.rpe) : null, a.durationMin ? w.tracking.minutes(a.durationMin) : null]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                ) : null}
                {a.pain ? (
                  <p className="mt-1 flex items-center gap-1.5 font-semibold text-st-missed">
                    <TriangleAlert aria-hidden className="size-4 shrink-0" />
                    {painLabel(a.pain)}
                  </p>
                ) : null}
                {a.comment ? <p className="mt-1 break-words">{a.comment}</p> : null}
                {!a.hasAccount && a.status !== "done" && canEdit ? (
                  <div className="mt-2">
                    <CoachLog sessionId={sessionId} athleteId={a.athleteId} />
                  </div>
                ) : null}
                {progressionEnabled && canEdit ? (
                  <Button asChild variant="secondary" size="sm" className="mt-2">
                    <Link
                      href={withSessionReturn(`/seances/${sessionId}/athletes/${a.athleteId}/series`, returnTo)}
                      aria-label={`${m.progression.coachSetsTitle} · ${a.name}`}
                    >
                      {m.progression.coachSetsTitle}
                    </Link>
                  </Button>
                ) : null}
                {a.sets.length > 0 ? (
                  <p className="t-caption mt-1 font-normal text-soft">
                    {w.tracking.setsChecked(a.sets.filter((s) => s.done).length)}
                    {a.sets.some((s) => s.loadKg)
                      ? w.tracking.realLoads([
                          ...new Set(a.sets.filter((s) => s.loadKg).map((s) => String(s.loadKg).replace(".", ","))),
                        ])
                      : ""}
                  </p>
                ) : null}
              </div>
              {a.status === "missed" || a.status === "upcoming" ? (
                <RemindButton sessionId={sessionId} athleteIds={[a.athleteId]} label={m.coach.remind} />
              ) : (
                <span />
              )}
            </li>
          ))}
        </ul>
        <RosterMore roster={roster} />
      </section>
    </Sheet>
  );
};
