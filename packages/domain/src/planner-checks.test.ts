import type { PlannerComposedNode, PlannerComposition } from "@tartan/contracts";
import { describe, expect, it } from "vitest";
import { plannerCompositionToInterpretation, type PlannerComposeMovement } from "./planner-composition";
import { plannerCheckComposition, plannerSettleComposition, type PlannerCheckContext } from "./planner-guards";
import { plannerFillSlot, plannerOpenSlots, plannerRemoveSlot } from "./planner-slots";
import type { PlannerRequestSession } from "./planner-understanding";

// Étape « Contrôler » : la séance composée, confrontée à ce que le coach a dit.

const prescription = (patch: Partial<Extract<PlannerComposedNode, { kind: "exercise" }>["prescription"]> = {}) => ({
  sets: 3,
  reps: 8,
  distanceM: null,
  durationS: null,
  restS: null,
  load: null,
  intensityTarget: null,
  tempo: null,
  contacts: null,
  notes: null,
  setPlan: null,
  ...patch,
});
const exercise = (
  movementId: string | null,
  exerciseToken: string,
  patch: Parameters<typeof prescription>[0] = {},
): PlannerComposedNode => ({
  kind: "exercise",
  movementId,
  exerciseToken,
  prescription: prescription(patch),
  reason: movementId ? null : "Sert l'objectif.",
  autonomous: null,
});
const composition = (content: PlannerComposedNode[], durationMin: number | null = null): PlannerComposition => ({
  sessions: [{ index: 0, title: "Force", type: "strength", durationMin, blocks: [{ name: "Force", content }] }],
  assumptions: [],
  suggestions: [],
});
const movement = (id: string, said: string, exerciseToken: string, patch = {}): PlannerComposeMovement => ({
  id,
  session: 0,
  said,
  prescription: null,
  replaces: null,
  exerciseToken,
  confidence: "exact",
  alternatives: [],
  ...patch,
});
const requestSession = (movements: PlannerComposeMovement[], proposal: PlannerRequestSession["proposal"] = null) => ({
  date: "2026-11-24",
  dateSaid: "demain",
  startTime: null,
  targetTokens: ["group_1"],
  movements: movements.map(({ id, said, prescription: said2, replaces, session }) => ({
    id,
    said,
    prescription: said2,
    replaces,
    session,
  })),
  structure: null,
  proposal,
});
const context = (
  text: string,
  movements: PlannerComposeMovement[],
  extra: Partial<PlannerCheckContext> & { proposal?: PlannerRequestSession["proposal"] } = {},
): PlannerCheckContext => ({
  instructions: [text],
  request: { sessions: [requestSession(movements, extra.proposal ?? null)] },
  movements,
  percentTokens: new Set(),
  units: new Map(),
  fallbackTitle: "Séance",
  ...extra,
});
const frame = (movements: PlannerComposeMovement[]) => ({
  sessions: [{ date: "2026-11-24", startTime: null, targetTokens: ["group_1"] }],
  movements,
  proposedLabel: "Proposé",
});
const run = (answer: PlannerComposition, rules: PlannerCheckContext, final = false) => {
  const converted = plannerCompositionToInterpretation(answer, frame([...rules.movements]));
  return plannerCheckComposition(converted.value, converted.indexes, rules, final);
};
const itemsOf = (value: { sessions: { blocks: { items: unknown[] }[] }[] }) =>
  value.sessions.flatMap((s) => s.blocks.flatMap((b) => b.items)) as {
    exerciseToken: string;
    origin?: string;
    prescription: ReturnType<typeof prescription>;
  }[];

const squat = movement("m1", "squat arrière", "exercise_1");
const bench = movement("m2", "développé couché", "exercise_2");

