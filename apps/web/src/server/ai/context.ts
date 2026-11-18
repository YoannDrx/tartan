import "server-only";
import { z } from "zod";
import {
  addDays,
  trainingPhaseProgress,
  plannerPhaseChoicesForDate,
  rankPlannerCandidates,
  plannerEquipmentAvailable,
} from "@tartan/domain";
import {
  plannerSelection,
  type PlannerSelection,
  sessionPhaseReview,
  exerciseClassification,
  snapshotItem,
  uuid,
  clockTime,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { AppError, notFound, invalid } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";
import { requireGroupInScope, visibleAthleteIds, type Access } from "../access";
import { preparePhasePlanning } from "../training-phases.service";
import { strengthResolutionInputsForAthletes } from "../strength.service";
import { fromDbDate, toDbDate } from "@/lib/dates";
import { plannerProviderContext, type PlannerProviderContext } from "./provider";

export const plannerBindings = z.object({
  resolutions: z
    .array(
      z.object({
        operationId: uuid,
        questionId: z.string(),
        requestedName: z.string().max(120).optional(),
        clarificationCount: z.number().int().min(0).default(0),
        fingerprint: z.string(),
        exerciseId: uuid,
        name: z.string(),
      }),
    )
    .max(50)
    .optional(),
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
    z.object({
      token: z.string(),
      id: uuid,
      name: z.string(),
      category: z.string(),
      updatedAt: z.string(),
      aliases: z.array(z.string()).optional(),
      classification: exerciseClassification.strict().nullable().optional(),
      strengthLoadKind: snapshotItem.shape.strengthLoadKind,
    }),
  ),
  phaseReviews: z.array(z.object({ date: z.iso.date(), review: sessionPhaseReview })),
  phaseCalendar: plannerProviderContext.shape.phaseCalendar,
  // Mode « Proposer » : l'heure demandée, posée sur la séance par le serveur.
  startTime: clockTime.nullable().optional(),
  // Contexte figé à la demande : profil de l'espace, séances voisines (champs structurés seulement) et
  // couverture des références de force. Aucune note, aucun ressenti, aucune donnée de santé.
  space: plannerProviderContext.shape.space,
  neighbours: plannerProviderContext.shape.neighbours,
  strength: plannerProviderContext.shape.strength,
});
export type PlannerBindings = z.infer<typeof plannerBindings>;
const changed = () => new AppError(409, "planner_context_changed", m.aiPlanner.contextChanged);
export async function assertPlannerTargets(tx: Prisma.TransactionClient, access: Access, selection: PlannerSelection) {
  try {
    await requireGroupInScope(access, selection.groupIds, tx);
  } catch (error) {
    if (error instanceof AppError && error.status === 403)
      throw new AppError(403, "planner_target_out_of_scope", m.aiPlanner.targetOutOfScope);
    throw error;
  }
  const athletes = await visibleAthleteIds(access, tx);
  if (!selection.athleteIds.every((id) => athletes.includes(id)))
    throw new AppError(403, "planner_target_out_of_scope", m.aiPlanner.targetOutOfScope);
}

