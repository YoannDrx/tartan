import {
  PLANNER_SLOT_EXERCISE_ID,
  type PlannerReviewedDraft,
  type PlannerRichInterpretation,
  type PlannerRichPrescription,
} from "@tartan/contracts";
import { describe, expect, it } from "vitest";
import { plannerSessionToDraft } from "./ai-planner";
import { plannerSessionMovements, plannerSessionToComposition } from "./planner-composition";
import { plannerPrescriptionFromSession, plannerRebaseOnDrafts, type PlannerRebaseContext } from "./planner-rebase";
import { plannerDraftItemPlace, plannerOpenSlots, plannerProbableItem, plannerSettleProbable } from "./planner-slots";

// « Ajuster » et le retrait d'un emplacement repartent de la séance à l'écran, pas de celle que le modèle a écrite.

const SQUAT = "11111111-1111-4111-8111-111111111111";
const FENTE = "22222222-2222-4222-8222-222222222222";
const TIRAGE = "33333333-3333-4333-8333-333333333333";
const GROUP = "44444444-4444-4444-8444-444444444444";
const ATHLETE = "55555555-5555-4555-8555-555555555555";
const PREFIX = "ai-99999999-9999-4999-8999-999999999999";

const prescription = (patch: Partial<PlannerRichPrescription> = {}): PlannerRichPrescription => ({
  sets: 3,
  reps: 8,
  distanceM: null,
  durationS: null,
  restS: 90,
  load: null,
  intensityTarget: null,
  tempo: null,
  contacts: null,
  notes: null,
  setPlan: null,
  ...patch,
});
const stored: PlannerRichInterpretation = {
  status: "proposal",
  questions: [],
  assumptions: ["Une hypothèse."],
  suggestions: [],
  understanding: { intent: "described", summary: "Tu décris une séance.", movements: [], corrections: [] },
  sessions: [
    {
      date: "2030-06-03",
      startTime: null,
      title: "Force",
      type: "strength",
      durationMin: 45,
      targetTokens: ["group_1"],
      blocks: [
        {
          name: "Force",
          sequence: null,
          items: [
            {
              ref: "node-0",
              exerciseToken: "exercise_1",
              prescription: prescription({ load: { type: "kg", value: 60 } }),
              instruction: "squat, 3 x 8 à 60 kg",
              origin: "said",
              movementId: "m1",
              said: "squat",
              confidence: "exact",
              autonomous: null,
            },
            {
              ref: "node-1",
              exerciseToken: "exercise_2",
              prescription: prescription(),
              instruction: "fente, 3 x 8",
              origin: "said",
              movementId: "m2",
              said: "fente",
              confidence: "probable",
              alternatives: ["exercise_3"],
              autonomous: null,
            },
            {
              ref: "node-2",
              exerciseToken: "slot_1",
              prescription: prescription({ reps: 5 }),
              instruction: "saut du dragon, 3 x 5",
              origin: "said",
              movementId: "m3",
              said: "saut du dragon",
              confidence: "absent",
              suggestion: { name: "Saut du dragon", category: "plyo", movement: "other", loadKind: "bodyweight" },
              autonomous: null,
            },
          ],
        },
      ],
      warnings: [
        { code: "approximate_exercise", field: "exercise", block: 0, item: 1, detail: "exercise_2" },
        { code: "habit_rest", field: "rest", block: null, item: null, detail: null },
      ],
    },
  ],
};
const context: PlannerRebaseContext = {
  refPrefix: PREFIX,
  exerciseTokens: new Map([
    [SQUAT, "exercise_1"],
    [FENTE, "exercise_2"],
    [TIRAGE, "exercise_3"],
  ]),
  exerciseNames: new Map([
    ["exercise_1", "Squat arrière"],
    ["exercise_2", "Fente avant"],
    ["exercise_3", "Tirage corde"],
  ]),
  targetTokens: new Map([
    [`group:${GROUP}`, "group_1"],
    [`athlete:${ATHLETE}`, "athlete_1"],
  ]),
  slotExerciseId: PLANNER_SLOT_EXERCISE_ID,
};
// Les brouillons que le serveur prépare pour l'écran, dans l'éditeur de séquence.
const screen = (): PlannerReviewedDraft => ({
  date: "2030-06-03",
  startTime: null,
  location: null,
  publishAt: null,
  assignments: [{ targetType: "group", targetId: GROUP }],
  overrides: [],
  draft: plannerSessionToDraft(
    stored.sessions[0]!,
    new Map([
      ["exercise_1", { id: SQUAT }],
      ["exercise_2", { id: FENTE }],
      ["exercise_3", { id: TIRAGE }],
      ["slot_1", { id: PLANNER_SLOT_EXERCISE_ID }],
    ]),
    `${PREFIX}-0`,
    { structured: true },
  ),
});
const itemsOf = (value: PlannerRichInterpretation) => value.sessions[0]!.blocks.flatMap((block) => block.items);

