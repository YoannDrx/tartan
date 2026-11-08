"use client";

import Link from "next/link";
import type { PerformedSetDraftRow, PreviousExerciseSets, ResolvedItem } from "@tartan/contracts";
import { previousSetsForItem } from "@tartan/domain";
import { historyDate, m, realizedSetLabel } from "@tartan/i18n";

export function PreviousSets({
  item,
  rows,
  previous,
  athleteId,
}: {
  item: ResolvedItem;
  rows: PerformedSetDraftRow[];
  previous?: PreviousExerciseSets[];
  athleteId?: string;
}) {
  if (!previous || !item.exerciseId || !athleteId) return null;
  const groups = previousSetsForItem(item, rows, previous);
  return (
    <aside className="mb-4 flex flex-col gap-2 border-b border-card-line pb-4">
      <h3 className="font-semibold">{m.exerciseHistory.lastTime}</h3>
      <p className="t-caption text-soft font-normal">{m.exerciseHistory.lastTimeHint}</p>
      {!groups.length ? (
        <p className="text-soft">{m.exerciseHistory.noComparable}</p>
      ) : (
        groups.map((group, index) => (
          <div key={`${group.sessionId}:${index}`} className="flex flex-col gap-2">
            <p className="font-semibold">{m.exerciseHistory.previousOn(historyDate(group.date), group.startTime)}</p>
            <ul className="space-y-1">
              {group.sets.slice(0, 3).map((set) => (
                <li key={`${set.itemRef}:${set.setIndex}`}>{realizedSetLabel(set, group.convention)}</li>
              ))}
            </ul>
            {group.sets.length > 3 ? (
              <details>
                <summary className="min-h-11 cursor-pointer py-3">{m.exerciseHistory.moreSets}</summary>
                <ul className="space-y-1">
                  {group.sets.slice(3).map((set) => (
                    <li key={`${set.itemRef}:${set.setIndex}`}>{realizedSetLabel(set, group.convention)}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            {group.totalSets > group.sets.length ? (
              <p className="text-soft">{m.exerciseHistory.limitedSets(group.sets.length, group.totalSets)}</p>
            ) : null}
            <Link
              className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
              href={`/historique/${athleteId}?${new URLSearchParams({ exercise: item.exerciseId!, days: "365", to: group.date })}`}
            >
              {m.exerciseHistory.openExercise}
            </Link>
          </div>
        ))
      )}
    </aside>
  );
}