describe("ce que le coach a dit ne change pas", () => {
  it("un mouvement cité porte la fiche retrouvée pour lui, quoi qu'écrive le modèle", () => {
    const checked = run(
      composition([exercise("m1", "exercise_9")]),
      context("Demain squat arrière 3 séries de 8.", [squat]),
    );
    expect(itemsOf(checked.value)).toMatchObject([{ exerciseToken: "exercise_1", origin: "said" }]);
    expect(checked.defects).toEqual([]);
  });
  it("la date et les destinataires viennent de la compréhension, jamais du modèle", () => {
    const { value } = plannerCompositionToInterpretation(composition([exercise("m1", "exercise_1")]), frame([squat]));
    expect(value.sessions[0]).toMatchObject({ date: "2026-11-24", targetTokens: ["group_1"] });
  });
  it("une fiche que le modèle n'a pas reçue n'existe pas : l'exercice disparaît, le groupe vidé aussi", () => {
    const answer = composition([
      exercise("m1", "exercise_404"),
      exercise(null, "exercise_7"),
      exercise(null, "exercise_404"),
      {
        kind: "repeat",
        name: "Circuit",
        rounds: 3,
        restBetweenRoundsS: 60,
        children: [exercise(null, "exercise_405"), { kind: "recovery", durationS: 30 }],
      } as PlannerComposedNode,
    ]);
    const { value } = plannerCompositionToInterpretation(answer, {
      ...frame([squat]),
      tokens: new Set(["exercise_1", "exercise_7"]),
    });
    // Le mouvement cité garde la fiche retrouvée pour lui ; la fiche proposée connue reste ; le reste disparaît.
    expect(itemsOf(value).map((item) => item.exerciseToken)).toEqual(["exercise_1", "exercise_7"]);
    expect(value.sessions[0]!.blocks[0]!.sequence).toBeNull();
  });
  it("un exercice ajouté dans une séance décrite est retiré, sans réparation", () => {
    const checked = run(
      composition([exercise("m1", "exercise_1"), exercise(null, "exercise_7")]),
      context("Demain squat arrière 3 séries de 8.", [squat]),
    );
    expect(itemsOf(checked.value)).toHaveLength(1);
    expect(checked.defects).toEqual([]);
  });
  it("dans une demande mixte, une fiche que le coach a citée n'est pas proposée une seconde fois", () => {
    const proposal = { objective: "Échauffement", durationMin: 10, level: null, equipment: [], families: [] };
    const checked = run(
      composition([
        exercise(null, "exercise_7"),
        exercise(null, "exercise_1"),
        exercise("m1", "exercise_1", { reps: 5 }),
      ]),
      context("Demain un échauffement à ta façon puis squat arrière 5 séries de 5.", [squat], { proposal }),
    );
    expect(itemsOf(checked.value)).toMatchObject([
      { exerciseToken: "exercise_7", origin: "proposed" },
      { exerciseToken: "exercise_1", origin: "said", prescription: { reps: 5 } },
    ]);
  });
  it("un mouvement cité qui manque, ou hors de l'ordre dit, est un défaut précis", () => {
    const rules = context("Demain squat arrière 3 séries de 8 puis développé couché 4 fois 6.", [squat, bench]);
    expect(run(composition([exercise("m2", "exercise_2")]), rules).defects).toMatchObject([
      { code: "missing_movement", session: 0, movementId: "m1" },
    ]);
    expect(run(composition([exercise("m2", "exercise_2"), exercise("m1", "exercise_1")]), rules).defects).toMatchObject(
      [{ code: "order", session: 0 }],
    );
  });
  it("après la dernière réparation, un mouvement manquant revient avec sa fiche, à compléter", () => {
    const rules = context("Demain squat arrière 3 séries de 8 puis développé couché 4 fois 6.", [
      squat,
      { ...bench, prescription: "4 fois 6" },
    ]);
    const settled = plannerSettleComposition(run(composition([exercise("m1", "exercise_1")]), rules), rules)!;
    expect(itemsOf(settled.value)).toMatchObject([
      { exerciseToken: "exercise_1" },
      { exerciseToken: "exercise_2", prescription: { sets: null, reps: null, notes: "4 fois 6" } },
    ]);
    expect(settled.value.sessions[0]!.warnings).toContainEqual(
      expect.objectContaining({ code: "to_complete", block: 0, item: 1 }),
    );
  });
  it("un mouvement resté manquant est posé à sa place dans l'ordre dit, pas à la fin, et les points suivent", () => {
    const rows = movement("m3", "rowing barre", "exercise_3");
    const rules = context(
      "Demain squat arrière 3 séries de 8, développé couché 4 fois 6 à 70, rowing barre 3 fois 10.",
      [squat, { ...bench, prescription: "4 fois 6 à 70" }, rows],
    );
    // Le modèle a oublié le premier mouvement ; le second porte une charge dite sans unité, donc un point à lui.
    const checked = run(
      composition([
        exercise("m2", "exercise_2", { load: { type: "kg", value: 70 } }),
        exercise("m3", "exercise_3", { reps: 10 }),
      ]),
      rules,
      true,
    );
    const settled = plannerSettleComposition(checked, rules)!;
    expect(itemsOf(settled.value).map((item) => item.exerciseToken)).toEqual([
      "exercise_1",
      "exercise_2",
      "exercise_3",
    ]);
    expect(settled.value.sessions[0]!.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "to_complete", block: 0, item: 0 }),
        expect.objectContaining({ code: "load_unclear", block: 0, item: 1 }),
      ]),
    );
  });
});

