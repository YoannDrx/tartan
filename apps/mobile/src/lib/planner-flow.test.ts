import { PLANNER_SLOT_EXERCISE_ID, type PlannerReviewedDraft } from "@tartan/contracts";
import { describe, expect, it } from "vitest";
import {
  plannerAsSequence,
  plannerClarifyInput,
  plannerCreateInput,
  plannerHasPercent,
  plannerHints,
  plannerItemState,
  plannerNearExercises,
  plannerNextAction,
  plannerQuickDefaults,
  plannerQuickInput,
  plannerRequestFrom,
  plannerSearchLibrary,
  plannerWithExercise,
  type PlannerDraftSlot,
  type PlannerDraftWarning,
} from "./planner-flow";

const GROUP = "22222222-2222-4222-8222-222222222222";
const SQUAT = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";
const ATHLETE = "55555555-5555-4555-8555-555555555555";
const base = plannerRequestFrom(
  { groupIds: [GROUP], athleteIds: [], period: { from: "2026-11-24", to: "2026-11-24" } },
  ["barbell", "bodyweight"],
  "Squat 3 x 8, repos 2 minutes",
);
const options = {
  id: "11111111-1111-4111-8111-111111111111",
  requestedAt: "2026-11-22T10:00:00.000Z",
  spaceEquipment: ["bodyweight", "barbell"] as const,
  phaseChoices: null,
};

const draft = (items: { ref: string; exerciseId: string; load?: { type: "kg" | "pct_1rm"; value: number } }[]) =>
  ({
    date: "2026-11-24",
    startTime: null,
    location: null,
    publishAt: null,
    assignments: [{ targetType: "group", targetId: GROUP }],
    overrides: items.map((item) => ({ athleteId: ATHLETE, itemRef: item.ref, prescription: { sets: 2 } })),
    draft: {
      title: "Force",
      type: "strength",
      durationMin: null,
      coachNote: null,
      blocks: [
        {
          ref: "b1",
          name: "Corps",
          variant: "club",
          items: items.map((item) => ({
            ref: item.ref,
            exerciseId: item.exerciseId,
            prescription: { sets: 3, reps: 8, ...(item.load ? { load: item.load } : {}) },
          })),
        },
      ],
    },
  }) as unknown as PlannerReviewedDraft;

describe("la demande en un écran", () => {
  it("part sans mode ni brief, déclare emplacements et points à vérifier, et garde reviewed pour le contrat", () => {
    const input = plannerCreateInput(base, options);
    expect(input.success).toBe(true);
    expect(input.data).toMatchObject({
      text: "Squat 3 x 8, repos 2 minutes",
      reviewed: true,
      accepts: ["slots", "checks"],
      selection: { period: { from: "2026-11-24", to: "2026-11-24" }, groupIds: [GROUP], phaseChoicesByDate: [] },
    });
    expect(input.data!.selection.mode).toBeUndefined();
    expect(input.data!.selection.brief).toBeUndefined();
    expect(input.data!.hints).toBeUndefined();
    expect(input.data!.startTime).toBeUndefined();
  });

  it("n'envoie que les précisions touchées, et le matériel seulement s'il diffère du profil", () => {
    expect(plannerHints(base, ["barbell", "bodyweight"])).toEqual({});
    const precise = { ...base, durationMin: 45, level: "advanced" as const, equipment: ["bodyweight" as const] };
    expect(plannerHints(precise, ["barbell", "bodyweight"])).toEqual({
      durationMin: 45,
      level: "advanced",
      equipment: ["bodyweight"],
    });
    const input = plannerCreateInput({ ...precise, startTime: "18:30" }, options);
    expect(input.data).toMatchObject({ startTime: "18:30", hints: { durationMin: 45 } });
  });

  it("accepte une demande sans destinataire choisi, refuse un champ vide ou trop long", () => {
    expect(plannerCreateInput({ ...base, groupIds: [] }, options).success).toBe(true);
    expect(plannerCreateInput({ ...base, text: "   " }, options).success).toBe(false);
    expect(plannerCreateInput({ ...base, text: "a".repeat(12001) }, options).success).toBe(false);
  });

  it("porte la phase du jour quand elle est demandée", () => {
    const input = plannerCreateInput(base, { ...options, phaseChoices: [{ athleteId: ATHLETE, groupId: GROUP }] });
    expect(input.data!.selection.phaseChoicesByDate).toEqual([
      { date: "2026-11-24", choices: [{ athleteId: ATHLETE, groupId: GROUP }] },
    ]);
  });

  it("un ajustement emporte la séance de l'écran, une réponse non", () => {
    const session = draft([{ ref: "i1", exerciseId: SQUAT }]);
    const adjust = plannerClarifyInput({
      operationId: options.id,
      expectedVersion: 2,
      text: "Quatre séries",
      sessions: [session],
    });
    expect(adjust.data).toMatchObject({ reviewed: true, sessions: [session] });
    const answer = plannerClarifyInput({ operationId: options.id, expectedVersion: 2, text: "Mardi" });
    expect(answer.data && "sessions" in answer.data).toBe(false);
  });
});

