// Le pilote : le seul fichier de la mesure qui touche à la base et au service du planificateur.
// Pour chaque cas, il crée un espace jetable (coach avec accord IA, groupes, athlètes, catalogue commun, fiches
// privées du cas), appelle le service comme le fait la route (`createPlannerProposal`, puis les brouillons
// préparés), écoute les événements diffusés, compte les appels au fournisseur et traduit la réponse en `Observed`.
// Une paire passe par l'étape « Retrouver » seule (`matchPlannerTerms`), sans consigne.
// Il ne lit ni le prompt, ni les garde-fous, ni l'adaptateur : quand le service change, lui seul s'adapte.
// Prisma direct, comme `prisma/seed.ts` et `tests/helpers.ts` : là seulement où aucun service ne crée la donnée.
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PLANNER_SLOT_EXERCISE_ID, type PlannerProposalResponse } from "@tartan/contracts";
import { addDays } from "@tartan/domain";
import { EXERCISE_CATALOG } from "@tartan/domain/exercise-catalog";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { fakePlannerEnabled } from "@/server/ai/fake-provider";
import { createPlannerProposal, matchPlannerTerms, preparePlannerDrafts } from "@/server/ai/proposal.service";
import { syncEntitlements } from "@/server/billing.service";
import { ensureExerciseCatalog } from "@/server/exercise-catalog.service";
import { saveExercise } from "@/server/exercise.service";
import { createOrganization } from "@/server/org.service";
import { selectStrengthReference } from "@/server/strength.service";
import { foldName, type E2eCaseInput, type E2eLibrary, type E2eRecipients, type E2eSpace } from "./format";
import {
  observedError,
  type Observed,
  type ObservedMovement,
  type ObservedQuestion,
  type ObservedRef,
  type ObservedStep,
} from "./observation";
import { costOf } from "./prices";
import { mergeUsage, type StepUsage, type Timing } from "./report";
import type { CaseOutcome, E2eDriver, PairOutcome } from "./runner";

/** Ce que l'outil fournit au planificateur en quatre étapes sans que la consigne le dise. Écrit dans chaque rapport. */
export const CURRENT_PIPELINE_LIMITS = [
  "Le contrat demande encore une période : l'outil donne les vingt-huit jours à partir de la date du jour simulée, le maximum admis. Une date citée au-delà devient une question.",
  "Le premier événement diffusé est l'ouverture de l'étape « Comprendre », émise avant tout appel au modèle : le seuil de premier retour mesure un accusé de réception. Le premier contenu lisible est le résumé de compréhension (`firstSummaryMs`), puis le plan (`firstPlanMs`).",
  "Les athlètes du premier groupe de chaque espace jetable ont une référence de force sur quatre fiches du catalogue (squat arrière, développé couché, soulevé de terre, épaulé) ; les autres n'en ont pas. Un pourcentage proposé n'est donc permis que pour ce groupe seul.",
  "Une paire est mesurée par l'étape « Retrouver » seule, un terme par appel : une consigne entière peut retrouver autrement un terme que son contexte éclaire.",
];

// Ce que cet outil sait lire : les emplacements à compléter et les nouveaux points « À vérifier ».
const ACCEPTS = ["slots", "checks"] as const;
// Fiches du catalogue pour lesquelles les athlètes du premier groupe ont une référence de force, en kilos.
const REFERENCES: Record<string, number> = {
  "back-squat": 100,
  "bench-press": 70,
  deadlift: 120,
  "power-clean": 60,
};

type Call = {
  step: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  // Jetons d'entrée écrits en cache, facturés plus cher depuis GPT-5.6.
  cacheWriteTokens?: number;
};
type Meter = { step: string; calls: Call[]; pending: Promise<void>[] };
const meters = new AsyncLocalStorage<Meter>();