export async function buildPlannerBindings(
  tx: Prisma.TransactionClient,
  access: Access,
  raw: PlannerSelection,
  now: Date,
  text = "",
): Promise<PlannerBindings> {
  const selection = plannerSelection.parse(raw);
  await assertPlannerTargets(tx, access, selection);
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: access.organizationId },
    select: {
      timeZone: true,
      phasesEnabled: true,
      disciplines: true,
      trainingObjectives: true,
      availableEquipment: true,
    },
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
        // Mode « Proposer » : les fiches communes validées, et les fiches de l'espace qui en sont la copie.
        ...(selection.mode === "propose"
          ? {
              AND: [
                {
                  OR: [
                    {
                      organizationId: null,
                      catalogKey: { not: null },
                      guide: { path: ["technicalReview"], equals: "approved" },
                    },
                    { organizationId: access.organizationId, sourceCatalogKey: { not: null } },
                  ],
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        category: true,
        updatedAt: true,
        aliases: true,
        classification: true,
        strengthLoadKind: true,
        catalogKey: true,
        sourceCatalogKey: true,
        organizationId: true,
      },
      orderBy: { id: "asc" },
    }),
  ]);
  if (groups.length !== selection.groupIds.length || athletes.length !== selection.athleteIds.length) throw notFound();
  if (selection.mode === "propose") {
    // Une copie de l'espace n'entre que si sa fiche d'origine est elle-même validée.
    const approved = new Set(exercises.filter((e) => e.organizationId === null).map((e) => e.catalogKey));
    const kept = exercises.filter((e) => e.organizationId === null || approved.has(e.sourceCatalogKey));
    exercises.splice(0, exercises.length, ...kept);
  }
  if (!exercises.length)
    throw invalid(selection.mode === "propose" ? m.aiPlanner.verifiedCatalogRequired : m.aiPlanner.libraryLimit);
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
  const represented = new Set(
    exercises.filter((entry) => entry.organizationId === access.organizationId).map((entry) => entry.sourceCatalogKey),
  );
  const eligible =
    selection.mode === "propose"
      ? exercises.filter((entry) => {
          const classification = exerciseClassification.nullable().safeParse(entry.classification);
          return (
            classification.success && plannerEquipmentAvailable(classification.data, selection.brief?.equipment ?? [])
          );
        })
      : exercises;
  if (!eligible.length) throw invalid(m.aiPlanner.clarifyEquipment);
  const available = eligible.filter((entry) => !entry.catalogKey || !represented.has(entry.catalogKey));
  const bound = (selection.exerciseIds.length ? eligible : rankPlannerCandidates(available, text)).map((e, i) => ({
    ...e,
    token: `exercise_${i + 1}`,
    updatedAt: e.updatedAt.toISOString(),
  }));
  return plannerBindings.parse({
    today: new Intl.DateTimeFormat("en-CA", { timeZone: org.timeZone }).format(now),
    timeZone: org.timeZone,
    targets,
    exercises: bound,
    phaseReviews,
    phaseCalendar,
    space: {
      disciplines: org.disciplines.slice(0, 20).map((d) => d.slice(0, 40)),
      objectives: org.trainingObjectives,
      equipment: org.availableEquipment,
    },
    ...(await plannerSurroundings(tx, access.organizationId, selection, targets, bound)),
  });
}

