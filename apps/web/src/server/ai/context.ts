import "server-only";
import { z } from "zod";
import {
  addDays,
  exerciseFamilyOf,
  isPlannerSlotToken,
  trainingPhaseProgress,
  plannerPhaseChoicesForDate,
  plannerRequiredEquipment,
  plannerSessionMovements,
  plannerSessionToComposition,
} from "@tartan/domain";
import { conciseGuideFor } from "@tartan/domain/exercise-catalog";
import {
  plannerCapability,
  plannerRequestHints,
  plannerSelection,
  type PlannerRichInterpretation,
  type PlannerSelection,
  sessionPhaseReview,
  exerciseClassification,
  exerciseFamily,
  snapshotItem,
  uuid,
  clockTime,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { AppError, notFound, invalid } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";
import { coachGroupIds, requireGroupInScope, visibleAthleteIds, type Access } from "../access";
import { preparePhasePlanning } from "../training-phases.service";
import { strengthResolutionInputsForAthletes } from "../strength.service";
import { fromDbDate, toDbDate } from "@/lib/dates";
import { PLANNER_LIBRARY_LIMIT, plannerProviderContext, type PlannerProviderContext } from "./pipeline/types";

export const plannerBindings = z.object({
  resolutions: z
    .array(
      z.object({
        operationId: uuid,
        questionId: z.string(),
        requestedName: z.string().max(120).optional(),
        clarificationCount: z.number().int().min(0).default(0),
        fingerprint: z.string(),
        // Absent quand le coach a retiré un emplacement à compléter.
        exerciseId: uuid.optional(),
        name: z.string(),
      }),
    )
    .max(120)
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
  // Faux : aucun destinataire n'a été choisi ; `targets` liste ceux que le coach peut viser, à citer dans la demande.
  targetsChosen: z.boolean().optional(),
  // Toute la bibliothèque de l'espace, figée à la demande : aucune coupe.
  exercises: z.array(
    z.object({
      token: z.string(),
      id: uuid,
      name: z.string(),
      category: z.string(),
      updatedAt: z.string(),
      aliases: z.array(z.string()).optional(),
      catalogKey: z.string().max(120).nullable().optional(),
      classification: exerciseClassification.strict().nullable().optional(),
      strengthLoadKind: snapshotItem.shape.strengthLoadKind,
      family: exerciseFamily.nullable().optional(),
      level: z.enum(["beginner", "intermediate", "advanced"]).nullable().optional(),
      unit: z.enum(["repetitions", "seconds", "meters", "contacts", "steps"]).nullable().optional(),
      sides: z.enum(["total", "each_side", "alternating_total"]).nullable().optional(),
      objective: z.string().nullable().optional(),
      approved: z.boolean().optional(),
      own: z.boolean().optional(),
      preferred: z.number().int().min(0).nullable().optional(),
    }),
  ),
  phaseReviews: z.array(z.object({ date: z.iso.date(), review: sessionPhaseReview })),
  phaseCalendar: plannerProviderContext.shape.phaseCalendar,
  // L'heure demandée à l'écran, posée sur la séance par le serveur quand la demande n'en dit aucune.
  startTime: clockTime.nullable().optional(),
  // Ce que le client qui a créé la demande sait afficher : emplacements à compléter, nouveaux points à vérifier.
  accepts: z.array(plannerCapability).optional(),
  // Les précisions facultatives de l'écran (durée, niveau, matériel) : des indices pour l'étape « Comprendre ».
  hints: plannerRequestHints.optional(),
  // Contexte figé à la demande : profil de l'espace, séances voisines (champs structurés seulement) et
  // couverture des références de force. Aucune note, aucun ressenti, aucune donnée de santé.
  space: plannerProviderContext.shape.space,
  neighbours: plannerProviderContext.shape.neighbours,
  strength: plannerProviderContext.shape.strength,
});
export type PlannerBindings = z.infer<typeof plannerBindings>;
const changed = () => new AppError(409, "planner_context_changed", m.aiPlanner.contextChanged);
export async function assertPlannerTargets(
  tx: Prisma.TransactionClient,
  access: Access,
  selection: Pick<PlannerSelection, "groupIds" | "athleteIds">,
) {
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

// Seuls les champs du guide utiles à l'étape « Composer » : famille, niveau, unité de comptage, côtés.
const guideFacts = z.object({
  family: exerciseFamily.optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  objective: z.string().optional(),
  counting: z
    .object({
      unit: z.enum(["repetitions", "seconds", "meters", "contacts", "steps"]).optional(),
      sides: z.enum(["total", "each_side", "alternating_total"]).optional(),
    })
    .optional(),
  technicalReview: z.string().optional(),
});
const MAX_TARGETS = 200;

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
    select: {
      timeZone: true,
      phasesEnabled: true,
      disciplines: true,
      trainingObjectives: true,
      availableEquipment: true,
    },
  });
  // Aucun destinataire choisi : tous ceux que ce coach peut viser sont proposés à la lecture de la demande, qui
  // doit en citer. Leurs noms ne partent jamais : la demande est mise en jetons avant tout appel.
  const targetsChosen = selection.groupIds.length + selection.athleteIds.length > 0;
  const scope = targetsChosen
    ? { groupIds: selection.groupIds, athleteIds: selection.athleteIds }
    : {
        groupIds: (access.role === "owner"
          ? (
              await tx.group.findMany({
                where: { organizationId: access.organizationId },
                select: { id: true },
                orderBy: { id: "asc" },
                take: 100,
              })
            ).map((group) => group.id)
          : (await coachGroupIds(access, tx)).slice(0, 100)
        ).sort(),
        athleteIds: (await visibleAthleteIds(access, tx)).sort().slice(0, MAX_TARGETS - 100),
      };
  const [groups, athletes, exercises, lists] = await Promise.all([
    tx.group.findMany({
      where: { organizationId: access.organizationId, id: { in: scope.groupIds } },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    }),
    tx.athlete.findMany({
      where: { organizationId: access.organizationId, id: { in: scope.athleteIds } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { id: "asc" },
    }),
    // Toute la bibliothèque : fiches de l'espace et fiches communes. Plus de tri par mots ni de coupe.
    tx.exercise.findMany({
      where: {
        OR: [{ organizationId: access.organizationId }, { organizationId: null }],
        deletedAt: null,
        ...(selection.exerciseIds.length ? { id: { in: selection.exerciseIds } } : {}),
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
        guide: true,
      },
      orderBy: { id: "asc" },
      take: PLANNER_LIBRARY_LIMIT + 1,
    }),
    // Favoris puis listes du coach, dans leur ordre : ces fiches passent d'abord dans ce qu'il laisse composer.
    tx.exerciseList.findMany({
      where: { organizationId: access.organizationId, ownerId: access.userId },
      orderBy: [{ isFavorites: "desc" }, { position: "asc" }, { id: "asc" }],
      select: { items: { orderBy: [{ position: "asc" }, { exerciseId: "asc" }], select: { exerciseId: true } } },
    }),
  ]);
  if (targetsChosen && (groups.length !== scope.groupIds.length || athletes.length !== scope.athleteIds.length))
    throw notFound();
  if (!exercises.length || exercises.length > PLANNER_LIBRARY_LIMIT) throw invalid(m.aiPlanner.libraryLimit);
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
  if (org.phasesEnabled && targetsChosen)
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
  // Une copie de l'espace représente sa fiche commune : une seule des deux entre dans la bibliothèque.
  const represented = new Set(
    exercises.filter((entry) => entry.organizationId === access.organizationId).map((entry) => entry.sourceCatalogKey),
  );
  const facts = new Map(exercises.map((entry) => [entry.id, guideFacts.safeParse(entry.guide ?? {})]));
  const approvedKeys = new Set(
    exercises
      .filter((entry) => {
        const guide = facts.get(entry.id);
        return (
          entry.organizationId === null &&
          entry.catalogKey &&
          guide?.success &&
          guide.data.technicalReview === "approved"
        );
      })
      .map((entry) => entry.catalogKey),
  );
  const available = selection.exerciseIds.length
    ? exercises
    : exercises.filter((entry) => !entry.catalogKey || !represented.has(entry.catalogKey));
  const rank = new Map<string, number>();
  for (const list of lists)
    for (const item of list.items) if (!rank.has(item.exerciseId)) rank.set(item.exerciseId, rank.size);
  // Une copie de l'espace se retrouve aussi sous les noms de la fiche commune qu'elle représente : les fiches de
  // départ sont copiées sans leurs alias, et le coach peut avoir renommé la sienne.
  const common = new Map(
    exercises.flatMap((entry) =>
      entry.organizationId === null && entry.catalogKey ? [[entry.catalogKey, entry] as const] : [],
    ),
  );
  const labels = (entry: (typeof exercises)[number]) => {
    const source = entry.organizationId !== null && entry.sourceCatalogKey ? common.get(entry.sourceCatalogKey) : null;
    if (!source) return entry.aliases;
    const seen = new Set([entry.name, ...entry.aliases].map((label) => label.toLocaleLowerCase("fr")));
    return [
      ...entry.aliases,
      ...[source.name, ...source.aliases].filter((label) => !seen.has(label.toLocaleLowerCase("fr"))),
    ];
  };
  const bound = available.map((entry, i) => {
    const parsed = facts.get(entry.id);
    const guide = parsed?.success ? parsed.data : null;
    const key = entry.catalogKey ?? entry.sourceCatalogKey;
    const own = entry.organizationId === access.organizationId;
    return {
      token: `exercise_${i + 1}`,
      id: entry.id,
      name: entry.name,
      category: entry.category,
      updatedAt: entry.updatedAt.toISOString(),
      aliases: labels(entry),
      catalogKey: key,
      classification: entry.classification,
      strengthLoadKind: entry.strengthLoadKind,
      family: guide?.family ?? exerciseFamilyOf(null, entry.category),
      level: guide?.level ?? null,
      unit: guide?.counting?.unit ?? null,
      sides: guide?.counting?.sides ?? null,
      // L'objectif court du guide concis, sinon celui du guide : une ligne, pour choisir un exercice.
      objective: ((key ? conciseGuideFor(key)?.objective : null) ?? guide?.objective ?? null)?.slice(0, 160) ?? null,
      // Proposable : fiche commune relue, copie d'une fiche relue, ou fiche créée par le coach.
      approved: Boolean(key && approvedKeys.has(key)),
      own: own && !entry.sourceCatalogKey,
      preferred: rank.get(entry.id) ?? null,
    };
  });
  return plannerBindings.parse({
    today: new Intl.DateTimeFormat("en-CA", { timeZone: org.timeZone }).format(now),
    timeZone: org.timeZone,
    targets,
    targetsChosen,
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
  // Sans destinataire choisi, rien n'est lu des séances ni des références : l'audience n'est pas connue.
  if (!selection.groupIds.length && !selection.athleteIds.length) return { neighbours: [], strength: [] };
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
    const keys = new Map<string, number>();
    for (const athlete of audience)
      for (const key of new Set((references.get(athlete) ?? []).map((reference) => reference.exerciseKey)))
        keys.set(key, (keys.get(key) ?? 0) + 1);
    for (const exercise of loadable) {
      const covered = keys.get(`exercise:${exercise.id}`) ?? 0;
      if (covered)
        strength.push({ exerciseToken: exercise.token, coverage: covered === audience.length ? "all" : "some" });
    }
  }
  return { neighbours, strength };
}

// Les noms connus sont remplacés localement. Le texte libre peut toujours contenir
// d’autres personnes : l’information à l’utilisateur ne promet pas une anonymisation.
export function pseudonymizePlannerText(text: string, bindings: Pick<PlannerBindings, "targets">) {
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

/**
 * La fenêtre où une date peut tomber. Les clients d'avant le champ unique choisissent un jour à l'écran : quand la
 * demande en cite un autre (« demain »), c'est la demande qui vaut. La fenêtre s'ouvre donc à quatre semaines, et le
 * jour de l'écran ne sert plus que si la demande n'en dit aucun. Une période de plusieurs jours reste telle quelle.
 */
export function plannerDateWindow(period: PlannerSelection["period"], today: string) {
  if (period.from !== period.to) return { period, day: null };
  const from = period.from < today ? period.from : today;
  const to = addDays(from, 27);
  return period.from <= to ? { period: { from, to }, day: period.from } : { period, day: period.from };
}

export function providerContextFor(
  selection: PlannerSelection,
  bindings: PlannerBindings,
  messages: string[],
  options: {
    // « Ajuster » : la séance actuelle, que le modèle modifie.
    previous?: PlannerRichInterpretation;
    // Alias appris de l'espace, lus au moment de l'appel : identifiant de fiche → termes.
    learned?: readonly { term: string; exerciseId: string }[];
  } = {},
): PlannerProviderContext {
  const tokenOf = new Map(bindings.exercises.map((exercise) => [exercise.id, exercise.token]));
  const window = plannerDateWindow(selection.period, bindings.today);
  return plannerProviderContext.parse({
    ...(selection.mode ? { mode: selection.mode } : {}),
    ...(selection.brief
      ? { brief: { ...selection.brief, objective: pseudonymizePlannerText(selection.brief.objective, bindings) } }
      : {}),
    // Le jour choisi à l'écran : un indice, retenu seulement si la demande ne cite aucun jour.
    ...(window.day ? { day: window.day } : {}),
    ...(bindings.startTime ? { startTime: bindings.startTime } : {}),
    ...(bindings.hints ? { hints: bindings.hints } : {}),
    ...(bindings.space ? { space: bindings.space } : {}),
    ...(bindings.neighbours?.length ? { neighbours: bindings.neighbours } : {}),
    ...(bindings.strength?.length ? { strength: bindings.strength } : {}),
    // Titres et noms de blocs écrits par le modèle à partir de jetons : aucun nom de personne n'y revient.
    ...(options.previous
      ? {
          previous: {
            sessions: options.previous.sessions.map((session, index) => ({
              date: session.date,
              startTime: session.startTime,
              targetTokens: session.targetTokens,
              session: plannerSessionToComposition(session, index),
              movements: plannerSessionMovements(session, index).map(
                ({ id, said, exerciseToken, confidence, alternatives, suggestion }) => ({
                  id,
                  said,
                  exerciseToken,
                  confidence: isPlannerSlotToken(exerciseToken) ? "absent" : confidence,
                  alternatives: [...alternatives],
                  ...(suggestion ? { suggestion } : {}),
                }),
              ),
            })),
          },
        }
      : {}),
    resolvedExercises: (bindings.resolutions ?? []).flatMap((resolution) => {
      const token = resolution.exerciseId ? tokenOf.get(resolution.exerciseId) : undefined;
      return resolution.requestedName && token ? [{ term: resolution.requestedName, token }] : [];
    }),
    learnedAliases: (options.learned ?? [])
      .flatMap((alias) =>
        tokenOf.has(alias.exerciseId) ? [{ term: alias.term, token: tokenOf.get(alias.exerciseId)! }] : [],
      )
      .slice(0, 2000),
    period: window.period,
    today: bindings.today,
    timeZone: bindings.timeZone,
    targetsChosen: bindings.targetsChosen !== false,
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
      aliases: (e.aliases ?? []).slice(0, 20),
      classification: e.classification ?? null,
      ...(e.catalogKey && plannerRequiredEquipment(e.catalogKey, e.classification?.equipment)?.includes("jump_rope")
        ? { catalogKey: e.catalogKey }
        : {}),
      strengthLoadKind: e.strengthLoadKind ?? null,
      family: e.family ?? null,
      level: e.level ?? null,
      unit: e.unit ?? null,
      sides: e.sides ?? null,
      objective: e.objective ?? null,
      approved: e.approved ?? false,
      own: e.own ?? false,
      preferred: e.preferred ?? null,
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
  // Destinataires choisis : ceux de la sélection. Sinon, tous ceux que la demande pouvait citer.
  await assertPlannerTargets(
    tx,
    access,
    bindings.targetsChosen === false
      ? {
          groupIds: bindings.targets.filter((target) => target.type === "group").map((target) => target.id),
          athleteIds: bindings.targets.filter((target) => target.type === "athlete").map((target) => target.id),
        }
      : selection,
  );
  const active = await tx.exercise.findMany({
    where: {
      id: { in: bindings.exercises.map((e) => e.id) },
      deletedAt: null,
      OR: [{ organizationId: access.organizationId }, { organizationId: null }],
    },
    select: { id: true, updatedAt: true },
  });
  const updated = new Map(active.map((exercise) => [exercise.id, exercise.updatedAt.toISOString()]));
  if (active.length !== bindings.exercises.length || bindings.exercises.some((e) => updated.get(e.id) !== e.updatedAt))
    throw changed();
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: access.organizationId },
    select: { phasesEnabled: true, timeZone: true },
  });
  if (
    org.timeZone !== bindings.timeZone ||
    (bindings.targetsChosen !== false && org.phasesEnabled !== bindings.phaseReviews.length > 0)
  )
    throw changed();
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
