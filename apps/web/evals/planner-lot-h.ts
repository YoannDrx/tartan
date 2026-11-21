// Jeu neuf du lot H : 20 cas écrits avant le nouveau prompt (séries détaillées, autonomie, ajustement, contexte).
// Les entrées sont figées par empreinte ; les attendus ne servent qu'à la notation, jamais au modèle.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { plannerBrief, plannerRichInterpretation, type PlannerGeneration } from "@tartan/contracts";
import { plannerSessionToDraft, sequenceOccurrences } from "@tartan/domain";
import type { PlannerProviderContext } from "../src/server/ai/provider";
import { independentCatalog } from "./planner-independent";

const exerciseRef = z.object({
  exercise: z.string(),
  sets: z.number().optional(),
  reps: z.number().optional(),
  loadKg: z.number().optional(),
  restS: z.number().optional(),
  durationS: z.number().optional(),
  distanceM: z.number().optional(),
});
const session = z.object({
  date: z.string(),
  title: z.string(),
  type: z.string(),
  blocks: z.array(z.object({ name: z.string(), items: z.array(exerciseRef) })),
});
const fields = z.object({
  sets: z.number().optional(),
  reps: z.number().optional(),
  loadKg: z.number().optional(),
  restS: z.number().optional(),
  durationS: z.number().optional(),
  distanceM: z.number().optional(),
});
const expectation = z
  .object({
    status: z.enum(["proposal", "clarification"]),
    date: z.string().optional(),
    startTime: z.string().optional(),
    field: z.string().optional(),
    unknownName: z.string().optional(),
    exercise: z.string().optional(),
    exercises: z.array(z.string()).optional(),
    includes: z.array(z.string()).optional(),
    excludes: z.array(z.string()).optional(),
    items: z.record(z.string(), fields).optional(),
    setPlan: z
      .array(
        z.object({
          reps: z.number(),
          loadKg: z.number().optional(),
          pct: z.number().optional(),
          warmup: z.boolean().optional(),
        }),
      )
      .optional(),
    uniformSets: z.boolean().optional(),
    autonomous: fields.extend({ exercise: z.string(), replaces: z.string().optional() }).optional(),
    loadPolicy: z.enum(["null", "pct_or_null"]).optional(),
    load: z.null().optional(),
    categoryAny: z.array(z.string()).optional(),
    categoryNone: z.array(z.string()).optional(),
    order: z.array(z.string()).optional(),
    betweenExercisesS: z.number().optional(),
    betweenRoundsS: z.number().optional(),
  })
  .extend(fields.shape)
  .strict();
const testCase = z
  .object({
    id: z.string(),
    mode: z.enum(["format", "propose"]),
    text: z.string(),
    brief: plannerBrief.optional(),
    previous: z.object({ text: z.string().optional(), session }).optional(),
    context: z
      .object({
        neighbours: z
          .array(z.object({ date: z.string(), type: z.string(), exercises: z.array(exerciseRef) }))
          .optional(),
        strength: z.array(z.object({ exercise: z.string(), coverage: z.enum(["all", "some", "none"]) })).optional(),
        space: z
          .object({ disciplines: z.array(z.string()), objectives: z.array(z.string()), equipment: z.array(z.string()) })
          .optional(),
      })
      .optional(),
    expected: expectation,
  })
  .strict();
export type LotHCase = z.infer<typeof testCase>;
const corpusSchema = z.object({
  version: z.literal(1),
  frozenBeforePlannerChanges: z.literal(true),
  provenance: z.string(),
  period: z.object({ from: z.string(), to: z.string() }),
  today: z.string(),
  timeZone: z.string(),
  selectedTargets: z.array(z.string()),
  cases: z.array(testCase).length(20),
});
const raw = readFileSync(new URL("./independent/planner-20-lot-h.json", import.meta.url));
export const lotHHash = createHash("sha256").update(raw).digest("hex");
if (
  readFileSync(new URL("./independent/planner-20-lot-h.sha256", import.meta.url), "utf8")
    .trim()
    .split(/\s/)[0] !== lotHHash
)
  throw new Error("frozen_corpus_changed");
