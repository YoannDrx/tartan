import Link from "next/link";
import { trainingPhaseProgress } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { listTrainingPhases } from "@/server/training-phases.service";
import type { SpaceContext } from "@/features/shell/space";
import { PhaseTimeline } from "./phase-timeline";

// Les phases de la période, en une ligne : la phase en cours et sa semaine, la frise à la demande, et le lien
// vers la page des phases sur la même ligne. Le planning reste dans le premier écran.
export async function CalendarPhases({
  ctx,
  from,
  to,
  today,
  groupId,
  open = false,
}: {
  ctx: SpaceContext;
  from: string;
  to: string;
  today: string;
  groupId?: string;
  // Là où les phases sont le sujet de l'écran (progrès, calendrier de l'athlète), la frise s'ouvre d'emblée.
  open?: boolean;
}) {
  if (!ctx.space.phasesEnabled) return null;
  const { phases } = await listTrainingPhases(ctx.actor.userId, ctx.organizationId, { from, to, groupId });
  const query = new URLSearchParams({ from, to, ...(groupId ? { target: `group:${groupId}` } : {}) });
  const t = w.planning;
  // Le repère de la frise : aujourd'hui s'il est dans la période affichée, sinon son premier jour.
  const reference = today >= from && today <= to ? today : from;
  // La phase en cours à ce repère, sinon la première de la période.
  const current = phases.find((phase) => trainingPhaseProgress(phase, reference)) ?? phases[0];
  const progress = current ? trainingPhaseProgress(current, reference) : null;
  return (
    <section className="relative rounded-card border border-card-line bg-card on-card">
      <details open={open && phases.length > 0 && phases.length <= 3}>
        <summary className="min-h-11 cursor-pointer py-2.5 pl-4 pr-28 font-semibold leading-6">
          <span>{m.trainingPhases.title}</span>
          <span className="font-normal text-soft">
            {" : "}
            {current ? <span>{current.name}</span> : t.phasesNone}
            {phases.length > 1 ? ` ${t.phasesMore(phases.length - 1)}` : null}
          </span>
          {progress ? (
            <span className="ml-2 inline-block whitespace-nowrap rounded-full border border-card-line px-2 text-sm font-normal">
              {m.trainingPhases.week(progress.week, progress.weeks)}
            </span>
          ) : null}
        </summary>
        <div className="px-4">
          <PhaseTimeline phases={phases} from={from} to={to} today={reference} />
        </div>
      </details>
      <Link
        href={`/phases?${query}`}
        aria-label={ctx.staff ? t.phasesManageLabel : t.phasesSeeAllLabel}
        className="absolute right-1 top-0 inline-flex min-h-11 items-center rounded-button px-3 font-semibold text-ctx-link underline underline-offset-4"
      >
        {ctx.staff ? t.phasesManage : t.phasesSeeAll}
      </Link>
    </section>
  );
}
