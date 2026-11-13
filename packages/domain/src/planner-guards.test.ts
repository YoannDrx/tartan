import { describe, expect, it } from "vitest";
import type { PlannerInterpretation, PlannerPrescription } from "@tartan/contracts";
import { plannerProposalsExhausted, plannerServerEnabled } from "./ai-planner";
import {
  groundPlannerCitations,
  plannerDateHints,
  plannerDateReferences,
  plannerDistinctQuestions,
  plannerDropEmptyPercentages,
  plannerExerciseIsNamed,
  plannerGuardIssues,
  plannerTextNumbers,
  type PlannerGuardContext,
} from "./planner-guards";

const today = "2030-06-03";
const period = { from: "2030-06-03", to: "2030-06-09" };
const exercises = [
  { token: "exercise_1", name: "Squat arrière", aliases: ["Back squat", "Squat"] },
  { token: "exercise_2", name: "Squat avant", aliases: ["Front squat", "Squat"] },
  { token: "exercise_3", name: "Gainage ventral", aliases: [] },
  { token: "exercise_4", name: "Tractions", aliases: [] },
];
const prescription = (values: Partial<PlannerPrescription> = {}): PlannerPrescription => ({
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
  ...values,
});
const session = (date: string, values: Partial<PlannerPrescription> = {}, exerciseToken = "exercise_1") => ({
  date,
  startTime: null,
  title: "Force",
  type: "strength" as const,
  durationMin: null,
  targetTokens: ["group_1"],
  blocks: [{ name: "Force", items: [{ exerciseToken, prescription: prescription(values), instruction: "squat" }] }],
});
const proposal = (...sessions: ReturnType<typeof session>[]): PlannerInterpretation => ({
  status: "proposal",
  questions: [],
  sessions,
  assumptions: [],
  suggestions: [],
});
const context = (text: string, more: Partial<PlannerGuardContext> = {}): PlannerGuardContext => ({
  period,
  today,
  instructions: [text],
  targets: [{ token: "group_1" }],
  exercises,
  ...more,
});
const single = "Le 3 juin, squat arrière, 3 séries de 4 à 40 kg, repos 120 secondes.";

describe("nombres de la consigne", () => {
  it("lit chiffres, décimales et nombres en toutes lettres", () => {
    const numbers = plannerTextNumbers(
      "42,5 kg, trente-sept virgule cinq, quatre-vingt-dix, cent vingt, soixante-quinze et demi",
    );
    for (const value of [42.5, 37.5, 90, 120, 75, 75.5]) expect(numbers.has(value)).toBe(true);
  });
});

describe("références de dates", () => {
  const refs = (text: string) => plannerDateReferences(text, { today, period });
  it("repère date explicite, intervalle, relatif et jour seul", () => {
    expect(refs("Le 3 juin 2030").explicit).toEqual([{ iso: "2030-06-03", weekdayMismatch: false }]);
    expect(refs("Mardi 3 juin 2030").explicit[0]?.weekdayMismatch).toBe(true);
    expect(refs("du 3 au 10 juin").ranges).toEqual([{ from: "2030-06-03", to: "2030-06-10" }]);
    expect(refs("Demain matin").relative).toEqual(["2030-06-04"]);
    expect(refs("mardi soir").weekdayOnly).toBe(true);
  });
  it("ne lit pas « comme hier » comme la date demandée", () => {
    expect(refs("La même séance qu'hier").relative).toEqual([]);
    expect(refs("Comme hier, demain").relative).toEqual(["2030-06-04"]);
  });
});

