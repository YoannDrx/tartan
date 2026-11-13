// Frozen inputs are deliberately separate from expectations used by the scorer.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { plannerInterpretation, plannerBrief } from "@tartan/contracts";
import { plannerSessionToDraft, sequenceOccurrences } from "@tartan/domain";
import { EXERCISE_CATALOG } from "@tartan/domain/exercise-catalog";
import type { PlannerProviderContext } from "../src/server/ai/provider";

const expectation = z
  .object({
    status: z.enum(["proposal", "clarification"]),
    date: z.string().optional(),
    field: z.string().optional(),
    unknownName: z.string().optional(),
    exercise: z.string().optional(),
    exercises: z.array(z.string()).optional(),
    order: z.array(z.string()).optional(),
    sets: z.number().optional(),
    reps: z.number().optional(),
    restS: z.number().optional(),
    durationS: z.number().optional(),
    distanceM: z.number().optional(),
    loadKg: z.number().optional(),
    load: z.null().optional(),
    count: z.number().optional(),
    unit: z.string().optional(),
    sides: z.string().optional(),
    betweenExercisesS: z.number().optional(),
    betweenRoundsS: z.number().optional(),
    finalRestS: z.number().optional(),
    explicitRecoveryS: z.number().optional(),
    maxGroupDepth: z.number().optional(),
  })
  .passthrough();
const testCase = z.object({
  id: z.string(),
  mode: z.enum(["format", "propose"]),
  text: z.string(),
  expected: expectation,
});
const corpusSchema = z.object({
  version: z.literal(1),
  frozenBeforePlannerChanges: z.literal(true),
  period: z.object({ from: z.string(), to: z.string() }),
  today: z.string(),
  timeZone: z.string(),
  selectedTargets: z.array(z.string()),
  cases: z.array(testCase).length(80),
});
export type IndependentCase = z.infer<typeof testCase>;
const raw = readFileSync(new URL("./independent/planner-80.json", import.meta.url));
export const independentHash = createHash("sha256").update(raw).digest("hex");
if (
  readFileSync(new URL("./independent/planner-80.sha256", import.meta.url), "utf8")
    .trim()
    .split(/\s/)[0] !== independentHash
)
  throw new Error("frozen_corpus_changed");
export const independentCorpus = corpusSchema.parse(JSON.parse(raw.toString()));
export const independentCatalog = EXERCISE_CATALOG.map((e, i) => ({
  ...e,
  token: `exercise_${i + 1}`,
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
}));
const byToken = new Map(independentCatalog.map((e) => [e.token, e]));

export function independentContext(test: IndependentCase): PlannerProviderContext {
  // Parse only the frozen user text. Never feed an expected answer to the provider.
  const briefText =
    test.mode === "propose"
      ? /: (.+)\. Durée (\d+) minutes\. Niveau (\w+)\. Matériel disponible : (.+)\.$/.exec(test.text)
      : null;
  const date = /mercredi 18 novembre 2026/.test(test.text) ? "2026-11-18" : null;
  const brief =
    test.mode === "propose"
      ? plannerBrief.parse({
          objective: briefText?.[1],
          date,
          durationMin: Number(briefText?.[2]),
          level: briefText?.[3],
          equipment: briefText?.[4]?.split(", "),
        })
      : undefined;
  return {
    mode: test.mode,
    brief,
    period: independentCorpus.period,
    today: independentCorpus.today,
    timeZone: independentCorpus.timeZone,
    targets: independentCorpus.selectedTargets.map((token) => ({ token, kind: "group", phase: null })),
    exercises: independentCatalog.map((e) => ({
      token: e.token,
      name: e.name,
      category: e.category,
      aliases: e.aliases ?? [],
      classification: e.classification,
      strengthLoadKind: e.strengthLoadKind,
    })),
    instructions: [test.text],
  };
}

