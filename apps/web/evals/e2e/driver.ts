// Le pilote : le seul fichier de la mesure qui touche à la base et au service du planificateur.
// Pour chaque cas, il crée un espace jetable (coach avec accord IA, groupes, athlètes, catalogue commun, fiches
// privées du cas), appelle le service comme le fait la route (`createPlannerProposal`, puis les brouillons
// préparés), écoute les événements diffusés, compte les appels au fournisseur et traduit la réponse en `Observed`.
// Il ne lit ni le prompt, ni les garde-fous, ni l'adaptateur : quand le service change, lui seul s'adapte.
// Prisma direct, comme `prisma/seed.ts` et `tests/helpers.ts` : là seulement où aucun service ne crée la donnée.
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PlannerBrief, PlannerProposalResponse } from "@tartan/contracts";
import { addDays, plannerDateHints, plannerDateReferences } from "@tartan/domain";
import { EXERCISE_CATALOG } from "@tartan/domain/exercise-catalog";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { fakePlannerEnabled } from "@/server/ai/fake-provider";
import { createPlannerProposal, preparePlannerDrafts } from "@/server/ai/proposal.service";
import { syncEntitlements } from "@/server/billing.service";
import { ensureExerciseCatalog } from "@/server/exercise-catalog.service";
import { saveExercise } from "@/server/exercise.service";
import { createOrganization } from "@/server/org.service";
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

/** Ce que l'outil a dû fournir ou contourner pour mesurer le pipeline en place. Écrit dans chaque rapport. */
export const CURRENT_PIPELINE_LIMITS = [
  "Le service exige un mode : il est déduit de `kind` (described et mixed → mise en forme, objective → proposer). Une consigne mixte n'a donc aucun moyen de faire composer la partie laissée libre.",
  "Le service exige une période choisie à l'écran : l'outil donne les sept jours à partir de la date du jour simulée. Une date citée au-delà ne peut pas être servie.",
  "En mode « Proposer », le service exige un brief (date, durée, niveau, matériel) que l'écran faisait remplir : l'outil le lit dans la consigne (date, durée, niveau) et dans le profil de l'espace (matériel), et note dans `legacy.assumed` ce qu'il a dû supposer.",
  "Une fiche absente devient une question bloquante : le service ne sait pas laisser un emplacement à compléter. Les cas `absent` en `mustNotAsk` échouent donc par construction.",
  "Aucune étape « retrouver les fiches » n'est exposée : une paire est mesurée par une consigne minimale (« Aujourd'hui : <terme>, 3 séries de 8 répétitions. »), la fiche de la séance vaut premier choix et les options d'une question valent propositions.",
  "Une demande sans destinataire est refusée avant tout appel, comme une saisie invalide : aucune question n'est posée.",
  "Un seul appel au modèle, plus une reprise au besoin : les jetons se répartissent entre les étapes « model » et « retry ». `--fast-model` n'a aucun effet.",
  "Le premier événement diffusé est l'étape « context », émise avant tout appel au modèle : le seuil de premier retour mesure un accusé de réception. Le premier contenu lisible est donné à part (`firstPlanMs`).",
  "Les pourcentages du maximum ne sont pas éprouvés : aucun athlète de l'espace jetable n'a de référence de force.",
];

// Lundi fictif : la date du jour simulée pour les paires, qui n'en portent pas.
const PAIR_TODAY = "2026-11-23";
const pairText = (said: string) => `Aujourd'hui : ${said}, 3 séries de 8 répétitions.`;

type Call = { step: string; model: string; inputTokens: number; cachedInputTokens: number; outputTokens: number };
type Meter = { step: string; calls: Call[]; pending: Promise<void>[] };
const meters = new AsyncLocalStorage<Meter>();