const looseDraft = z.object({
  blocks: z
    .array(
      z.object({
        items: z
          .array(
            z.object({
              kind: z.string().optional(),
              exerciseId: z.string().nullable().optional(),
              prescription: z
                .object({
                  sets: z.number().optional(),
                  reps: z.number().optional(),
                  distance_m: z.number().optional(),
                  duration_s: z.number().optional(),
                  load: z.object({ type: z.string(), value: z.number() }).optional(),
                })
                .optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});
const intOrNull = (value: number | undefined, min: number, max: number) =>
  value !== undefined && Number.isInteger(value) && value >= min && value <= max ? value : null;

/**
 * Séances de J−14 à J+7 de l'audience et couverture des références de force. Seuls des champs structurés sont lus
 * dans la prescription (exercice, séries, répétitions, distance, durée, charge) : jamais le titre, une note, une
 * séance réalisée, un effort ressenti, une douleur ou une blessure.
 */
async function plannerSurroundings(
  tx: Prisma.TransactionClient,
  organizationId: string,
  selection: PlannerSelection,
  targets: PlannerBindings["targets"],
  exercises: { id: string; token: string; strengthLoadKind?: string | null }[],
): Promise<Pick<PlannerBindings, "neighbours" | "strength">> {
  const memberships = await tx.groupMember.findMany({
    where: {
      OR: [{ groupId: { in: selection.groupIds } }, { athleteId: { in: selection.athleteIds } }],
      group: { organizationId },
    },
    select: { groupId: true, athleteId: true },
  });
  const tokenOfTarget = new Map(targets.map((t) => [t.id, t.token]));
  // Un groupe d'un athlète choisi le désigne, lui.
  for (const membership of memberships)
    if (!tokenOfTarget.has(membership.groupId) && selection.athleteIds.includes(membership.athleteId))
      tokenOfTarget.set(membership.groupId, tokenOfTarget.get(membership.athleteId)!);
  const sessions = await tx.scheduledSession.findMany({
    where: {
      organizationId,
      date: { gte: toDbDate(addDays(selection.period.from, -14)), lte: toDbDate(addDays(selection.period.to, 7)) },
      assignments: { some: { targetId: { in: [...tokenOfTarget.keys()] } } },
    },
    select: { date: true, type: true, draft: true, snapshot: true, assignments: { select: { targetId: true } } },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    take: 40,
  });
  const tokenOfExercise = new Map(exercises.map((e) => [e.id, e.token]));
  const parsed = sessions.map((session) => looseDraft.safeParse(session.snapshot ?? session.draft));
  const unknownIds = [
    ...new Set(
      parsed.flatMap((draft) =>
        draft.success
          ? draft.data.blocks.flatMap((b) => b.items.flatMap((i) => (i.exerciseId ? [i.exerciseId] : [])))
          : [],
      ),
    ),
  ].filter((id) => !tokenOfExercise.has(id) && uuid.safeParse(id).success);
  const names = new Map(
    (
      await tx.exercise.findMany({
        where: { id: { in: unknownIds }, OR: [{ organizationId }, { organizationId: null }] },
        select: { id: true, name: true },
      })
    ).map((e) => [e.id, e.name]),
  );
  const neighbours = sessions.flatMap((session, index) => {
    const draft = parsed[index]!;
    if (!draft.success) return [];
    const items = draft.data.blocks
      .flatMap((b) => b.items)
      .filter((item) => item.kind !== "recovery" && item.exerciseId)
      .slice(0, 30)
      .flatMap((item) => {
        const token = tokenOfExercise.get(item.exerciseId!) ?? null;
        const name = token ? undefined : names.get(item.exerciseId!);
        if (!token && !name) return [];
        const p = item.prescription ?? {};
        const load =
          p.load && (p.load.type === "kg" || p.load.type === "pct_1rm") && p.load.value >= 0 && p.load.value <= 1000
            ? { type: p.load.type as "kg" | "pct_1rm", value: p.load.value }
            : null;
        return [
          {
            exerciseToken: token,
            ...(name ? { name: name.slice(0, 200) } : {}),
            sets: intOrNull(p.sets, 1, 50),
            reps: intOrNull(p.reps, 1, 500),
            distanceM: p.distance_m !== undefined && p.distance_m >= 0 && p.distance_m <= 20000 ? p.distance_m : null,
            durationS: intOrNull(p.duration_s, 0, 14400),
            load,
          },
        ];
      });
    const sessionTargets = session.assignments.flatMap((a) =>
      tokenOfTarget.has(a.targetId) ? [tokenOfTarget.get(a.targetId)!] : [],
    );
    return [
      {
        date: fromDbDate(session.date),
        type: session.type,
        targetTokens: [...new Set(sessionTargets)],
        exercises: items,
      },
    ];
  });
  // Couverture : combien de destinataires ont une référence de force pour chaque exercice chargeable.
  const audience = [
    ...new Set([
      ...selection.athleteIds,
      ...memberships.filter((m) => selection.groupIds.includes(m.groupId)).map((m) => m.athleteId),
    ]),
  ];
  const loadable = exercises.filter(
    (e) => e.strengthLoadKind === "external_total" || e.strengthLoadKind === "added_weight",
  );
  const strength: NonNullable<PlannerBindings["strength"]> = [];
  if (audience.length && audience.length <= 300 && loadable.length) {
    const references = await strengthResolutionInputsForAthletes(tx, audience);
    for (const exercise of loadable) {
      const covered = audience.filter((athlete) =>
        (references.get(athlete) ?? []).some((r) => r.exerciseKey === `exercise:${exercise.id}`),
      ).length;
      if (covered)
        strength.push({ exerciseToken: exercise.token, coverage: covered === audience.length ? "all" : "some" });
    }
  }
  return { neighbours, strength };
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
  previous?: PlannerProviderContext["previous"],
): PlannerProviderContext {
  return plannerProviderContext.parse({
    mode: selection.mode ?? "format",
    ...(selection.mode === "propose" ? { startTime: bindings.startTime ?? null } : {}),
    ...(bindings.space ? { space: bindings.space } : {}),
    ...(bindings.neighbours?.length ? { neighbours: bindings.neighbours } : {}),
    ...(bindings.strength?.length ? { strength: bindings.strength } : {}),
    // Titres et noms de blocs écrits par le modèle à partir de jetons : aucun nom de personne n'y revient.
    ...(previous ? { previous } : {}),
    resolvedExercises: (bindings.resolutions ?? []).flatMap((resolution) => {
      const exercise = bindings.exercises.find((entry) => entry.id === resolution.exerciseId);
      return resolution.requestedName && exercise ? [{ term: resolution.requestedName, token: exercise.token }] : [];
    }),
    brief: selection.brief
      ? { ...selection.brief, objective: pseudonymizePlannerText(selection.brief.objective, bindings) }
      : undefined,
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
    exercises: bindings.exercises.map((e) => ({
      token: e.token,
      name: e.name,
      category: e.category,
      aliases: e.aliases ?? [],
      classification: e.classification ?? null,
      strengthLoadKind: e.strengthLoadKind ?? null,
    })),
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