export const lotHCorpus = corpusSchema.parse(JSON.parse(raw.toString()));

const byKey = new Map(independentCatalog.map((e) => [e.catalogKey, e]));
const byToken = new Map(independentCatalog.map((e) => [e.token, e]));
const tokenOf = (key: string) => {
  const exercise = byKey.get(key);
  if (!exercise) throw new Error(`unknown_catalog_key:${key}`);
  return exercise.token;
};
const prescription = (item: z.infer<typeof exerciseRef>) => ({
  sets: item.sets ?? null,
  reps: item.reps ?? null,
  distanceM: item.distanceM ?? null,
  durationS: item.durationS ?? null,
  restS: item.restS ?? null,
  load: item.loadKg !== undefined ? { type: "kg" as const, value: item.loadKg } : null,
  intensityTarget: null,
  tempo: null,
  contacts: null,
  notes: null,
  setPlan: null,
});

export function lotHContext(test: LotHCase, corpus = lotHCorpus): PlannerProviderContext {
  const originalText = test.previous?.text ?? test.brief?.objective ?? test.text;
  const instructions = test.previous ? [originalText, `Ajustement du coach : ${test.text}`] : [test.text];
  const previous: PlannerGeneration["sessions"] | undefined = test.previous
    ? [
        {
          date: test.previous.session.date,
          startTime: null,
          title: test.previous.session.title,
          type: test.previous.session.type as PlannerGeneration["sessions"][number]["type"],
          durationMin: null,
          targetTokens: corpus.selectedTargets,
          blocks: test.previous.session.blocks.map((block) => ({
            name: block.name,
            content: block.items.map((item) => ({
              kind: "exercise" as const,
              exerciseToken: tokenOf(item.exercise),
              instruction: test.mode === "propose" ? "Choix proposé pour l'objectif." : originalText,
              prescription: prescription(item),
              autonomous: null,
            })),
          })),
        },
      ]
    : undefined;
  return {
    mode: test.mode,
    ...(test.brief ? { brief: test.brief } : {}),
    period: corpus.period,
    today: corpus.today,
    timeZone: corpus.timeZone,
    targets: corpus.selectedTargets.map((token) => ({ token, kind: "group" as const, phase: null })),
    exercises: independentCatalog.map((e) => ({
      token: e.token,
      name: e.name,
      category: e.category,
      aliases: e.aliases ?? [],
      classification: e.classification,
      strengthLoadKind: e.strengthLoadKind,
    })),
    instructions,
    ...(previous ? { previous: { sessions: previous } } : {}),
    ...(test.context?.space ? { space: test.context.space } : {}),
    ...(test.context?.neighbours
      ? {
          neighbours: test.context.neighbours.map((n) => ({
            date: n.date,
            // Le corpus figé écrit « plyometrics » ; le type de séance du produit est « plyo ». Entrée seulement.
            type: n.type === "plyometrics" ? "plyo" : n.type,
            targetTokens: corpus.selectedTargets,
            exercises: n.exercises.map((item) => ({
              exerciseToken: tokenOf(item.exercise),
              sets: item.sets ?? null,
              reps: item.reps ?? null,
              distanceM: item.distanceM ?? null,
              durationS: item.durationS ?? null,
              load: item.loadKg !== undefined ? { type: "kg" as const, value: item.loadKg } : null,
            })),
          })),
        }
      : {}),
    ...(test.context?.strength
      ? {
          strength: test.context.strength.map((s) => ({ exerciseToken: tokenOf(s.exercise), coverage: s.coverage })),
        }
      : {}),
  } as PlannerProviderContext;
}

type Rich = z.infer<typeof plannerRichInterpretation>;
type Item = Rich["sessions"][number]["blocks"][number]["items"][number];
const keyOf = (token: string) => byToken.get(token)?.catalogKey;
const loadsOf = (item: Item) =>
  [item.prescription, ...(item.autonomous ? [item.autonomous.prescription] : [])].flatMap((p) => [
    ...(p.load ? [p.load] : []),
    ...(p.setPlan ?? []).flatMap((s) => (s.load ? [s.load] : [])),
  ]);

