"use client";

import { markInstallOpportunity } from "@/features/shell/install-opportunity";

import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useSpaceId } from "@/features/offline/offline-provider";
import { submitOp } from "@/features/offline/op-queue";
import { RosterMore, RosterSearch, useRoster } from "./roster";
import { generateAutonomousAction, remindAction } from "./tracking.action";

export type AttendanceRow = { athleteId: string; name: string; attendance: "present" | "absent" | "unknown" };

// Au-delà d'une douzaine d'athlètes, on retrouve quelqu'un par son nom, comme dans la grille du suivi.
export const SEARCH_FROM = 12;
const nameOf = (row: AttendanceRow) => row.name;

// L'appel d'un grand groupe se fait par tranches de trente, ou par nom : la présence de chacun reste gardée
// pendant la recherche, et l'enregistrement porte sur tout le groupe.
export const RollCall = ({
  sessionId,
  rows,
  hasAutonomous,
}: {
  sessionId: string;
  rows: AttendanceRow[];
  hasAutonomous: boolean;
}) => {
  const router = useRouter();
  // Pas de présence présumée : un appel distrait ne doit rien enregistrer de faux.
  const [state, setState] = useState<Record<string, "present" | "absent" | undefined>>(() =>
    Object.fromEntries(rows.map((r) => [r.athleteId, r.attendance === "unknown" ? undefined : r.attendance])),
  );
  const roster = useRoster(rows, nameOf);
  const generate = useAction(generateAutonomousAction, {
    onSuccess: () => toast.ok(w.tracking.autonomousGenerated),
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  const organizationId = useSpaceId();
  const [saving, setSaving] = useState(false);
  // L'appel se fait au bord de la piste : il part au retour du réseau s'il le faut.
  const save = async () => {
    setSaving(true);
    const res = await submitOp({
      id: crypto.randomUUID(),
      kind: "rollCall",
      target: sessionId,
      path: `/orgs/${organizationId}/sessions/${sessionId}/roll-call`,
      body: {
        entries: rows.flatMap((r) => {
          const status = state[r.athleteId];
          return status ? [{ athleteId: r.athleteId, status }] : [];
        }),
      },
    });
    setSaving(false);
    if (res.state === "error") return toast.error(res.message);
    markInstallOpportunity();
    if (res.state === "queued") return toast.ok(m.offline.rollCallQueued);
    const data = res.data as { hasAutonomous: boolean; absentCount: number } | null;
    if (data) toast.ok(m.coach.rollCallDone(data.hasAutonomous ? data.absentCount : 0));
    router.refresh();
  };
  const absent = Object.values(state).filter((v) => v === "absent").length;
  return (
    <section aria-labelledby="appel" className="rounded-card on-card bg-card p-4">
      <h2 id="appel" className="t-h2 mb-1">
        {m.coach.rollCall}
      </h2>
      {rows.length > SEARCH_FROM ? (
        <RosterSearch roster={roster} total={rows.length} label={w.tracking.rollCallSearch} className="mb-2" />
      ) : null}
      <ul className="divide-y divide-card-line">
        {roster.visible.map((row) => (
          <li key={row.athleteId} className="flex items-center justify-between gap-3 py-1.5">
            <span className="min-w-0 break-words font-semibold leading-snug">{row.name}</span>
            <div role="group" aria-label={w.tracking.attendanceOf(row.name)} className="flex gap-1">
              {(["present", "absent"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={state[row.athleteId] === value}
                  onClick={() => setState({ ...state, [row.athleteId]: value })}
                  className={cn(
                    "min-h-11 rounded-full px-3 text-[14px] transition-colors",
                    state[row.athleteId] === value
                      ? "bg-accent font-semibold text-on-accent"
                      : "border border-card-line bg-card-raised hover:bg-card-line",
                  )}
                >
                  {value === "present" ? w.tracking.present : w.tracking.absent}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <RosterMore roster={roster} />
      {absent > 0 && !hasAutonomous ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-thumb bg-card-raised p-3">
          <p className="flex-1 text-st-partial">{m.coach.noAutonomous}</p>
          <Button
            size="sm"
            variant="secondary"
            disabled={generate.isPending}
            onClick={() => generate.execute({ sessionId })}
          >
            {m.coach.generateAutonomous}
          </Button>
        </div>
      ) : null}
      <Button className="mt-3" size="sm" disabled={saving || !Object.values(state).some(Boolean)} onClick={save}>
        {m.coach.rollCallSave}
      </Button>
    </section>
  );
};

export const RemindButton = ({
  sessionId,
  athleteIds,
  label,
}: {
  sessionId: string;
  athleteIds?: string[];
  label: string;
}) => {
  const { execute, isPending } = useAction(remindAction, {
    onSuccess: ({ data }) => (data?.count ? toast.ok(m.coach.reminded(data.count)) : toast.ok(m.coach.nobodyToRemind)),
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  return (
    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => execute({ sessionId, athleteIds })}>
      {label}
    </Button>
  );
};