describe("charges", () => {
  it("garde une charge dite avec son unité", () => {
    const checked = run(
      composition([exercise("m1", "exercise_1", { load: { type: "kg", value: 60 } })]),
      context("Demain squat arrière 4 fois 6 à soixante kilos.", [squat]),
    );
    expect(itemsOf(checked.value)[0]!.prescription.load).toEqual({ type: "kg", value: 60 });
    expect(checked.defects).toEqual([]);
  });
  it("une charge dite sans unité est laissée vide et signalée, jamais devinée", () => {
    const rules = context("Demain squat arrière 4 fois 6 à 70.", [squat]);
    const checked = run(composition([exercise("m1", "exercise_1", { load: { type: "kg", value: 70 } })]), rules);
    expect(itemsOf(checked.value)[0]!.prescription.load).toBeNull();
    expect(checked.defects).toEqual([]);
    expect(plannerSettleComposition(checked, rules)!.value.sessions[0]!.warnings).toContainEqual(
      expect.objectContaining({ code: "load_unclear", field: "load", block: 0, item: 0, detail: "70" }),
    );
  });
  it("l'unité dite une fois vaut pour toute l'énumération des séries détaillées", () => {
    const set = (reps: number, value: number) => ({
      reps,
      load: { type: "kg" as const, value },
      warmup: false,
    });
    const checked = run(
      composition([
        exercise("m1", "exercise_1", {
          sets: 4,
          reps: null,
          load: { type: "kg", value: 40 },
          setPlan: [set(3, 40), set(3, 50), set(2, 55), set(1, 60)],
        }),
      ]),
      context("Demain squat arrière en montée, 3 répétitions à 40 kg, 3 à 50, 2 à 55, 1 à 60.", [squat]),
    );
    expect(itemsOf(checked.value)[0]!.prescription.setPlan!.map((entry: { load: unknown }) => entry.load)).toEqual([
      { type: "kg", value: 40 },
      { type: "kg", value: 50 },
      { type: "kg", value: 55 },
      { type: "kg", value: 60 },
    ]);
    expect(checked.defects).toEqual([]);
    // Sans aucune unité dite, rien n'est deviné : chaque charge reste vide et signalée.
    const bare = run(
      composition([exercise("m1", "exercise_1", { sets: 2, setPlan: [set(3, 40), set(3, 50)] })]),
      context("Demain squat arrière, 3 répétitions à 40, 3 à 50.", [squat]),
    );
    expect(itemsOf(bare.value)[0]!.prescription.setPlan!.map((entry: { load: unknown }) => entry.load)).toEqual([
      null,
      null,
    ]);
  });
  it("une montée dictée en toutes lettres garde chacune de ses charges", () => {
    const set = (reps: number, value: number) => ({ reps, load: { type: "kg" as const, value }, warmup: false });
    const rules = context(
      "jeudi squat arrière deux reps à soixante kilos deux à soixante-dix une à quatre-vingts une à quatre-vingt-cinq",
      [squat],
    );
    const checked = run(
      composition([
        exercise("m1", "exercise_1", {
          sets: 4,
          reps: null,
          load: { type: "kg", value: 60 },
          setPlan: [set(2, 60), set(2, 70), set(1, 80), set(1, 85)],
        }),
      ]),
      rules,
    );
    expect(itemsOf(checked.value)[0]!.prescription.setPlan!.map((entry: { load: unknown }) => entry.load)).toEqual([
      { type: "kg", value: 60 },
      { type: "kg", value: 70 },
      { type: "kg", value: 80 },
      { type: "kg", value: 85 },
    ]);
    expect(checked.defects).toEqual([]);
    expect(plannerSettleComposition(checked, rules)!.value.sessions[0]!.warnings).toEqual([]);
  });
  it("une charge dite avec l'autre unité reprend l'unité du coach", () => {
    const checked = run(
      composition([exercise("m1", "exercise_1", { load: { type: "kg", value: 80 } })]),
      context("Demain squat arrière 5 fois 5 à 80 %.", [squat]),
    );
    expect(itemsOf(checked.value)[0]!.prescription.load).toEqual({ type: "pct_1rm", value: 80 });
  });
  it("une charge jamais dite est un défaut à réparer, puis retirée et signalée", () => {
    const rules = context("Demain squat arrière 4 fois 6.", [squat]);
    const answer = composition([exercise("m1", "exercise_1", { load: { type: "kg", value: 100 } })]);
    expect(run(answer, rules).defects).toMatchObject([{ code: "invented_load", movementId: "m1" }]);
    const final = run(answer, rules, true);
    expect(final.defects).toEqual([]);
    expect(itemsOf(final.value)[0]!.prescription.load).toBeNull();
    expect(final.value.sessions[0]!.warnings).toContainEqual(expect.objectContaining({ code: "load_unclear" }));
  });
  it("ce qui est proposé n'a jamais de kilos, et un pourcentage seulement si chaque destinataire a sa référence", () => {
    const proposal = { objective: "Force", durationMin: 40, level: null, equipment: [], families: [] };
    const answer = composition([
      exercise(null, "exercise_1", { load: { type: "kg", value: 60 } }),
      exercise(null, "exercise_2", { load: { type: "pct_1rm", value: 75 } }),
      exercise(null, "exercise_3", { load: { type: "pct_1rm", value: 75 } }),
    ]);
    const rules = context("Demain, une séance de force à 60 kg.", [], {
      proposal,
      percentTokens: new Set(["exercise_2"]),
    });
    const checked = run(answer, rules);
    expect(itemsOf(checked.value).map((item) => item.prescription.load)).toEqual([
      null,
      { type: "pct_1rm", value: 75 },
      null,
    ]);
    expect(checked.defects).toEqual([]);
  });
});

