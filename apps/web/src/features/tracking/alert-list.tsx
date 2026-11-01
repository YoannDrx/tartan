"use client";

import { ChevronRight, Clock, Gauge, Stethoscope, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { CoachAlert } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { cn } from "@/lib/cn";

const icons = { pain: TriangleAlert, missed_streak: Clock, abnormal_rpe: Gauge, active_injury: Stethoscope };

const VISIBLE_ON_PHONE = 2;

// Une ligne par athlète, le motif le plus grave en titre : le coach lit vite, sans doublons.
const groupByAthlete = (alerts: CoachAlert[]) => {
  const groups = new Map<string, CoachAlert[]>();
  for (const alert of alerts) groups.set(alert.athleteId, [...(groups.get(alert.athleteId) ?? []), alert]);
  return [...groups.values()].flatMap((list) => {
    const [first, ...others] = list;
    if (!first) return [];
    const detail = [first.detail, ...others.map((o) => m.coach.alertKind[o.kind])].filter(Boolean).join(", ");
    return [{ ...first, detail }];
  });
};

export const AlertList = ({ alerts }: { alerts: CoachAlert[] }) => {
  const [expanded, setExpanded] = useState(false);
  const rows = groupByAthlete(alerts);
  const hidden = rows.length - VISIBLE_ON_PHONE;
  return (
    <div className="rounded-block border border-border bg-surface">
      <ul className="divide-y divide-border">
        {rows.map((alert, index) => {
          const Icon = icons[alert.kind];
          return (
            <li key={alert.id} className={cn(!expanded && index >= VISIBLE_ON_PHONE && "max-desktop:hidden")}>
              <Link
                href={`/athletes/${alert.athleteId}`}
                className="flex min-h-11 items-center gap-3 p-2.5 text-ink no-underline hover:bg-bg"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-thumb",
                    alert.severity === "high"
                      ? "bg-brand-tint text-brand-strong"
                      : "bg-warning-tint text-warning-strong",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{alert.title}</span>
                  {alert.detail ? <span className="t-caption font-normal text-muted">{alert.detail}</span> : null}
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="min-h-11 w-full border-t border-border text-brand-strong underline desktop:hidden"
        >
          {m.coach.allAlerts(rows.length)}
        </button>
      ) : null}
    </div>
  );
};