// L'action « créer » seule : un emplacement ouvert en ferait une autre.
const creating = (options: Parameters<typeof plannerNextAction>[0]) => {
  const action = plannerNextAction(options);
  if (action.kind !== "create") throw new Error("action inattendue");
  return action;
};

describe("la séance", () => {
  const slot: PlannerDraftSlot = {
    id: "slot_1",
    said: "pompes claquées",
    session: 0,
    itemRef: "i2",
    candidates: [],
    suggestion: { name: "Pompes claquées", category: "plyo", movement: "push", loadKind: "bodyweight" },
  };
  const probable: PlannerDraftWarning = {
    code: "approximate_exercise",
    field: "exercise",
    itemRef: "i1",
    detail: null,
    said: "squat",
    alternatives: [{ exerciseId: OTHER, name: "Squat avant" }],
  };

  it("dit l'état de chaque exercice : reconnu, à vérifier, à compléter", () => {
    expect(plannerItemState({ ref: "i3", exerciseId: SQUAT }, [slot], [probable])).toEqual({ kind: "recognized" });
    expect(plannerItemState({ ref: "i1", exerciseId: SQUAT }, [slot], [probable])).toEqual({
      kind: "probable",
      warning: probable,
    });
    expect(plannerItemState({ ref: "i2", exerciseId: PLANNER_SLOT_EXERCISE_ID }, [slot], [])).toEqual({
      kind: "slot",
      slot,
    });
    // Un autre point « À vérifier » ne fait pas d'une fiche reconnue une fiche rapprochée.
    expect(
      plannerItemState({ ref: "i3", exerciseId: SQUAT }, [], [{ ...probable, itemRef: "i3", code: "habit_load" }]),
    ).toEqual({ kind: "recognized" });
  });

  it("le bouton du bas mène au premier exercice sans fiche, puis crée", () => {
    const drafts = [draft([{ ref: "i1", exerciseId: SQUAT }])];
    expect(plannerNextAction({ drafts, slots: [slot], valid: true, phasesReady: true, loads: {} })).toEqual({
      kind: "complete",
      count: 1,
      said: "pompes claquées",
      slotId: "slot_1",
    });
    expect(plannerNextAction({ drafts, slots: [], valid: true, phasesReady: true, loads: {} })).toEqual({
      kind: "create",
      count: 1,
      ready: true,
      reason: null,
    });
    expect(creating({ drafts, slots: [], valid: false, phasesReady: true, loads: {} }).reason).toBe("invalid");
    expect(creating({ drafts, slots: [], valid: true, phasesReady: false, loads: {} }).reason).toBe("phases");
    expect(creating({ drafts: null, slots: [], valid: false, phasesReady: true, loads: {} }).ready).toBe(false);
  });

  it("n'exige l'aperçu des charges que pour un pourcentage du maximum", () => {
    const kilos = draft([{ ref: "i1", exerciseId: SQUAT, load: { type: "kg", value: 60 } }]);
    const percent = draft([{ ref: "i1", exerciseId: SQUAT, load: { type: "pct_1rm", value: 80 } }]);
    expect(plannerHasPercent(kilos)).toBe(false);
    expect(plannerHasPercent(percent)).toBe(true);
    const action = (loads: Record<number, { key: string; ready: boolean }>) =>
      creating({ drafts: [percent], slots: [], valid: true, phasesReady: true, loads });
    expect(action({}).reason).toBe("loads");
    expect(action({ 0: { key: JSON.stringify(percent), ready: true } }).ready).toBe(true);
    // L'aperçu d'une autre version de la séance ne compte pas.
    expect(action({ 0: { key: JSON.stringify(kilos), ready: true } }).reason).toBe("loads");
    expect(creating({ drafts: [kilos], slots: [], valid: true, phasesReady: true, loads: {} }).ready).toBe(true);
  });

  it("une fiche prend la place d'un exercice, garde la prescription et retire ses charges adaptées", () => {
    const session = draft([
      { ref: "i1", exerciseId: SQUAT, load: { type: "pct_1rm", value: 80 } },
      { ref: "i2", exerciseId: PLANNER_SLOT_EXERCISE_ID },
    ]);
    const [next] = plannerWithExercise([plannerAsSequence(session)], "i1", OTHER);
    const item = next!.draft.blocks[0]!.items[0]!;
    expect(item.exerciseId).toBe(OTHER);
    expect(item.prescription).toMatchObject({ sets: 3, reps: 8, load: { type: "pct_1rm", value: 80 } });
    expect(next!.overrides.map((o) => o.itemRef)).toEqual(["i2"]);
    expect(next!.draft.structureVersion).toBe(2);
    expect(next!.draft.blocks[0]!.sequence).toEqual([
      { kind: "exercise", itemRef: "i1" },
      { kind: "exercise", itemRef: "i2" },
    ]);
  });
});

