import "server-only";
import { z } from "zod";
import { addDays, trainingPhaseProgress, plannerPhaseChoicesForDate } from "@tartan/domain";
import { plannerSelection, type PlannerSelection, sessionPhaseReview, uuid } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { AppError, forbidden, notFound, invalid } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";
import { requireGroupInScope, visibleAthleteIds, type Access } from "../access";
import { preparePhasePlanning } from "../training-phases.service";
import { plannerProviderContext, type PlannerProviderContext } from "./provider";

export const plannerBindings = z.object({
  today: z.iso.date(),
  timeZone: z.string(),
  targets: z.array(
    z.object({
      token: z.string(),
      id: uuid,
      type: z.enum(["group", "athlete"]),
      label: z.string(),
      aliases: z.array(z.string()),
    }),
  ),
  exercises: z.array(
    z.object({ token: z.string(), id: uuid, name: z.string(), category: z.string(), updatedAt: z.string() }),
  ),
  phaseReviews: z.array(z.object({ date: z.iso.date(), review: sessionPhaseReview })),
  phaseCalendar: plannerProviderContext.shape.phaseCalendar,
});
export type PlannerBindings = z.infer<typeof plannerBindings>;
const changed = () => new AppError(409, "planner_context_changed", m.aiPlanner.contextChanged);
export async function assertPlannerTargets(tx: Prisma.TransactionClient, access: Access, selection: PlannerSelection) {
  await requireGroupInScope(access, selection.groupIds, tx);
  const athletes = await visibleAthleteIds(access, tx);
  if (!selection.athleteIds.every((id) => athletes.includes(id))) throw forbidden();
}

export async function buildPlannerBindings(
  tx: Prisma.TransactionClient,
  access: Access,
  raw: PlannerSelection,
  now: Date,
): Promise<PlannerBindings> {
  const selection = plannerSelection.parse(raw);
  await assertPlannerTargets(tx, access, selection);
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: access.organizationId },
    select: { timeZone: true, phasesEnabled: true },
  });
  const [groups, athletes, exercises] = await Promise.all([
    tx.group.findMany({
      where: { organizationId: access.organizationId, id: { in: selection.groupIds } },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    }),
    tx.athlete.findMany({
      where: { organizationId: access.organizationId, id: { in: selection.athleteIds } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { id: "asc" },
    }),
    tx.exercise.findMany({
      where: {
        OR: [{ organizationId: access.organizationId }, { organizationId: null }],
        deletedAt: null,
        ...(selection.exerciseIds.length ? { id: { in: selection.exerciseIds } } : {}),
      },
      select: { id: true, name: true, category: true, updatedAt: true },
      orderBy: { id: "asc" },
      take: 501,
    }),
  ]);
  if (groups.length !== selection.groupIds.length || athletes.length !== selection.athleteIds.length) throw notFound();
  if (!exercises.length || exercises.length > 500) throw invalid(m.aiPlanner.libraryLimit);
  if (selection.exerciseIds.length && exercises.length !== selection.exerciseIds.length) throw notFound();
  const targets: PlannerBindings["targets"] = [
    ...groups.map((group, i) => ({
      token: `group_${i + 1}`,
      id: group.id,
      type: "group" as const,
      label: group.name,
      aliases: [group.name],
    })),
    ...athletes.map((athlete, i) => ({
      token: `athlete_${i + 1}`,
      id: athlete.id,
      type: "athlete" as const,
      label: `${athlete.firstName} ${athlete.lastName}`.trim(),
      aliases: [
        `${athlete.firstName} ${athlete.lastName}`.trim(),
        ...(athletes.filter((a) => a.firstName.toLocaleLowerCase("fr") === athlete.firstName.toLocaleLowerCase("fr"))
          .length === 1
          ? [athlete.firstName]
          : []),
      ],
    })),
  ];
  const phaseReviews: PlannerBindings["phaseReviews"] = [],
    phaseCalendar: NonNullable<PlannerBindings["phaseCalendar"]> = [];
  if (org.phasesEnabled)
    for (let date = selection.period.from; date <= selection.period.to; date = addDays(date, 1)) {
      const choices = plannerPhaseChoicesForDate(selection, date);
      const phases = await preparePhasePlanning(
        access,
        { date, groupIds: selection.groupIds, athleteIds: selection.athleteIds, choices },
        tx,
      );
      if (phases.athletes.some((a) => a.result.kind === "choose_group"))
        throw new AppError(409, "phase_choice_required", m.trainingPhases.reviewRequired);
      phaseReviews.push({ date, review: { token: phases.token, choices } });
      for (const target of targets) {
        const athlete = phases.athletes.find((a) => a.id === target.id);
        const phase =
          target.type === "group"
            ? phases.groups.find((g) => g.id === target.id)?.phase
            : athlete?.result.kind === "phase"
              ? athlete.result.phase
              : null;
        const progress = phase ? trainingPhaseProgress(phase, date) : null;
        phaseCalendar.push({
          date,
          targetToken: target.token,
          phase: phase && progress ? { kind: phase.kind, ...progress } : null,
        });
      }
    }
  return plannerBindings.parse({
    today: new Intl.DateTimeFormat("en-CA", { timeZone: org.timeZone }).format(now),
    timeZone: org.timeZone,
    targets,
    exercises: exercises.map((e, i) => ({ ...e, token: `exercise_${i + 1}`, updatedAt: e.updatedAt.toISOString() })),
    phaseReviews,
    phaseCalendar,
  });
}

