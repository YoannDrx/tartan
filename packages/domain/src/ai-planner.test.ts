import { describe, expect, it } from "vitest";
import { plannerInterpretation, type PlannerInterpretation, type PlannerPrescription } from "@tartan/contracts";
import {
  plannerAudioIsWithinLimits,
  plannerLimits,
  plannerPrescriptionToSession,
  plannerQuotaFits,
  plannerRetentionDeadline,
  validatePlannerInterpretation,
} from "./ai-planner";

const exerciseId = "00000000-0000-4000-8000-000000000001";
const instruction = "Vendredi, groupe vitesse : squat, trois séries de quatre à 40 kg, repos deux minutes.";
const prescription: PlannerPrescription = {
  sets: 3,
  reps: 4,
  distanceM: null,
  durationS: null,
  restS: 120,
  load: { type: "kg", value: 40 },
  intensityTarget: null,
  tempo: null,
  contacts: null,
  notes: null,
};
const context = {
  period: { from: "2026-11-09", to: "2026-11-15" },
  exercises: new Map([["exercise_1", { id: exerciseId }]]),
  targetTokens: new Set(["group_1"]),
  reviewedInstructions: [instruction],
};
const proposal = (): PlannerInterpretation => ({
  status: "proposal",
  questions: [],
  assumptions: [],
  suggestions: [],
  sessions: [
    {
      date: "2026-11-13",
      startTime: null,
      title: "Force",
      type: "strength",
      durationMin: null,
      targetTokens: ["group_1"],
      blocks: [
        { name: "Force", items: [{ exerciseToken: "exercise_1", instruction, prescription: { ...prescription } }] },
      ],
    },
  ],
});
describe("frontière de confiance du planificateur", () => {
  it("préserve les kilos explicites et la cible simultanée, sans déduire de charge du RIR", () => {
    expect(validatePlannerInterpretation(proposal(), context).ok).toBe(true);
    expect(
      plannerPrescriptionToSession({ ...prescription, intensityTarget: { type: "rir", value: 2 } }, exerciseId),
    ).toEqual({
      sets: 3,
      reps: 4,
      rest_s: 120,
      load: { type: "kg", value: 40 },
      intensityTarget: { type: "rir", value: 2 },
    });
    expect(
      plannerPrescriptionToSession(
        { ...prescription, load: null, intensityTarget: { type: "rpe", value: 8 } },
        exerciseId,
      ),
    ).not.toHaveProperty("load");
    expect(
      plannerPrescriptionToSession({ ...prescription, load: { type: "pct_1rm", value: 75 } }, exerciseId).load,
    ).toEqual({ type: "pct_1rm", value: 75, test: `exercise:${exerciseId}` });
  });
  it("refuse identités, données santé, outils et autres champs hors contrat", () => {
    for (const field of ["athleteName", "injury", "health", "publish", "tools", "strengthReference"])
      expect(validatePlannerInterpretation({ ...proposal(), [field]: "secret" }, context)).toEqual({
        ok: false,
        issues: ["shape"],
      });
    const input = proposal();
    Object.assign(input.sessions[0]!.blocks[0]!.items[0]!, { athleteId: exerciseId });
    expect(validatePlannerInterpretation(input, context).ok).toBe(false);
  });
  it.each([
    [
      "date",
      (p: PlannerInterpretation) => {
        p.sessions[0]!.date = "2026-11-16";
      },
    ],
    [
      "target",
      (p: PlannerInterpretation) => {
        p.sessions[0]!.targetTokens = ["group_2"];
      },
    ],
    [
      "target",
      (p: PlannerInterpretation) => {
        p.sessions[0]!.targetTokens = ["group_1", "group_1"];
      },
    ],
    [
      "exercise",
      (p: PlannerInterpretation) => {
        p.sessions[0]!.blocks[0]!.items[0]!.exerciseToken = "invented";
      },
    ],
    [
      "instruction",
      (p: PlannerInterpretation) => {
        p.sessions[0]!.blocks[0]!.items[0]!.instruction = "Une consigne inventée";
      },
    ],
    [
      "prescription",
      (p: PlannerInterpretation) => {
        p.sessions[0]!.blocks[0]!.items[0]!.prescription.load = { type: "pct_1rm", value: 400 };
      },
    ],
    [
      "prescription",
      (p: PlannerInterpretation) => {
        p.sessions[0]!.blocks[0]!.items[0]!.prescription.intensityTarget = { type: "rir", value: 1.5 };
      },
    ],
  ] as const)("rejette %s sans résoudre silencieusement", (issue, change) => {
    const input = proposal();
    change(input);
    expect(validatePlannerInterpretation(input, context)).toEqual({ ok: false, issues: [issue] });
  });
  it("sépare clarifications et propositions, impose questions uniques et limite sept jours/quatorze séances", () => {
    const question = { id: "q1", field: "rest" as const, question: "Quelle récupération ?", options: [] };
    expect(
      validatePlannerInterpretation(
        { ...proposal(), status: "clarification", questions: [question], sessions: [] },
        context,
      ).ok,
    ).toBe(true);
    expect(
      validatePlannerInterpretation({ ...proposal(), status: "clarification", questions: [question] }, context).ok,
    ).toBe(false);
    expect(validatePlannerInterpretation({ ...proposal(), questions: [question] }, context).ok).toBe(false);
    expect(
      validatePlannerInterpretation(
        { ...proposal(), status: "clarification", questions: [question, question], sessions: [] },
        context,
      ).ok,
    ).toBe(false);
    expect(validatePlannerInterpretation({ ...proposal(), sessions: [] }, context).ok).toBe(false);
    expect(
      validatePlannerInterpretation({ ...proposal(), sessions: Array(15).fill(proposal().sessions[0]) }, context).ok,
    ).toBe(false);
    expect(
      validatePlannerInterpretation(proposal(), { ...context, period: { from: "2026-11-08", to: "2026-11-15" } }).ok,
    ).toBe(false);
  });
  it("génère un schéma sans clé facultative ni objet ouvert pour le fournisseur", () => {
    const schema = plannerInterpretation.toJSONSchema();
    function inspect(value: unknown) {
      if (!value || typeof value !== "object") return;
      const object = value as Record<string, unknown>;
      if (object.type === "object") {
        expect(object.additionalProperties).toBe(false);
        expect([...(object.required as string[])].sort()).toEqual(Object.keys(object.properties as object).sort());
      }
      Object.values(object).forEach(inspect);
    }
    inspect(schema);
  });
});
describe("bornes et conservation du planificateur", () => {
  it("applique les deux quotas sans dépassement automatique, pilote équivalent Coach", () => {
    expect(plannerLimits("pilot")).toEqual(plannerLimits("coach"));
    expect(plannerLimits("club")).toEqual({ proposals: 150, audioSeconds: 18000 });
    expect(plannerQuotaFits("discovery", { proposals: 0, audioSeconds: 0 }, { proposals: 0, audioSeconds: 0 })).toBe(
      false,
    );
    expect(plannerQuotaFits("coach", { proposals: 29, audioSeconds: 3599 }, { proposals: 1, audioSeconds: 1 })).toBe(
      true,
    );
    expect(plannerQuotaFits("coach", { proposals: 30, audioSeconds: 0 }, { proposals: 1, audioSeconds: 0 })).toBe(
      false,
    );
    expect(plannerQuotaFits("coach", { proposals: 0, audioSeconds: 3600 }, { proposals: 0, audioSeconds: 1 })).toBe(
      false,
    );
    expect(plannerQuotaFits("coach", { proposals: 0, audioSeconds: 0 }, { proposals: -1, audioSeconds: 0 })).toBe(
      false,
    );
    expect(plannerQuotaFits("coach", { proposals: 0, audioSeconds: 0 }, { proposals: 1, audioSeconds: 0.1 })).toBe(
      false,
    );
  });
  it("borne l’audio en octets et durée ; un fichier vide ou une durée non fiable est refusé", () => {
    expect(plannerAudioIsWithinLimits(3 * 1024 * 1024, 180)).toBe(true);
    for (const [bytes, seconds] of [
      [0, 1],
      [1, 0],
      [1, NaN],
      [1, Infinity],
      [1, 180.01],
      [3 * 1024 * 1024 + 1, 1],
    ])
      expect(plannerAudioIsWithinLimits(bytes!, seconds!)).toBe(false);
  });
  it("expire sous sept jours ou vingt-quatre heures après création, sans prolonger une échéance", () => {
    const created = new Date("2026-10-24T23:00:00Z");
    expect(plannerRetentionDeadline(created, null).toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(plannerRetentionDeadline(created, new Date("2026-10-25T01:00:00Z")).toISOString()).toBe(
      "2026-10-26T01:00:00.000Z",
    );
    expect(plannerRetentionDeadline(created, new Date("2026-10-31T22:00:00Z")).toISOString()).toBe(
      "2026-10-31T23:00:00.000Z",
    );
  });
});