const usageShape = z.object({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  prompt_tokens: z.number().optional(),
  completion_tokens: z.number().optional(),
  input_tokens_details: z.object({ cached_tokens: z.number().optional() }).optional(),
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
    select: { id: true, name: true, catalogKey: true, sourceCatalogKey: true, classification: true },
  });
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
    reason: QUESTION_REASON[question.field] ?? "other",
    exerciseName: question.exerciseName ?? null,
    options: question.options,
  }));
  if (response.state === "clarification")
    return { status: "question", blocked: true, questions, sessions: [], error: null };
  if (response.state !== "proposal" || !drafts) return observedError(`state_${response.state}`);
  const targets = new Map(response.targets.map((target) => [target.id, target]));
  const sessions = drafts.sessions.map((session, index) => {
    const warnings = drafts.warnings[index] ?? [];
    const movement = (item: DraftItem): ObservedMovement => {
      // Un emplacement à compléter n'a pas de fiche : le service actuel n'en produit pas, le prochain le fera.
      const loose = item as { exerciseId?: string | null; name?: string };
      const entry = loose.exerciseId ? workspace.library.get(loose.exerciseId) : undefined;
      const flags = warnings.filter((warning) => warning.itemRef === item.ref).map((warning) => warning.code);
      const p = item.prescription;
      const load = (value: typeof p.load) => (value ? { value: value.value, unit: value.type } : null);
      return {
        type: "movement",
        ref: entry?.ref ?? { kind: "placeholder", name: loose.name ?? "" },
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

/** Le brief que l'écran « Proposer » faisait remplir, lu dans la consigne et le profil de l'espace. Jamais dans les attentes. */
export function legacyBrief(
  input: Pick<E2eCaseInput, "text" | "today" | "space">,
  period: { from: string; to: string },
): { brief: PlannerBrief; assumed: string[] } {
  const assumed: string[] = [];
  const text = foldName(input.text);
  const inPeriod = (date: string | undefined) => (date && date >= period.from && date <= period.to ? date : undefined);
  const references = plannerDateReferences(input.text, { today: input.today, period });
  const weekday = plannerDateHints(input.today, period).days.find((day) =>
    new RegExp(`(?<![a-z])${foldName(day.weekday)}(?![a-z])`).test(text),
  )?.date;
  let date = inPeriod(references.explicit[0]?.iso) ?? inPeriod(references.relative[0]) ?? weekday;
  if (!date) {
    date = period.from;
    assumed.push("date");
  }
  const hours = /(\d)\s*h(?:eures?)?\s*(\d{2})?(?![a-z])/.exec(text);
  const minutes = /(\d{1,3})\s*(?:minutes?|min|mn)(?![a-z])/.exec(text);
  let durationMin = hours ? Number(hours[1]) * 60 + Number(hours[2] ?? 0) : minutes ? Number(minutes[1]) : 0;
  if (!durationMin) {
    durationMin = 60;
    assumed.push("durationMin");
  }
  const level = /debutant/.test(text) ? "beginner" : /confirme|avance|expert/.test(text) ? "advanced" : null;
  if (!level) assumed.push("level");
  return {
    brief: {
      objective: input.text.slice(0, 1000),
      date,
      durationMin: Math.min(180, Math.max(5, durationMin)),
      level: level ?? "intermediate",
      equipment: input.space?.equipment ?? [],
    },
    assumed,
  };
}

async function invoke(
  workspace: Workspace,
  request: { text: string; today: string; kind: E2eCaseInput["kind"]; recipients: E2eRecipients; space?: E2eSpace },
): Promise<CaseOutcome> {
  // Milieu de matinée à Paris : « aujourd'hui » est bien la date du jour simulée.
  const now = new Date(`${request.today}T09:00:00.000Z`);
  const period = { from: request.today, to: addDays(request.today, 6) };
  const mode = request.kind === "objective" ? ("propose" as const) : ("format" as const);
  const derived = mode === "propose" ? legacyBrief(request, period) : null;
  const legacy = { mode, period, ...(derived ? { brief: derived.brief, assumed: derived.assumed } : {}) };
  const ids = (names: string[], known: Map<string, string>) =>
    names.flatMap((name) => (known.has(foldName(name)) ? [known.get(foldName(name))!] : []));
  const meter: Meter = { step: "start", calls: [], pending: [] };
  const timing: Timing = { firstEventMs: null, firstPlanMs: null, completeMs: 0 };
  const started = performance.now();
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
          selection: {
            mode,
            ...(derived ? { brief: derived.brief } : {}),
            period,
            groupIds: ids(request.recipients.groups, workspace.groups),
            athleteIds: ids(request.recipients.athletes, workspace.athletes),
            // Aucune fiche choisie à la main : toute la bibliothèque, triée par le service.
            exerciseIds: [],
            phaseChoices: [],
          },
        },
        {
          clock: () => now,
          onProgress: (progress) => {
            timing.firstEventMs ??= performance.now() - started;
            meter.step = progress.step;
          },
          onPlan: (lines) => {
            timing.firstEventMs ??= performance.now() - started;
            if (lines.length) timing.firstPlanMs ??= performance.now() - started;
          },
        },
      ),
    );
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
  return { observed, timing, usage: usageOf(meter.calls), legacy };
}

/** Le pilote du service en place. `close` rend `fetch` tel qu'il était. */
export function createServiceDriver(): E2eDriver & { close: () => void } {
  const fake = fakePlannerEnabled();
  const restore = installMeter(!fake);
  return {
    provider: fake ? "fake" : "openai",
    limits: CURRENT_PIPELINE_LIMITS,
    close: restore,
    async runCase(input) {
      const workspace = await createWorkspace(input);
      return invoke(workspace, input);
    },
    async runPair(said, library): Promise<PairOutcome> {
      const recipients = { groups: ["Groupe"], athletes: [] };
      const workspace = await createWorkspace({ recipients, library });
      const { observed, timing, usage } = await invoke(workspace, {
        text: pairText(said),
        today: PAIR_TODAY,
        kind: "described",
        recipients,
      });
      const fiche = (ref: ObservedRef) => ref.kind !== "placeholder";
      const movements = observed.sessions.flatMap((session) => {
        const flat = (steps: ObservedStep[]): ObservedMovement[] =>
          steps.flatMap((step) => (step.type === "movement" ? [step] : step.type === "group" ? flat(step.steps) : []));
        return flat(session.steps);
      });
      const first = movements[0] && fiche(movements[0].ref) ? movements[0] : null;
      // Les propositions : les fiches de la séance, sinon les options de la question posée.
      const options = observed.questions
        .flatMap((question) => question.options)
        .flatMap((name) => (workspace.byName.has(foldName(name)) ? [workspace.byName.get(foldName(name))!] : []));
      return {
        resolution: {
          first: first?.ref ?? null,
          proposals: [...movements.map((movement) => movement.ref).filter(fiche), ...options].slice(0, 3),
          toVerify: first?.toVerify ?? false,
        },
        timing,
        usage,
        error: observed.status === "error" ? observed.error : null,
      };
    },
  };
}