const usageShape = z.object({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  prompt_tokens: z.number().optional(),
  completion_tokens: z.number().optional(),
  input_tokens_details: z
    .object({ cached_tokens: z.number().optional(), cache_write_tokens: z.number().optional() })
    .optional(),
  prompt_tokens_details: z.object({ cached_tokens: z.number().optional() }).optional(),
});
const bodyShape = z.object({ model: z.string().optional(), usage: usageShape.nullish() });
const envelope = z.union([z.object({ response: bodyShape }).transform((value) => value.response), bodyShape]);

/** Les jetons d'une réponse du fournisseur, d'une seule pièce ou diffusée. Rien d'autre n'en est lu. */
export function readProviderUsage(text: string): Omit<Call, "step"> | null {
  let found: z.infer<typeof bodyShape> | null = null;
  const take = (raw: string) => {
    try {
      const parsed = envelope.safeParse(JSON.parse(raw));
      if (parsed.success && parsed.data.usage) found = parsed.data;
    } catch {
      /* morceau illisible : ignoré */
    }
  };
  if (text.trimStart().startsWith("{")) take(text);
  else
    for (const line of text.split("\n")) {
      const data = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (data && data !== "[DONE]") take(data);
    }
  const body = found as z.infer<typeof bodyShape> | null;
  if (!body?.usage) return null;
  const usage = body.usage;
  return {
    model: body.model ?? "",
    inputTokens: usage.input_tokens ?? usage.prompt_tokens ?? 0,
    cachedInputTokens: usage.input_tokens_details?.cached_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? 0,
    outputTokens: usage.output_tokens ?? usage.completion_tokens ?? 0,
    cacheWriteTokens: usage.input_tokens_details?.cache_write_tokens ?? 0,
  };
}

/**
 * Compte les appels au fournisseur, quel que soit le nombre d'étapes du service : tout appel vers OpenAI passe par
 * `fetch`, et l'étape en cours est celle du dernier événement diffusé. Avec le prestataire simulé, un appel vers
 * OpenAI est refusé : la mesure simulée ne peut pas dépenser.
 */
function installMeter(allowNetwork: boolean): () => void {
  const original = globalThis.fetch;
  const metered: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith("https://api.openai.com/")) return original(input, init);
    if (!allowNetwork) throw new Error("e2e_eval_network_blocked");
    const meter = meters.getStore();
    const response = await original(input, init);
    if (!meter) return response;
    let requested = "";
    try {
      requested = z.object({ model: z.string() }).parse(JSON.parse(String(init?.body))).model;
    } catch {
      /* corps illisible : le modèle sera lu dans la réponse */
    }
    const call: Call = { step: meter.step, model: requested, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };
    meter.calls.push(call);
    if (response.ok)
      meter.pending.push(
        response
          .clone()
          .text()
          .then((text) => {
            const usage = readProviderUsage(text);
            if (usage) Object.assign(call, { ...usage, model: usage.model || requested });
          })
          .catch(() => undefined),
      );
    return response;
  };
  globalThis.fetch = metered;
  return () => {
    if (globalThis.fetch === metered) globalThis.fetch = original;
  };
}

export const usageOf = (calls: readonly Call[]): StepUsage[] =>
  mergeUsage(calls.map((call) => ({ ...call, calls: 1, costUsd: costOf(call) })));

type LibraryEntry = { ref: ObservedRef; family: string | null; equipment: string[] | null };
type Workspace = {
  coachId: string;
  organizationId: string;
  groups: Map<string, string>;
  athletes: Map<string, string>;
  library: Map<string, LibraryEntry>;
  byName: Map<string, ObservedRef>;
};

const FICTIONAL = ["Alix", "Bao", "Chloé", "Dario", "Elsa", "Farid", "Gwen", "Hugo", "Inès", "Jules", "Kenza", "Léo"];
const classification = z.object({ equipment: z.array(z.string()).nullable() }).nullable();
const catalogFamily = new Map(EXERCISE_CATALOG.map((entry) => [entry.catalogKey, entry.guide.family]));