describe("contrôles d'une proposition", () => {
  it("accepte une proposition conforme", () => {
    expect(plannerGuardIssues(proposal(session("2030-06-03")), context(single))).toEqual([]);
  });
  it("une clarification du modèle n'est jamais modifiée", () => {
    const clarification: PlannerInterpretation = { ...proposal(), status: "clarification" };
    expect(plannerGuardIssues(clarification, context("Hier"))).toEqual([]);
  });
  it("refuse « hier » remplacé par une autre date", () => {
    expect(
      plannerGuardIssues(proposal(session("2030-06-04")), context("Hier : squat arrière, 3x4 à 40 kg.")),
    ).toContain("date");
  });
  it("refuse un jour de semaine contradictoire", () => {
    expect(
      plannerGuardIssues(proposal(session("2030-06-03")), context(`Mardi 3 juin : squat arrière 40 kg`)),
    ).toContain("date");
  });
  it("refuse un intervalle qui dépasse la période, sans troncature", () => {
    expect(
      plannerGuardIssues(proposal(session("2030-06-03")), context("du 3 au 10 juin : squat arrière 40 kg")),
    ).toContain("date");
  });
  it("refuse une demande tronquée sur un jour cité", () => {
    const text = "Le 3 juin squat arrière 40 kg ; le 6 juin squat arrière 40 kg.";
    expect(plannerGuardIssues(proposal(session("2030-06-03")), context(text))).toContain("missing_date");
    expect(plannerGuardIssues(proposal(session("2030-06-03"), session("2030-06-06")), context(text))).toEqual([]);
  });
  it("une correction orale remplace le jour précédent", () => {
    expect(
      plannerGuardIssues(
        proposal(session("2030-06-05")),
        context("Le 4 juin, non pardon le 5 juin, squat arrière 40 kg"),
      ),
    ).toEqual([]);
  });
  it("sans date citée, une seule séance sur plusieurs jours possibles est une question", () => {
    expect(plannerGuardIssues(proposal(session("2030-06-03")), context("Squat arrière 40 kg"))).toContain("date");
    expect(
      plannerGuardIssues(
        proposal(session("2030-06-03")),
        context("Squat arrière 40 kg", { period: { from: today, to: today } }),
      ),
    ).toEqual([]);
  });
  it("refuse une charge absente de la consigne et accepte les lettres", () => {
    expect(
      plannerGuardIssues(proposal(session("2030-06-03", { load: { type: "kg", value: 55 } })), context(single)),
    ).toContain("load");
    expect(
      plannerGuardIssues(
        proposal(session("2030-06-03", { load: { type: "kg", value: 37.5 } })),
        context("Le 3 juin, squat arrière à trente-sept virgule cinq kilos."),
      ),
    ).toEqual([]);
  });
  it("une charge sans unité dictée reste une question", () => {
    expect(
      plannerGuardIssues(
        proposal(session("2030-06-03", { load: { type: "kg", value: 70 } })),
        context("Le 3 juin, squat arrière 3x4 à 70, repos 2 min."),
      ),
    ).toContain("load");
    expect(
      plannerGuardIssues(
        proposal(session("2030-06-03", { load: { type: "pct_1rm", value: 70 } })),
        context("Le 3 juin, squat arrière 3x4 à 70 %."),
      ),
    ).toEqual([]);
    expect(
      plannerGuardIssues(
        proposal(session("2030-06-03", { load: { type: "kg", value: 80 } })),
        context("Le 3 juin, squat arrière à quatre-vingts kilos."),
      ),
    ).toEqual([]);
  });
  it("deux charges contradictoires restent une question, pas une correction ni un total", () => {
    const load = { load: { type: "kg" as const, value: 40 } };
    expect(
      plannerGuardIssues(
        proposal(session("2030-06-03", load)),
        context("Le 3 juin, squat arrière. Charge exactement 40 kg et exactement 60 kg pour chaque série."),
      ),
    ).toContain("load");
    expect(
      plannerGuardIssues(
        proposal(session("2030-06-03", load)),
        context("Le 3 juin, squat arrière à 50 kilos, correction : 40 kilos."),
      ),
    ).toEqual([]);
    expect(
      plannerGuardIssues(
        proposal(session("2030-06-03", load)),
        context("Le 3 juin, squat arrière avec deux haltères de 20 kg, soit 40 kg au total."),
      ),
    ).toEqual([]);
  });
  it("une habitude sans valeur exige une question", () => {
    expect(
      plannerGuardIssues(
        proposal(session("2030-06-03", { restS: null })),
        context("Le 3 juin, squat arrière 40 kg, récup comme d'habitude."),
      ),
    ).toContain("rest");
    expect(
      plannerGuardIssues(
        proposal(session("2030-06-03", { load: null })),
        context("Le 3 juin, squat arrière, charge habituelle, repos 120 secondes."),
      ),
    ).toContain("load");
  });
  it("plus de quatorze séances demandées est une question", () => {
    expect(
      plannerGuardIssues(proposal(session("2030-06-03")), context("Le 3 juin, crée 15 séances de squat arrière 40 kg")),
    ).toContain("session_count");
  });
  it("une cible parmi plusieurs doit être désignée, sauf si tout le monde est servi", () => {
    const targets = [{ token: "group_1" }, { token: "group_2" }];
    expect(plannerGuardIssues(proposal(session("2030-06-03")), context(single, { targets }))).toContain("target");
    expect(
      plannerGuardIssues(proposal(session("2030-06-03")), context(`${single} Pour group_1.`, { targets })),
    ).toEqual([]);
    expect(
      plannerGuardIssues(proposal(session("2030-06-03")), context(`${single} Pour group_1 et group_2.`, { targets })),
    ).toContain("target");
  });
  it("après une réponse du coach, la consigne initiale ne bloque plus", () => {
    expect(
      plannerGuardIssues(proposal(session("2030-06-04")), {
        ...context("Hier : squat arrière 40 kg."),
        instructions: ["Hier : squat arrière 40 kg.", "Quelle date ?\nDemain"],
      }),
    ).toEqual([]);
  });
});