describe("unités et durée", () => {
  it("un nombre sans unité se range selon l'unité de comptage de la fiche, et se signale", () => {
    const plank = movement("m1", "gainage", "exercise_4");
    const rules = context("Demain trois fois vingt de gainage.", [plank], {
      units: new Map([["exercise_4", "seconds" as const]]),
    });
    const checked = run(composition([exercise("m1", "exercise_4", { reps: 20 })]), rules);
    expect(itemsOf(checked.value)[0]!.prescription).toMatchObject({ reps: null, durationS: 20 });
    expect(checked.value.sessions[0]!.warnings).toContainEqual(
      expect.objectContaining({ code: "unit_assumed", block: 0, item: 0, detail: "20" }),
    );
  });
  it("une quantité dite avec son unité n'est pas touchée", () => {
    const plank = movement("m1", "gainage", "exercise_4");
    const checked = run(
      composition([exercise("m1", "exercise_4", { reps: null, durationS: 30 })]),
      context("Demain gainage 3 fois 30 secondes.", [plank], { units: new Map([["exercise_4", "seconds" as const]]) }),
    );
    expect(itemsOf(checked.value)[0]!.prescription).toMatchObject({ reps: null, durationS: 30 });
    expect(checked.value.sessions[0]!.warnings).toEqual([]);
  });
  it("la durée demandée borne la séance proposée", () => {
    const proposal = { objective: "Tronc", durationMin: 40, level: null, equipment: [], families: [] };
    const rules = context("Jeudi, renforcement du tronc, 40 minutes.", [], { proposal });
    const settled = plannerSettleComposition(run(composition([exercise(null, "exercise_4")], 55), rules), rules)!;
    expect(settled.value.sessions[0]!.durationMin).toBe(40);
  });
});

describe("séance vide ou manquante", () => {
  it("une séance de la compréhension sans séance composée est un défaut", () => {
    const rules = context("Demain squat arrière 3 séries de 8.", [squat]);
    expect(run({ sessions: [], assumptions: [], suggestions: [] }, rules).defects).toMatchObject([
      { code: "missing_session", session: 0 },
    ]);
  });
  it("une séance d'objectif sans exercice ne s'invente pas ; une séance décrite se pose mouvement par mouvement", () => {
    const empty = { sessions: [], assumptions: [], suggestions: [] };
    const proposal = { objective: "Tronc", durationMin: null, level: null, equipment: [], families: [] };
    const objective = context("Demain, du tronc.", [], { proposal });
    expect(plannerSettleComposition(run(empty, objective), objective)).toBeNull();
    const described = context("Demain squat arrière 3 séries de 8.", [squat]);
    const settled = plannerSettleComposition(run(empty, described), described)!;
    expect(itemsOf(settled.value)).toMatchObject([{ exerciseToken: "exercise_1", origin: "said" }]);
  });
});