async function createWorkspace(spec: {
  recipients: E2eRecipients;
  space?: E2eSpace;
  library: E2eLibrary;
}): Promise<Workspace> {
  const coachId = randomUUID();
  // Coach fictif et majeur, accord IA donné : rien ne part vers le fournisseur sans lui.
  await prisma.user.create({
    data: {
      id: coachId,
      name: "Coach Mesure",
      email: `mesure-${coachId.slice(0, 8)}@test.tartan.coach`,
      emailVerified: true,
      profile: {
        create: {
          firstName: "Coach",
          lastName: "Mesure",
          birthDate: new Date("1990-01-01T00:00:00Z"),
          aiConsentAt: new Date(),
        },
      },
    },
  });
  // Tous les groupes de l'espace : ceux du profil, puis ceux que les destinataires citent.
  const declared = new Map((spec.space?.groups ?? []).map((group) => [foldName(group.name), group]));
  let invented = 0;
  for (const name of spec.recipients.groups) {
    if (declared.has(foldName(name))) continue;
    // Un groupe cité sans être décrit reçoit deux athlètes fictifs.
    const athletes = [0, 1].map((i) => `${FICTIONAL[(invented * 2 + i) % FICTIONAL.length]} Fictif`);
    declared.set(foldName(name), { name, athletes });
    invented++;
  }
  const groupSpecs = [...declared.values()];
  const org = await createOrganization(coachId, {
    name: "Espace de mesure",
    type: "independent",
    disciplines: spec.space?.disciplines ?? [],
    trainingObjectives: spec.space?.objectives ?? [],
    availableEquipment: spec.space?.equipment ?? [],
    firstGroupName: groupSpecs[0]?.name ?? "Groupe",
  });
  await prisma.organization.update({
    where: { id: org.id },
    data: { plan: "pilot", aiPlannerEnabled: true, phasesEnabled: false },
  });
  await syncEntitlements(org.id, "pilot");
  // Le catalogue commun, par le même code que la première visite d'un espace.
  await ensureExerciseCatalog(coachId, org.id);

  const groups = new Map<string, string>();
  for (const [index, group] of groupSpecs.entries()) {
    const id =
      index === 0
        ? org.firstGroupId
        : (
            await prisma.group.create({
              data: {
                organizationId: org.id,
                name: group.name,
                coaches: { create: { userId: coachId, role: "lead" } },
              },
            })
          ).id;
    groups.set(foldName(group.name), id);
  }
  const athletes = new Map<string, string>();
  const athlete = async (name: string, groupId: string | null) => {
    const key = foldName(name);
    let id = athletes.get(key);
    if (!id) {
      const [firstName, ...rest] = name.trim().split(/\s+/);
      id = (
        await prisma.athlete.create({
          data: {
            organizationId: org.id,
            firstName: firstName!,
            lastName: rest.join(" ") || "Fictif",
            birthDate: new Date("2000-01-01T00:00:00Z"),
          },
        })
      ).id;
      athletes.set(key, id);
    }
    // Membre de longue date : la séance du jour simulé le concerne.
    if (groupId)
      await prisma.groupMember.upsert({
        where: { groupId_athleteId: { groupId, athleteId: id } },
        create: { groupId, athleteId: id, createdAt: new Date("2020-01-01T10:00:00Z") },
        update: {},
      });
  };
  for (const group of groupSpecs)
    for (const name of group.athletes) await athlete(name, groups.get(foldName(group.name))!);
  for (const name of [...(spec.space?.athletes ?? []), ...spec.recipients.athletes]) await athlete(name, null);

  const families = new Map<string, string | null>();
  for (const fiche of spec.library.private) {
    families.set(foldName(fiche.name), fiche.family ?? null);
    await saveExercise(coachId, org.id, {
      name: fiche.name,
      category: fiche.category,
      aliases: fiche.aliases ?? [],
      classification:
        fiche.movement || fiche.equipment
          ? { movement: fiche.movement ?? null, equipment: fiche.equipment ?? null }
          : null,
      strengthLoadKind: fiche.loadable ? "external_total" : null,
      tags: [],
      cues: [],
      defaultPrescription: {},
    });
  }
  const rows = await prisma.exercise.findMany({
    where: { OR: [{ organizationId: org.id }, { organizationId: null }], deletedAt: null },
    select: {
      id: true,
      name: true,
      catalogKey: true,
      sourceCatalogKey: true,
      classification: true,
      organizationId: true,
    },
  });
  // Références de force des athlètes du premier groupe, pour éprouver le pourcentage du maximum : la fiche de
  // l'espace si elle existe, sinon la fiche commune.
  const firstGroup = groupSpecs[0];
  if (firstGroup)
    for (const [key, valueKg] of Object.entries(REFERENCES)) {
      const fiche =
        rows.find((row) => row.organizationId === org.id && row.sourceCatalogKey === key) ??
        rows.find((row) => row.catalogKey === key);
      if (!fiche) continue;
      for (const name of firstGroup.athletes)
        await selectStrengthReference(coachId, org.id, athletes.get(foldName(name))!, fiche.id, {
          source: "working",
          valueKg,
        });
    }
  const library = new Map<string, LibraryEntry>();
  const byName = new Map<string, ObservedRef>();
  for (const row of rows) {
    // Une copie de l'espace représente sa fiche du catalogue : c'est la même fiche pour la mesure.
    const key = row.catalogKey ?? row.sourceCatalogKey;
    const ref: ObservedRef = key ? { kind: "catalog", key } : { kind: "private", name: row.name };
    const parsed = classification.safeParse(row.classification ?? null);
    library.set(row.id, {
      ref,
      family: key ? (catalogFamily.get(key) ?? null) : (families.get(foldName(row.name)) ?? null),
      equipment: parsed.success ? (parsed.data?.equipment ?? null) : null,
    });
    byName.set(foldName(row.name), ref);
  }
  return { coachId, organizationId: org.id, groups, athletes, library, byName };
}