export function scoreIndependentCase(test: IndependentCase, value: unknown) {
  const differences: string[] = [];
  const critical: string[] = [];
  const humanReviewRequired = test.mode === "propose";
  const result = () => ({ passed: differences.length === 0, differences, critical, humanReviewRequired });
  const parsed = plannerInterpretation.safeParse(value);
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
    if (actual.sessions.length && expected.field === "date") critical.push("false_date");
    if (items.some((i) => i.prescription.load !== null) && ["load", "unit"].includes(expected.field ?? ""))
      critical.push("invented_load");
    return result();
  }
  if (actual.sessions.length !== 1) differences.push("session_count");
  if (actual.questions.length) differences.push("unexpected_question");
  if (actual.sessions.some((s) => s.date !== expected.date)) {
    differences.push("date");
    critical.push("false_date");
  }
  if (
    actual.sessions.some(
      (s) =>
        JSON.stringify([...s.targetTokens].sort()) !== JSON.stringify([...independentCorpus.selectedTargets].sort()),
    )
  )
    differences.push("targets");
  if (items.some((i) => !byToken.has(i.exerciseToken))) {
    differences.push("unknown_catalog_token");
    critical.push("silent_substitution");
  }
  if (test.mode === "propose") {
    const brief = independentContext(test).brief!;
    if (!actual.assumptions.length) differences.push("assumptions");
    if (actual.sessions.some((s) => s.durationMin == null || s.durationMin > brief.durationMin))
      differences.push("duration");
    if (items.some((i) => i.prescription.load !== null)) {
      differences.push("unrequested_load");
      critical.push("invented_load");
    }
    if (!items.length) differences.push("empty_proposal");
    const normalize = (equipment: string) => ({ box: "boxes", stairs: "steps" })[equipment] ?? equipment;
    const available = new Set(brief.equipment.map(normalize));
    for (const item of items) {
      const equipment = byToken.get(item.exerciseToken)?.classification?.equipment ?? [];
      if (equipment.some((e) => !available.has(e))) differences.push("unavailable_equipment");
    }
    // Technical suitability, realism of duration and safety require independent coach review.
    return result();
  }
  const keys = items.map((i) => byToken.get(i.exerciseToken)?.catalogKey);
  if (expected.exercise && (items.length !== 1 || keys[0] !== expected.exercise)) {
    differences.push("exercise");
    if (keys.some((key) => key !== expected.exercise)) critical.push("silent_substitution");
  }
  if (expected.exercises && JSON.stringify(keys) !== JSON.stringify(expected.exercises)) {
    differences.push("distinct_exercises");
    if (items.length) critical.push("silent_substitution");
  }
  if (expected.exercise) {
    const first = items[0];
    for (const field of ["sets", "reps", "restS", "durationS", "distanceM"] as const)
      if (expected[field] !== undefined && first?.prescription[field] !== expected[field]) differences.push(field);
    const load = first?.prescription.load;
    if (expected.loadKg !== undefined && (load?.type !== "kg" || load.value !== expected.loadKg))
      differences.push("load");
    if (expected.load === null && load !== null) differences.push("load");
    if (load && (expected.loadKg === undefined || load.type !== "kg" || load.value !== expected.loadKg))
      critical.push("invented_load");
    if (expected.count !== undefined && first?.prescription.reps !== expected.count) differences.push("count");
    const guide = byToken.get(first?.exerciseToken ?? "")?.guide;
    if (expected.unit && guide?.counting.unit !== expected.unit) differences.push("counting_unit");
    if (
      expected.sides &&
      guide?.counting.sides !== expected.sides &&
      !/chaque|côté|cote|jambe/i.test(first?.prescription.notes ?? "")
    )
      differences.push("counting_sides");
  }
  if (expected.order && actual.sessions[0]) {
    try {
      const draft = plannerSessionToDraft(
        actual.sessions[0],
        new Map(independentCatalog.map((e) => [e.token, { id: e.id }])),
        "evaluation",
      );
      const byId = new Map(independentCatalog.map((e) => [e.id, e]));
      const expanded = draft.blocks.flatMap((b) => {
        const sources = new Map(b.items.map((i) => [i.ref, i]));
        return b.sequence
          ? sequenceOccurrences(b.sequence).map(({ node, rounds }) =>
              node.kind === "recovery"
                ? { kind: "rest" as const, seconds: node.durationS, rounds }
                : {
                    kind: "exercise" as const,
                    key: byId.get(sources.get(node.itemRef)!.exerciseId)!.catalogKey,
                    rounds,
                    sets: sources.get(node.itemRef)!.prescription.sets ?? 1,
                  },
            )
          : b.items.map((i) => ({
              kind: "exercise" as const,
              key: byId.get(i.exerciseId)!.catalogKey,
              rounds: [],
              sets: i.prescription.sets ?? 1,
            }));
      });
      const order = expanded.filter((e) => e.kind === "exercise").flatMap((e) => Array(e.sets).fill(e.key));
      if (JSON.stringify(order) !== JSON.stringify(expected.order)) differences.push("execution_order");
      const rests = expanded.filter((e) => e.kind === "rest");
      if (expected.explicitRecoveryS !== undefined && !rests.some((r) => r.seconds === expected.explicitRecoveryS))
        differences.push("explicit_recovery");
      if (expected.finalRestS !== undefined) {
        const last = expanded.at(-1);
        if ((last?.kind === "rest" ? last.seconds : 0) !== expected.finalRestS) differences.push("final_recovery");
      }
      if (
        expected.maxGroupDepth !== undefined &&
        Math.max(0, ...expanded.map((e) => e.rounds.length)) !== expected.maxGroupDepth
      )
        differences.push("group_depth");
      for (const [field, label] of [
        ["betweenExercisesS", "exercise_recovery"],
        ["betweenRoundsS", "round_recovery"],
      ] as const) {
        if (expected[field] === undefined) continue;
        const nodes = draft.blocks.flatMap((b) => b.sequence ?? []).filter((n) => n.kind === "repeat");
        if (
          field === "betweenRoundsS" &&
          !nodes.some((n) => n.kind === "repeat" && (n.restBetweenRoundsS ?? 0) === expected[field])
        )
          differences.push(label);
        if (field === "betweenExercisesS" && expected[field] !== 0 && !rests.some((r) => r.seconds === expected[field]))
          differences.push(label);
      }
    } catch {
      differences.push("invalid_sequence");
    }
  }
  return result();
}