describe("fiche probable et emplacement à compléter", () => {
  const lunge = movement("m1", "fentes", "exercise_5", { confidence: "probable", alternatives: ["exercise_6"] });
  const copenhagen = movement("m2", "planche Copenhague", "slot_1", {
    confidence: "absent",
    alternatives: ["exercise_4"],
    suggestion: { name: "Planche Copenhague", category: "strength", movement: "trunk", loadKind: "bodyweight" },
  });
  const rules = context("Demain fentes 3 séries de 10, puis planche Copenhague 3 fois 20 secondes.", [
    lunge,
    copenhagen,
  ]);
  const settled = plannerSettleComposition(
    run(
      composition([
        exercise("m1", "exercise_5", { reps: 10 }),
        exercise("m2", "slot_1", { reps: null, durationS: 20 }),
      ]),
      rules,
    ),
    rules,
  )!.value;
  it("une fiche probable est posée et signalée, avec les autres fiches possibles", () => {
    expect(settled.sessions[0]!.blocks[0]!.items[0]).toMatchObject({
      exerciseToken: "exercise_5",
      confidence: "probable",
      alternatives: ["exercise_6"],
    });
    expect(settled.sessions[0]!.warnings).toContainEqual(
      expect.objectContaining({ code: "approximate_exercise", block: 0, item: 0, detail: "exercise_5" }),
    );
  });
  it("une fiche absente laisse un emplacement à sa place, avec le terme dit et sa prescription", () => {
    expect(plannerOpenSlots(settled)).toEqual([
      {
        id: "slot_1",
        said: "planche Copenhague",
        session: 0,
        block: 0,
        item: 1,
        alternatives: ["exercise_4"],
        suggestion: { name: "Planche Copenhague", category: "strength", movement: "trunk", loadKind: "bodyweight" },
      },
    ]);
    expect(settled.sessions[0]!.blocks[0]!.items[1]!.prescription).toMatchObject({ sets: 3, durationS: 20 });
  });
  it("remplir l'emplacement garde la prescription ; le retirer garde le reste de la séance", () => {
    const filled = plannerFillSlot(settled, "slot_1", "exercise_8");
    expect(plannerOpenSlots(filled)).toEqual([]);
    expect(filled.sessions[0]!.blocks[0]!.items[1]).toMatchObject({
      exerciseToken: "exercise_8",
      confidence: "exact",
      prescription: { sets: 3, durationS: 20 },
    });
    expect(filled.sessions[0]!.blocks[0]!.items[1]).not.toHaveProperty("suggestion");
    const removed = plannerRemoveSlot(settled, "slot_1")!;
    expect(removed.sessions[0]!.blocks[0]!.items).toHaveLength(1);
    expect(removed.sessions[0]!.warnings).toContainEqual(expect.objectContaining({ code: "approximate_exercise" }));
  });
  it("un emplacement qui est le seul exercice ne se retire pas : une séance vide ne se crée pas", () => {
    const alone = context("Demain planche Copenhague 3 fois 20 secondes.", [{ ...copenhagen, id: "m1" }]);
    const only = plannerSettleComposition(
      run(composition([exercise("m1", "slot_1", { reps: null, durationS: 20 })]), alone),
      alone,
    )!.value;
    expect(plannerRemoveSlot(only, "slot_1")).toBeNull();
  });
  it("retirer un emplacement d'un circuit garde les tours et les autres exercices", () => {
    const circuit: PlannerComposedNode = {
      kind: "repeat",
      name: "Circuit",
      rounds: 3,
      restBetweenRoundsS: 60,
      children: [exercise("m1", "exercise_5", { sets: 1 }), exercise("m2", "slot_1", { sets: 1 })] as never,
    };
    const inCircuit = context("Demain circuit 3 tours : fentes, planche Copenhague, 60 secondes entre les tours.", [
      lunge,
      copenhagen,
    ]);
    const value = plannerSettleComposition(run(composition([circuit]), inCircuit), inCircuit)!.value;
    const removed = plannerRemoveSlot(value, "slot_1")!;
    expect(removed.sessions[0]!.blocks[0]).toMatchObject({
      items: [{ exerciseToken: "exercise_5" }],
      sequence: [{ kind: "repeat", rounds: 3, children: [{ kind: "exercise" }] }],
    });
  });
});