type DraftNode =
  | { kind: "exercise"; itemRef: string }
  | { kind: "recovery"; durationS: number }
  | { kind: "repeat"; rounds: number; restBetweenRoundsS: number; children: DraftNode[] };
type Drafts = Awaited<ReturnType<typeof preparePlannerDrafts>>;
type DraftItem = Drafts["sessions"][number]["draft"]["blocks"][number]["items"][number];
const QUESTION_REASON: Record<string, ObservedQuestion["reason"]> = {
  target: "recipient",
  date: "date",
  exercise: "exercise",
  unit: "unit",
  rest: "rest",
  load: "load",
  other: "other",
};

/** La réponse du service et ses brouillons préparés, dans la forme que lit la notation. */
function observe(response: PlannerProposalResponse, drafts: Drafts | null, workspace: Workspace): Observed {
  const questions: ObservedQuestion[] = (response.interpretation?.questions ?? []).map((question) => ({
    // La question « hors sujet » se reconnaît à son identifiant : son champ, `other`, sert aussi à d'autres.
    reason: question.id === "off-topic" ? "off_topic" : (QUESTION_REASON[question.field] ?? "other"),
    exerciseName: question.exerciseName ?? null,
    options: question.options,
  }));
  const slots = new Map((drafts?.slots ?? []).map((slot) => [slot.itemRef, slot]));
  if (response.state === "clarification")
    return { status: "question", blocked: true, questions, sessions: [], error: null };
  if (response.state !== "proposal" || !drafts) return observedError(`state_${response.state}`);
  const targets = new Map(response.targets.map((target) => [target.id, target]));
  const sessions = drafts.sessions.map((session, index) => {
    const warnings = drafts.warnings[index] ?? [];
    const movement = (item: DraftItem): ObservedMovement => {
      // Un emplacement à compléter n'a pas de fiche : son exercice porte l'identifiant réservé et le terme dit.
      const slot = slots.get(item.ref ?? "");
      const entry =
        slot || item.exerciseId === PLANNER_SLOT_EXERCISE_ID ? undefined : workspace.library.get(item.exerciseId);
      const flags = warnings.filter((warning) => warning.itemRef === item.ref).map((warning) => warning.code);
      const p = item.prescription;
      const load = (value: typeof p.load) => (value ? { value: value.value, unit: value.type } : null);
      return {
        type: "movement",
        ref: entry?.ref ?? { kind: "placeholder", name: slot?.said ?? "" },
        toVerify: flags.includes("approximate_exercise"),
        flags,
        sets: p.sets ?? 1,
        reps: p.reps ?? null,
        durationS: p.duration_s ?? null,
        distanceM: p.distance_m ?? null,
        restS: p.rest_s ?? null,
        load: load(p.load),
        setPlan:
          p.setPlan?.map((set) => ({ reps: set.reps ?? null, load: load(set.load), warmup: set.warmup ?? false })) ??
          null,
        family: entry?.family ?? null,
        equipment: entry?.equipment ?? null,
      };
    };
    const steps = session.draft.blocks.flatMap((block): ObservedStep[] => {
      const items = new Map(block.items.map((item) => [item.ref, item]));
      const walk = (nodes: readonly DraftNode[]): ObservedStep[] =>
        nodes.flatMap((node): ObservedStep[] =>
          node.kind === "exercise"
            ? items.has(node.itemRef)
              ? [movement(items.get(node.itemRef)!)]
              : []
            : node.kind === "recovery"
              ? [{ type: "recovery", seconds: node.durationS }]
              : [
                  {
                    type: "group",
                    rounds: node.rounds,
                    restBetweenRoundsS: node.restBetweenRoundsS,
                    steps: walk(node.children),
                  },
                ],
        );
      return block.sequence ? walk(block.sequence) : block.items.map(movement);
    });
    const assigned = session.assignments.flatMap((assignment) => {
      const target = targets.get(assignment.targetId);
      return target ? [target] : [];
    });
    return {
      date: session.date,
      durationMin: session.draft.durationMin,
      recipients: {
        groups: assigned.filter((target) => target.type === "group").map((target) => target.label),
        athletes: assigned.filter((target) => target.type === "athlete").map((target) => target.label),
      },
      flags: warnings.filter((warning) => warning.itemRef === null).map((warning) => warning.code),
      steps,
    };
  });
  return { status: "sessions", blocked: false, questions, sessions, error: null };
}

