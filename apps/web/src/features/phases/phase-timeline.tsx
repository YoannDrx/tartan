import type { TrainingPhaseSummary } from "@tartan/contracts";
import { trainingPhaseBand, trainingPhaseProgress } from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import type { ReactNode } from "react";

export function PhaseTimeline({
  phases,
  from,
  to,
  today,
  actions,
}: {
  phases: TrainingPhaseSummary[];
  from: string;
  to: string;
  today: string;
  actions?: (phase: TrainingPhaseSummary) => ReactNode;
}) {
  const t = m.trainingPhases;
  if (!phases.length) return <p className="py-4 text-soft">{t.noPhase}</p>;
  return (
    <section aria-label={t.timeline}>
      <div
        aria-hidden="true"
        className="flex justify-between gap-3 border-b border-card-line pb-2 text-sm tabular-nums"
      >
        <span>{historyDate(from)}</span>
        <span>{historyDate(to)}</span>
      </div>
      <ul className="divide-y divide-card-line">
        {phases.map((phase) => {
          const band = trainingPhaseBand(phase, { startDate: from, endDate: to });
          const progress = trainingPhaseProgress(phase, today);
          return (
            <li key={phase.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="t-section break-words">{phase.name}</h2>
                  <p className="break-words text-soft">
                    {phase.targetName} · {t.kinds[phase.kind]}
                  </p>
                </div>
                <span className="rounded-full border border-card-line px-3 py-1 text-sm">
                  {phase.shared ? t.shared : t.draft}
                </span>
              </div>
              <p className="mt-2 tabular-nums">
                <time dateTime={phase.startDate}>{historyDate(phase.startDate)}</time> –{" "}
                <time dateTime={phase.endDate}>{historyDate(phase.endDate)}</time>
              </p>
              {band ? (
                <div aria-hidden="true" className="my-2 h-2 overflow-hidden rounded-full bg-card-raised">
                  <div
                    className={phase.shared ? "h-full rounded-full bg-brand" : "h-full rounded-full bg-fg-muted"}
                    style={{ marginLeft: `${band.offset * 100}%`, width: `${band.width * 100}%` }}
                  />
                </div>
              ) : null}
              {progress ? <p className="font-semibold">{t.week(progress.week, progress.weeks)}</p> : null}
              {phase.objective ? <p className="mt-2 break-words font-semibold">{phase.objective}</p> : null}
              {phase.description ? <p className="mt-2 whitespace-pre-wrap break-words">{phase.description}</p> : null}
              {phase.privateNote ? (
                <details className="mt-2">
                  <summary className="min-h-11 cursor-pointer py-3 font-semibold">{t.privateNote}</summary>
                  <p className="whitespace-pre-wrap break-words text-soft">{phase.privateNote}</p>
                </details>
              ) : null}
              {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions(phase)}</div> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