describe("désignation d'un exercice", () => {
  it("reconnaît les pluriels du nom complet sans confondre le sens du lancer", () => {
    const catalog = [
      { token: "exercise_1", name: "Lancer de médecine-ball vers l’avant", aliases: [] },
      { token: "exercise_2", name: "Lancer de médecine-ball vers l’arrière", aliases: [] },
    ];
    const text = "Trois séries de six lancers de médecine-ball vers l’avant.";
    expect(plannerExerciseIsNamed(text, "exercise_1", catalog)).toBe(true);
    expect(plannerExerciseIsNamed(text, "exercise_2", catalog)).toBe(false);
    expect(plannerExerciseIsNamed("Lancers de médecine-ball", "exercise_1", catalog)).toBe(false);
  });
  it("exige un nom, un alias ou un mot distinctif", () => {
    expect(plannerExerciseIsNamed("back squat", "exercise_1", exercises)).toBe(true);
    expect(plannerExerciseIsNamed("gainage, 3 séries", "exercise_3", exercises)).toBe(true);
    expect(plannerExerciseIsNamed("le tirage habituel", "exercise_4", exercises)).toBe(false);
  });
  it("le plan refuse un exercice non nommé", () => {
    expect(
      plannerGuardIssues(
        proposal(session("2030-06-03", {}, "exercise_4")),
        context("Le 3 juin, le tirage habituel à 40 kg."),
      ),
    ).toContain("exercise");
  });
});

describe("citations", () => {
  const value = (instruction: string, exerciseToken = "exercise_1"): PlannerInterpretation => ({
    ...proposal(session("2030-06-03", {}, exerciseToken)),
    sessions: [
      {
        ...session("2030-06-03", {}, exerciseToken),
        blocks: [{ name: "Force", items: [{ exerciseToken, prescription: prescription(), instruction }] }],
      },
    ],
  });
  const restoreContext = { instructions: ["Le 3 juin : Squat arrière, 3 séries de 4."], exercises };
  it("conserve une citation exacte", () => {
    expect(groundPlannerCitations(value("Squat arrière, 3 séries"), restoreContext).removed).toBe(0);
  });
  it("restaure une citation altérée en casse ou espacement", () => {
    const grounded = groundPlannerCitations(value("squat  arrière, 3 séries de 4."), restoreContext);
    expect(grounded.value.sessions[0]?.blocks[0]?.items[0]?.instruction).toBe("Squat arrière, 3 séries de 4");
  });
  it("retient la phrase qui nomme l'exercice", () => {
    const grounded = groundPlannerCitations(value("citation inventée"), restoreContext);
    expect(grounded.value.sessions[0]?.blocks[0]?.items[0]?.instruction).toBe(
      "Le 3 juin : Squat arrière, 3 séries de 4.",
    );
  });
  it("retire un exercice sans attache dans la consigne", () => {
    const grounded = groundPlannerCitations(value("échauffement libre", "exercise_3"), restoreContext);
    expect(grounded.removed).toBe(1);
    expect(grounded.value.sessions).toEqual([]);
  });
});