// L'étape en cours, telle que le service la diffuse : c'est à elle que chaque appel au fournisseur est compté.
type Stage = "understand" | "match" | "compose" | "repair";

async function invoke(
  workspace: Workspace,
  request: { text: string; today: string; recipients: E2eRecipients },
): Promise<CaseOutcome> {
  // Milieu de matinée à Paris : « aujourd'hui » est bien la date du jour simulée.
  const now = new Date(`${request.today}T09:00:00.000Z`);
  // La fenêtre la plus large du contrat : la consigne dit sa date, l'outil n'en choisit aucune.
  const period = { from: request.today, to: addDays(request.today, 27) };
  const ids = (names: string[], known: Map<string, string>) =>
    names.flatMap((name) => (known.has(foldName(name)) ? [known.get(foldName(name))!] : []));
  const meter: Meter = { step: "start", calls: [], pending: [] };
  const timing: Timing = { firstEventMs: null, firstPlanMs: null, completeMs: 0, firstSummaryMs: null, stepsMs: {} };
  const started = performance.now();
  // Durée de chaque étape : de son ouverture à l'ouverture de la suivante.
  let opened = started;
  const enter = (stage: Stage) => {
    const at = performance.now();
    timing.firstEventMs ??= at - started;
    if (meter.step === stage) return;
    if (meter.step !== "start") timing.stepsMs![meter.step] = (timing.stepsMs![meter.step] ?? 0) + (at - opened);
    opened = at;
    meter.step = stage;
  };
  let observed: Observed;
  try {
    const response = await meters.run(meter, () =>
      createPlannerProposal(
        workspace.coachId,
        workspace.organizationId,
        {
          id: randomUUID(),
          requestedAt: now.toISOString(),
          reviewed: true,
          text: request.text,
          accepts: [...ACCEPTS],
          // Ni mode ni brief : le service comprend seul ce que la consigne demande.
          selection: {
            period,
            groupIds: ids(request.recipients.groups, workspace.groups),
            athleteIds: ids(request.recipients.athletes, workspace.athletes),
            // Aucune fiche choisie à la main : toute la bibliothèque.
            exerciseIds: [],
            phaseChoices: [],
          },
        },
        {
          clock: () => now,
          onUnderstanding: (summary) => {
            enter("understand");
            if (summary) timing.firstSummaryMs ??= performance.now() - started;
          },
          onMatching: (_movements, done) => enter(done ? "compose" : "match"),
          onPlan: (lines) => {
            enter("compose");
            if (lines.length) timing.firstPlanMs ??= performance.now() - started;
          },
          onChecking: (repairs) => enter(repairs ? "repair" : "compose"),
        },
      ),
    );
    if (meter.step !== "start")
      timing.stepsMs![meter.step] = (timing.stepsMs![meter.step] ?? 0) + (performance.now() - opened);
    const drafts =
      response.state === "proposal"
        ? await preparePlannerDrafts(workspace.coachId, workspace.organizationId, response.id, response.version, now)
        : null;
    observed = observe(response, drafts, workspace);
  } catch (error) {
    // Seul un code part dans le rapport : jamais un message du fournisseur, ni une consigne.
    observed = observedError(
      error instanceof AppError ? error.code : error instanceof z.ZodError ? "invalid_input" : "internal",
    );
    if (process.env.E2E_EVAL_DEBUG === "1" && !(error instanceof AppError)) console.error(error);
  }
  timing.completeMs = performance.now() - started;
  await Promise.all(meter.pending);
  return { observed, timing, usage: usageOf(meter.calls) };
}