describe("la séance à l'écran devient la base", () => {
  it("un écran non retouché redonne la séance gardée, doutes et emplacement compris", () => {
    const rebased = plannerRebaseOnDrafts(stored, [screen()], context)!;
    expect(rebased.value).toEqual(stored);
    expect([...rebased.refs]).toEqual([
      [`${PREFIX}-0-b0-i0`, `${PREFIX}-0-b0-i0`],
      [`${PREFIX}-0-b0-i1`, `${PREFIX}-0-b0-i1`],
      [`${PREFIX}-0-b0-i2`, `${PREFIX}-0-b0-i2`],
    ]);
  });

  it("garde une prescription retouchée, une fiche remplacée, un exercice ajouté et l'ordre de l'écran", () => {
    const draft = screen();
    const [squat, fente, slot] = draft.draft.blocks[0]!.items;
    const added = { ref: "ajout-1", exerciseId: TIRAGE, prescription: { sets: 2, reps: 12 } };
    draft.date = "2030-06-04";
    draft.startTime = "18:30";
    draft.assignments = [{ targetType: "athlete", targetId: ATHLETE }];
    draft.draft.title = "Force du mardi";
    draft.draft.blocks[0]!.items = [
      { ...squat!, prescription: { ...squat!.prescription, sets: 5, load: { type: "kg", value: 70 } } },
      // Le coach a remplacé la fiche rapprochée par une autre.
      { ...fente!, exerciseId: TIRAGE },
      slot!,
      added,
    ];
    // L'exercice ajouté passe en tête, dans un superset avec le squat.
    draft.draft.blocks[0]!.sequence = [
      {
        kind: "repeat",
        ref: "tour-1",
        name: "Superset",
        rounds: 3,
        restBetweenRoundsS: 60,
        children: [
          { kind: "exercise", itemRef: added.ref },
          { kind: "exercise", itemRef: squat!.ref! },
        ],
      },
      { kind: "exercise", itemRef: fente!.ref! },
      { kind: "exercise", itemRef: slot!.ref! },
    ];
    const rebased = plannerRebaseOnDrafts(stored, [draft], context)!;
    const [session] = rebased.value.sessions;
    expect(session).toMatchObject({
      date: "2030-06-04",
      startTime: "18:30",
      title: "Force du mardi",
      targetTokens: ["athlete_1"],
    });
    expect(itemsOf(rebased.value)).toMatchObject([
      // Ajouté à la main : c'est le mouvement du coach, sous le nom de sa fiche.
      {
        exerciseToken: "exercise_3",
        origin: "said",
        movementId: "m4",
        said: "Tirage corde",
        confidence: "exact",
        prescription: { sets: 2, reps: 12, restS: null },
      },
      { exerciseToken: "exercise_1", movementId: "m1", said: "squat", prescription: { sets: 5, load: { value: 70 } } },
      // La fiche changée garde le terme dit, sans le doute ni les autres fiches.
      { exerciseToken: "exercise_3", movementId: "m2", said: "fente", confidence: "exact" },
      { exerciseToken: "slot_1", movementId: "m3", said: "saut du dragon", suggestion: { name: "Saut du dragon" } },
    ]);
    expect(itemsOf(rebased.value)[2]).not.toHaveProperty("alternatives");
    expect(session!.blocks[0]!.sequence).toMatchObject([
      {
        kind: "repeat",
        rounds: 3,
        children: [
          { kind: "exercise", itemRef: "node-0" },
          { kind: "exercise", itemRef: "node-1" },
        ],
      },
      { kind: "exercise", itemRef: "node-2" },
      { kind: "exercise", itemRef: "node-3" },
    ]);
    // Le doute sur la fiche est parti avec elle ; le point qui porte sur la séance reste.
    expect(session!.warnings).toEqual([{ code: "habit_rest", field: "rest", block: null, item: null, detail: null }]);
    // Chaque exercice de l'écran sait où il sera dans les brouillons préparés ensuite.
    expect(rebased.refs.get(added.ref)).toBe(`${PREFIX}-0-b0-i0`);
    expect(rebased.refs.get(squat!.ref!)).toBe(`${PREFIX}-0-b0-i1`);
    // L'emplacement reste ouvert, et la séance repart dans la forme que le modèle écrit.
    expect(plannerOpenSlots(rebased.value).map((entry) => entry.id)).toEqual(["slot_1"]);
    expect(plannerSessionMovements(session!, 0).map((entry) => entry.id)).toEqual(["m4", "m1", "m2", "m3"]);
    expect(plannerSessionToComposition(session!, 0).blocks[0]!.content).toHaveLength(3);
  });

  it("fait suivre un point « À vérifier » à l'exercice qu'il vise quand un autre est retiré", () => {
    const draft = screen();
    const block = draft.draft.blocks[0]!;
    block.items = block.items.slice(1);
    block.sequence = block.sequence!.slice(1);
    const rebased = plannerRebaseOnDrafts(stored, [draft], context)!;
    expect(itemsOf(rebased.value).map((item) => item.exerciseToken)).toEqual(["exercise_2", "slot_1"]);
    expect(rebased.value.sessions[0]!.warnings).toContainEqual({
      code: "approximate_exercise",
      field: "exercise",
      block: 0,
      item: 0,
      detail: "exercise_2",
    });
  });

  it("refuse un écran qui ne correspond pas à la proposition", () => {
    const unknown = screen();
    unknown.draft.blocks[0]!.items[0]!.exerciseId = "66666666-6666-4666-8666-666666666666";
    expect(plannerRebaseOnDrafts(stored, [unknown], context)).toBeNull();
    const stranger = screen();
    stranger.assignments = [{ targetType: "group", targetId: ATHLETE }];
    expect(plannerRebaseOnDrafts(stored, [stranger], context)).toBeNull();
    // Un emplacement ne s'invente pas à l'écran : seul un emplacement gardé par le serveur garde sa place.
    const forged = screen();
    forged.draft.blocks[0]!.items[0]!.exerciseId = PLANNER_SLOT_EXERCISE_ID;
    expect(plannerRebaseOnDrafts(stored, [forged], context)).toBeNull();
    const emptied = screen();
    emptied.draft.blocks[0]!.items = [];
    emptied.draft.blocks[0]!.sequence = [];
    expect(plannerRebaseOnDrafts(stored, [emptied], context)).toBeNull();
    expect(plannerRebaseOnDrafts(stored, [screen(), screen()], context)).toBeNull();
    expect(plannerRebaseOnDrafts(stored, [], context)).toBeNull();
  });
});