describe("chercher et créer une fiche", () => {
  const library = [
    {
      id: SQUAT,
      name: "Squat arrière",
      aliases: ["back squat"],
      category: "strength",
      strengthLoadKind: "external_total" as const,
    },
    { id: OTHER, name: "Squat avant", aliases: [], category: "strength", strengthLoadKind: "external_total" as const },
    { id: GROUP, name: "Gainage ventral", aliases: [], category: "core", strengthLoadKind: null },
  ];

  it("cherche dans toute la bibliothèque, sans accent ni majuscule, l'exact d'abord", () => {
    expect(plannerSearchLibrary(library, "")).toEqual([]);
    expect(plannerSearchLibrary(library, "SQUAT").map((e) => e.name)).toEqual(["Squat arrière", "Squat avant"]);
    expect(plannerSearchLibrary(library, "back squat").map((e) => e.name)).toEqual(["Squat arrière"]);
    expect(plannerSearchLibrary(library, "squat avant").map((e) => e.name)).toEqual(["Squat avant"]);
    expect(plannerSearchLibrary(library, "arriere").map((e) => e.name)).toEqual(["Squat arrière"]);
  });

  it("propose les fiches proches du terme dit, jamais une fiche sans mot commun", () => {
    expect(plannerNearExercises(library, "squat sauté").map((e) => e.id)).toEqual(
      expect.arrayContaining([SQUAT, OTHER]),
    );
    expect(plannerNearExercises(library, "pompes claquées")).toEqual([]);
  });

  it("préremplit la création par la suggestion du serveur, sinon par la bibliothèque", () => {
    const suggestion = { name: "Pompes claquées", category: "plyo" as const, loadKind: "bodyweight" as const };
    expect(plannerQuickDefaults("pompes claquees", library, suggestion)).toMatchObject({
      category: "plyo",
      load: "bodyweight",
      existing: null,
    });
    // Un autre nom que celui de la suggestion repart de la bibliothèque.
    expect(plannerQuickDefaults("Squat bulgare", library, suggestion)).toMatchObject({
      category: "strength",
      load: "external_total",
      basis: expect.any(String),
    });
    expect(plannerQuickDefaults("squat AVANT", library).existing?.id).toBe(OTHER);
  });

  it("envoie le terme dit seulement s'il diffère du nom retenu", () => {
    expect(
      plannerQuickInput({ name: " Pompes claquées ", term: "pompes claquees", category: "plyo", load: "none" }),
    ).toEqual({
      name: "Pompes claquées",
      category: "plyo",
      strengthLoadKind: null,
    });
    expect(
      plannerQuickInput({
        name: "Pompes pliométriques",
        term: "pompes claquées",
        category: "plyo",
        load: "bodyweight",
      }),
    ).toEqual({
      name: "Pompes pliométriques",
      searchTerm: "pompes claquées",
      category: "plyo",
      strengthLoadKind: "bodyweight",
    });
  });
});
