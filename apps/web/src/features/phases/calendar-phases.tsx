import Link from "next/link";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { listTrainingPhases } from "@/server/training-phases.service";
import type { SpaceContext } from "@/features/shell/space";
import { PhaseTimeline } from "./phase-timeline";

export async function CalendarPhases({
  ctx,
  from,
  to,
  today,
  groupId,
}: {
  ctx: SpaceContext;
  from: string;
  to: string;
  today: string;
  groupId?: string;
}) {
  if (!ctx.space.phasesEnabled) return null;
  const { phases } = await listTrainingPhases(ctx.actor.userId, ctx.organizationId, { from, to, groupId });
  const query = new URLSearchParams({ from, to, ...(groupId ? { target: `group:${groupId}` } : {}) });
  return (
    <section className="rounded-card border border-card-line bg-card px-4 on-card">
      <details open={phases.length > 0 && phases.length <= 3}>
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">{m.trainingPhases.title}</summary>
        <PhaseTimeline phases={phases} from={from} to={to} today={today >= from && today <= to ? today : from} />
      </details>
      <div className="pb-3">
        <Button asChild variant="secondary">
          <Link href={`/phases?${query}`}>{m.trainingPhases.title}</Link>
        </Button>
      </div>
    </section>
  );
}