it("un pourcentage nul devient une absence de charge, jamais un kilo nul dicté", () => {
  const zero = proposal(session("2030-06-03", { load: { type: "pct_1rm", value: 0 } }));
  const dicted = proposal(session("2030-06-03", { load: { type: "kg", value: 0 } }));
  expect(plannerDropEmptyPercentages(zero).sessions[0]?.blocks[0]?.items[0]?.prescription.load).toBeNull();
  expect(plannerDropEmptyPercentages(dicted).sessions[0]?.blocks[0]?.items[0]?.prescription.load).toEqual({
    type: "kg",
    value: 0,
  });
});

it("garde une question par information, trois au plus", () => {
  const question = (field: string, text: string) => ({ field, question: text });
  expect(
    plannerDistinctQuestions([
      question("rest", "a"),
      question("rest", "b"),
      question("date", "c"),
      question("load", "d"),
      question("unit", "e"),
    ]).map((q) => q.question),
  ).toEqual(["a", "c", "d"]);
});

it("les indices de dates suivent la période", () => {
  const hints = plannerDateHints("2030-06-03", { from: "2030-06-03", to: "2030-06-04" });
  expect(hints.todayWeekday).toBe("lundi");
  expect(hints.days).toEqual([
    { date: "2030-06-03", weekday: "lundi" },
    { date: "2030-06-04", weekday: "mardi" },
  ]);
  expect(hints.relative.hier).toBe("2030-06-02");
});

it("un quota épuisé compte aussi les demandes en cours", () => {
  const usage = (used: number, reserved: number) => ({
    limit: { proposals: 30 },
    used: { proposals: used },
    reserved: { proposals: reserved },
  });
  expect(plannerProposalsExhausted(usage(29, 0))).toBe(false);
  expect(plannerProposalsExhausted(usage(29, 1))).toBe(true);
  expect(plannerProposalsExhausted(usage(30, 0))).toBe(true);
});

it("le planificateur s'ouvre avec une clé et se coupe avec false", () => {
  expect(plannerServerEnabled({})).toBe(false);
  expect(plannerServerEnabled({ OPENAI_API_KEY: "k" })).toBe(true);
  expect(plannerServerEnabled({ OPEN_AI_API_KEY: "k" })).toBe(true);
  expect(plannerServerEnabled({ OPENAI_API_KEY: "k", AI_PLANNER_ENABLED: "false" })).toBe(false);
  expect(plannerServerEnabled({ AI_PLANNER_ENABLED: "true" })).toBe(true);
});

it("refuse des tours inventés, y compris dans un groupe imbriqué", () => {
  const value = proposal(session(today));
  const block = value.sessions[0]!.blocks[0]!;
  block.items[0]!.ref = "squat";
  block.sequence = [
    {
      kind: "repeat",
      ref: "outer",
      name: "Circuit",
      rounds: 3,
      restBetweenRoundsS: 0,
      children: [
        {
          kind: "repeat",
          ref: "inner",
          name: "Ajout",
          rounds: 10,
          restBetweenRoundsS: 0,
          children: [{ kind: "exercise", itemRef: "squat" }],
        },
      ],
    },
  ];
  expect(plannerGuardIssues(value, context(single))).toContain("volume");
  expect(plannerGuardIssues(value, context(`${single} Répéter dix fois chaque groupe.`))).not.toContain("volume");
});

it("refuse un superset dont les tours disparaissent dans des séries séparées", () => {
  const value = proposal(session("2030-06-03"));
  expect(
    plannerGuardIssues(value, context("Le 3 juin, superset trois tours : squat arrière à 40 kg puis gainage ventral.")),
  ).toContain("volume");
  expect(plannerGuardIssues(value, context("Le 3 juin, circuit un tour : squat arrière à 40 kg."))).not.toContain(
    "volume",
  );
});