/** Le pilote du service en place. `close` rend `fetch` tel qu'il était. */
export function createServiceDriver(): E2eDriver & { close: () => void } {
  const fake = fakePlannerEnabled();
  const restore = installMeter(!fake);
  // Toutes les paires visent la même bibliothèque de référence : un seul espace jetable pour elles.
  const pairSpaces = new Map<string, Promise<Workspace>>();
  return {
    provider: fake ? "fake" : "openai",
    limits: CURRENT_PIPELINE_LIMITS,
    close: restore,
    async runCase(input) {
      const workspace = await createWorkspace(input);
      return invoke(workspace, input);
    },
    async runPair(said, library): Promise<PairOutcome> {
      const key = JSON.stringify(library);
      if (!pairSpaces.has(key))
        pairSpaces.set(key, createWorkspace({ recipients: { groups: ["Groupe"], athletes: [] }, library }));
      const workspace = await pairSpaces.get(key)!;
      const meter: Meter = { step: "match", calls: [], pending: [] };
      const started = performance.now();
      const refOf = (exercise: { exerciseId: string } | null) =>
        (exercise ? workspace.library.get(exercise.exerciseId)?.ref : undefined) ?? null;
      let resolution: PairOutcome["resolution"] = { first: null, proposals: [], toVerify: false };
      let error: string | null = null;
      try {
        // L'étape « Retrouver » seule : le terme dit, la bibliothèque de l'espace, rien d'autre.
        const [match] = await meters.run(meter, () =>
          matchPlannerTerms(workspace.coachId, workspace.organizationId, [said]),
        );
        const first = match && match.confidence !== "absent" ? refOf(match.exercise) : null;
        resolution = {
          first,
          proposals: [first, ...(match?.alternatives ?? []).map(refOf)]
            .filter((ref): ref is ObservedRef => ref !== null)
            .slice(0, 3),
          toVerify: match?.confidence === "probable",
        };
      } catch (cause) {
        error = cause instanceof AppError ? cause.code : cause instanceof z.ZodError ? "invalid_input" : "internal";
        if (process.env.E2E_EVAL_DEBUG === "1" && !(cause instanceof AppError)) console.error(cause);
      }
      const completeMs = performance.now() - started;
      await Promise.all(meter.pending);
      return {
        resolution,
        timing: { firstEventMs: null, firstPlanMs: null, completeMs, stepsMs: { match: completeMs } },
        usage: usageOf(meter.calls),
        error,
      };
    },
  };
}