// Les noms connus sont remplacés localement. Le texte libre peut toujours contenir
// d’autres personnes : l’information à l’utilisateur ne promet pas une anonymisation.
export function pseudonymizePlannerText(text: string, bindings: PlannerBindings) {
  const aliases = new Map<string, Set<string>>();
  for (const target of bindings.targets)
    for (const label of target.aliases) {
      const key = label.trim().toLocaleLowerCase("fr");
      if (!key) continue;
      aliases.set(key, new Set([...(aliases.get(key) ?? []), target.token]));
    }
  const known = [...aliases].filter(([, tokens]) => tokens.size === 1).sort(([a], [b]) => b.length - a.length);
  if (!known.length) return text;
  const escaped = known.map(([name]) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${escaped.join("|")})(?![\\p{L}\\p{N}_])`, "giu");
  return text.replace(regex, (name) => [...aliases.get(name.toLocaleLowerCase("fr"))!][0]!);
}
export function providerContextFor(
  selection: PlannerSelection,
  bindings: PlannerBindings,
  messages: string[],
): PlannerProviderContext {
  return plannerProviderContext.parse({
    period: selection.period,
    today: bindings.today,
    timeZone: bindings.timeZone,
    targets: bindings.targets.map((t) => ({
      token: t.token,
      kind: t.type,
      phase:
        bindings.phaseCalendar?.find((p) => p.date === selection.period.from && p.targetToken === t.token)?.phase ??
        null,
    })),
    exercises: bindings.exercises.map((e) => ({ token: e.token, name: e.name, category: e.category, aliases: [] })),
    phaseCalendar: bindings.phaseCalendar,
    instructions: messages.map((text) => pseudonymizePlannerText(text, bindings)),
  });
}

export async function recheckPlannerBindings(
  tx: Prisma.TransactionClient,
  access: Access,
  selection: PlannerSelection,
  bindings: PlannerBindings,
) {
  await assertPlannerTargets(tx, access, selection);
  const active = await tx.exercise.findMany({
    where: {
      id: { in: bindings.exercises.map((e) => e.id) },
      deletedAt: null,
      OR: [{ organizationId: access.organizationId }, { organizationId: null }],
    },
    select: { id: true, updatedAt: true },
  });
  if (
    active.length !== bindings.exercises.length ||
    bindings.exercises.some((e) => active.find((a) => a.id === e.id)?.updatedAt.toISOString() !== e.updatedAt)
  )
    throw changed();
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: access.organizationId },
    select: { phasesEnabled: true, timeZone: true },
  });
  if (org.timeZone !== bindings.timeZone || org.phasesEnabled !== bindings.phaseReviews.length > 0) throw changed();
  for (const entry of bindings.phaseReviews) {
    const current = await preparePhasePlanning(
      access,
      {
        date: entry.date,
        groupIds: selection.groupIds,
        athleteIds: selection.athleteIds,
        choices: entry.review.choices,
      },
      tx,
    );
    if (current.token !== entry.review.token) throw changed();
  }
}