export function scoreLotHCase(test: LotHCase, value: unknown, corpus = lotHCorpus) {
  const differences: string[] = [];
  const critical: string[] = [];
  const result = () => ({
    passed: differences.length === 0,
    differences,
    critical,
    humanReviewRequired: test.mode === "propose",
  });
  const parsed = plannerRichInterpretation.safeParse(value);
  if (!parsed.success) {
    differences.push("schema");
    return result();
  }
  const actual = parsed.data,
    expected = test.expected;
  const items = actual.sessions.flatMap((s) => s.blocks.flatMap((b) => b.items));
  if (actual.status !== expected.status) differences.push("status");
  if (expected.status === "clarification") {
    if (actual.sessions.length) differences.push("sessions_must_be_empty");
    if (!actual.questions.some((q) => q.field === expected.field)) differences.push("question_field");
    if (
      expected.unknownName &&
      !actual.questions.some(
        (q) =>
          q.field === "exercise" &&
          q.exerciseName?.toLocaleLowerCase("fr") === expected.unknownName!.toLocaleLowerCase("fr"),
      )
    )
      differences.push("unknown_exercise_name");
    if (items.length && expected.field === "exercise") critical.push("silent_substitution");
    if (items.some((i) => loadsOf(i).length) && expected.field === "load") critical.push("invented_load");
    return result();
  }
  if (actual.sessions.length !== 1) differences.push("session_count");
  if (actual.questions.length) differences.push("unexpected_question");
  const session = actual.sessions[0];
  if (!session) return result();
  if (expected.date && session.date !== expected.date) {
    differences.push("date");
    critical.push("false_date");
  }
  if (JSON.stringify([...session.targetTokens].sort()) !== JSON.stringify([...corpus.selectedTargets].sort()))
    differences.push("targets");
  if (expected.startTime && session.startTime !== expected.startTime) differences.push("start_time");
  const keys = items.map((i) => keyOf(i.exerciseToken));
  const first = items[0];
  const compare = (
    label: string,
    prescriptionValue: Item["prescription"] | undefined,
    wanted: z.infer<typeof fields>,
  ) => {
    for (const field of ["sets", "reps", "restS", "durationS", "distanceM"] as const)
      if (wanted[field] !== undefined && prescriptionValue?.[field] !== wanted[field])
        differences.push(`${label}.${field}`);
    if (
      wanted.loadKg !== undefined &&
      (prescriptionValue?.load?.type !== "kg" || prescriptionValue.load.value !== wanted.loadKg)
    )
      differences.push(`${label}.load`);
  };
  if (expected.exercise) {
    if (items.length !== 1 || keys[0] !== expected.exercise) {
      differences.push("exercise");
      if (keys.some((k) => k !== expected.exercise)) critical.push("silent_substitution");
    }
    compare("item", first?.prescription, expected);
    if (expected.load === null && first?.prescription.load) differences.push("item.load");
  }
  if (expected.exercises && JSON.stringify(keys) !== JSON.stringify(expected.exercises)) differences.push("exercises");
  for (const key of expected.includes ?? []) if (!keys.includes(key)) differences.push(`includes.${key}`);
  for (const key of expected.excludes ?? []) if (keys.includes(key)) differences.push(`excludes.${key}`);
  for (const [key, wanted] of Object.entries(expected.items ?? {}))
    compare(key, items.find((i) => keyOf(i.exerciseToken) === key)?.prescription, wanted);
  if (expected.setPlan) {
    const plan = first?.prescription.setPlan ?? [];
    const same =
      plan.length === expected.setPlan.length &&
      expected.setPlan.every((set, index) => {
        const got = plan[index]!;
        const load =
          set.loadKg !== undefined
            ? got.load?.type === "kg" && got.load.value === set.loadKg
            : set.pct !== undefined
              ? got.load?.type === "pct_1rm" && got.load.value === set.pct
              : got.load === null;
        return got.reps === set.reps && load && Boolean(got.warmup) === Boolean(set.warmup);
      });
    if (!same) differences.push("set_plan");
    // Une charge de série absente de la consigne est une charge inventée.
    const stated = new Set(expected.setPlan.map((s) => s.loadKg ?? s.pct));
    if (plan.some((s) => s.load && !stated.has(s.load.value))) critical.push("invented_load");
  }
  if (expected.uniformSets) {
    const plan = first?.prescription.setPlan;
    if (plan && plan.some((s) => JSON.stringify(s) !== JSON.stringify(plan[0]))) differences.push("uniform_sets");
  }
  if (expected.autonomous) {
    const holder = items.find((i) => i.autonomous);
    if (!holder?.autonomous || keyOf(holder.autonomous.exerciseToken) !== expected.autonomous.exercise)
      differences.push("autonomous");
    else {
      compare("autonomous", holder.autonomous.prescription, expected.autonomous);
      if (expected.autonomous.replaces && keyOf(holder.exerciseToken) !== expected.autonomous.replaces)
        differences.push("autonomous.replaces");
    }
  }
  const loads = items.flatMap(loadsOf);
  if (expected.loadPolicy === "null" && loads.length) {
    differences.push("unrequested_load");
    critical.push("invented_load");
  }
  if (expected.loadPolicy === "pct_or_null" && loads.some((l) => l.type === "kg")) {
    differences.push("unrequested_load");
    critical.push("invented_load");
  }
  // Le corpus figé nomme les familles en mots courants ; le catalogue a ses clés. Correspondance de vocabulaire
  // ajoutée le 18 novembre après le premier passage (rapport d'origine conservé), sans toucher aux attendus.
  const family: Record<string, string> = { running: "running_drill", plyometrics: "plyo", coordination: "cones" };
  const wanted = (list: string[]) => list.map((c) => family[c] ?? c);
  const categories = items.map((i) => byToken.get(i.exerciseToken)?.category);
  if (expected.categoryAny && !categories.some((c) => c && wanted(expected.categoryAny!).includes(c)))
    differences.push("category_any");
  if (expected.categoryNone && categories.some((c) => c && wanted(expected.categoryNone!).includes(c)))
    differences.push("category_none");
  if (test.mode === "propose") {
    if (!items.length) differences.push("empty_proposal");
    if (session.durationMin === null || session.durationMin > test.brief!.durationMin) differences.push("duration");
    const normalize = (equipment: string) => ({ box: "boxes", stairs: "steps" })[equipment] ?? equipment;
    const available = new Set(test.brief!.equipment.map(normalize));
    for (const item of items)
      if ((byToken.get(item.exerciseToken)?.classification?.equipment ?? []).some((e) => !available.has(e)))
        differences.push("unavailable_equipment");
  }
  if (expected.order) {
    try {
      const draft = plannerSessionToDraft(
        session,
        new Map(independentCatalog.map((e) => [e.token, { id: e.id }])),
        "lot-h",
      );
      const byId = new Map(independentCatalog.map((e) => [e.id, e]));
      const order: string[] = [];
      const rests: number[] = [];
      for (const block of draft.blocks) {
        const sources = new Map(block.items.map((i) => [i.ref, i]));
        const steps = block.sequence
          ? sequenceOccurrences(block.sequence)
          : block.items.map((i) => ({ node: { kind: "exercise" as const, itemRef: i.ref! } }));
        for (const { node } of steps)
          if (node.kind === "recovery") rests.push(node.durationS);
          else if (node.kind === "exercise") {
            const item = sources.get(node.itemRef)!;
            order.push(...Array(item.prescription.sets ?? 1).fill(byId.get(item.exerciseId)!.catalogKey));
          }
      }
      if (JSON.stringify(order) !== JSON.stringify(expected.order)) differences.push("execution_order");
      if (expected.betweenExercisesS !== undefined && !rests.includes(expected.betweenExercisesS))
        differences.push("exercise_recovery");
      const repeats = draft.blocks.flatMap((b) => b.sequence ?? []).filter((n) => n.kind === "repeat");
      if (
        expected.betweenRoundsS !== undefined &&
        !repeats.some((n) => n.kind === "repeat" && n.restBetweenRoundsS === expected.betweenRoundsS)
      )
        differences.push("round_recovery");
    } catch {
      differences.push("invalid_sequence");
    }
  }
  return result();
}