describe("une fiche « À vérifier » que le coach tranche", () => {
  it("retrouve l'exercice par sa référence et lève le doute sans toucher au reste", () => {
    const place = plannerDraftItemPlace(`${PREFIX}-0-b0-i1`, PREFIX)!;
    expect(place).toEqual({ session: 0, block: 0, item: 1 });
    expect(plannerProbableItem(stored, place)).toMatchObject({ said: "fente", exerciseToken: "exercise_2" });
    // Une fiche sûre et un emplacement ne sont pas des fiches à vérifier ; une autre proposition non plus.
    expect(plannerProbableItem(stored, { session: 0, block: 0, item: 0 })).toBeNull();
    expect(plannerProbableItem(stored, { session: 0, block: 0, item: 2 })).toBeNull();
    expect(plannerDraftItemPlace("ai-autre-0-b0-i1", PREFIX)).toBeNull();
    expect(plannerDraftItemPlace("slot_1", PREFIX)).toBeNull();
    const settled = plannerSettleProbable(stored, place, "exercise_3");
    expect(itemsOf(settled)[1]).toMatchObject({ exerciseToken: "exercise_3", confidence: "exact", said: "fente" });
    expect(itemsOf(settled)[1]).not.toHaveProperty("alternatives");
    expect(itemsOf(settled)[0]).toEqual(itemsOf(stored)[0]);
    expect(settled.sessions[0]!.warnings).toEqual([
      { code: "habit_rest", field: "rest", block: null, item: null, detail: null },
    ]);
  });
});

it("une prescription de séance revient dans la forme du planificateur, séries détaillées comprises", () => {
  expect(
    plannerPrescriptionFromSession({
      sets: 2,
      reps: 5,
      rest_s: 120,
      load: { type: "pct_1rm", value: 80, test: `exercise:${SQUAT}` },
      intensityTarget: { type: "rpe", value: 8 },
      ground_contacts: 40,
      notes: "Explosif",
      setPlan: [{ reps: 8, warmup: true }, { reps: 5, load: { type: "kg", value: 100 } }],
    }),
  ).toEqual({
    sets: 2,
    reps: 5,
    distanceM: null,
    durationS: null,
    restS: 120,
    load: { type: "pct_1rm", value: 80 },
    intensityTarget: { type: "rpe", value: 8 },
    tempo: null,
    contacts: 40,
    notes: "Explosif",
    setPlan: [
      { reps: 8, load: null, warmup: true },
      { reps: 5, load: { type: "kg", value: 100 }, warmup: false },
    ],
  });
});
