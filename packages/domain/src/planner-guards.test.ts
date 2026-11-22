import { describe, expect, it } from "vitest";
import type { PlannerInterpretation, PlannerPrescription, PlannerRichInterpretation } from "@tartan/contracts";
import { plannerProposalsExhausted, plannerServerEnabled } from "./ai-planner";
import {
  groundPlannerCitations,
  plannerDateHints,
  plannerDateReferences,
  plannerDistinctQuestions,
  plannerDropEmptyPercentages,
  plannerExerciseIsApproximate,
  plannerExerciseIsNamed,
  plannerGuardIssues,
  plannerProposalIssues,
  plannerRequiredFields,
  plannerTextNumbers,
  plannerWarnings,
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
  it("lit chaque nombre en lettres de 1 à 300, écrit avec ou sans traits d'union", () => {
    const units = "zéro un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize".split(" ");
    const tens: Record<number, string> = { 20: "vingt", 30: "trente", 40: "quarante", 50: "cinquante", 60: "soixante" };
    const below100 = (n: number): string => {
      if (n <= 16) return units[n]!;
      if (n < 20) return `dix-${units[n - 10]}`;
      if (n === 80) return "quatre-vingts";
      if (n > 80) return `quatre-vingt-${below100(n - 80)}`;
      const ten = n >= 60 ? 60 : Math.floor(n / 10) * 10;
      const rest = n - ten;
      if (rest === 0) return tens[ten]!;
      return rest === 1 || rest === 11 ? `${tens[ten]} et ${below100(rest)}` : `${tens[ten]}-${below100(rest)}`;
    };
    const words = (n: number): string => {
      if (n < 100) return below100(n);
      const hundreds = Math.floor(n / 100);
      const rest = n % 100;
      const head = hundreds === 1 ? "cent" : `${units[hundreds]} cent${rest ? "" : "s"}`;
      return rest ? `${head} ${below100(rest)}` : head;
    };
    for (let n = 1; n <= 300; n++) {
      expect(plannerTextNumbers(`à ${words(n)} kilos`).has(n), words(n)).toBe(true);
      expect(plannerTextNumbers(`à ${words(n).replaceAll("-", " ")} kilos`).has(n), words(n)).toBe(true);
    }
  });
  it("dans une dictée sans ponctuation, un nombre s'arrête où il s'arrête : le suivant n'y est pas collé", () => {
    const numbers = plannerTextNumbers(
      "deux reps à soixante kilos deux à soixante-dix une à quatre-vingts une à quatre-vingt-cinq",
    );
    for (const value of [60, 70, 80, 85]) expect(numbers.has(value), String(value)).toBe(true);
    expect(numbers.has(71)).toBe(false);
    expect(numbers.has(81)).toBe(false);
    // Une dizaine suivie d'une unité garde ses deux lectures : cinquante-deux, ou cinquante puis deux.
    const split = plannerTextNumbers("deux à cinquante deux à soixante");
    for (const value of [50, 52, 60, 2]) expect(split.has(value), String(value)).toBe(true);
  });
});

describe("nombres en lettres, formes nommées", () => {
  it.each([
    ["soixante-dix", 70],
    ["soixante et onze", 71],
    ["quatre-vingt", 80],
    ["quatre-vingts", 80],
    ["quatre-vingt-dix-neuf", 99],
    ["cent dix", 110],
    ["deux cent cinquante", 250],
    ["deux cents", 200],
    ["trois cent", 300],
  ])("« %s » vaut %i", (words, value) => {
    expect(plannerTextNumbers(`squat arrière à ${words} kilos`).has(value)).toBe(true);
  });
  it("une partie décimale dite en plusieurs mots est lue entière", () => {
    const numbers = plannerTextNumbers("quarante-deux virgule vingt-cinq kilos puis deux à cinquante");
    expect(numbers.has(42.25)).toBe(true);
    expect(numbers.has(50)).toBe(true);
  });
});

describe("charge dictée en toutes lettres", () => {
  it("garde chaque charge d'une montée dite sans ponctuation, l'unité dite une fois", () => {
    const said =
      "jeudi squat arrière deux reps à soixante kilos deux à soixante-dix une à quatre-vingts une à quatre-vingt-cinq";
    const numbers = plannerTextNumbers(said);
    expect([60, 70, 80, 85].every((value) => numbers.has(value))).toBe(true);
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
  it("ne remplace pas le seul jour nommé par le début de période", () => {
    const text = "Mercredi pour un destinataire hors sélection : squat arrière 40 kg.";
    expect(plannerGuardIssues(proposal(session("2030-06-03")), context(text))).toContain("date");
    expect(plannerGuardIssues(proposal(session("2030-06-05")), context(text))).not.toContain("date");
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
  it("une habitude sans séance connue est une question ; avec l'historique, un point à vérifier", () => {
    const blind = context("Le 3 juin, squat arrière 40 kg, récup comme d'habitude.");
    expect(plannerGuardIssues(proposal(session("2030-06-03", { restS: null })), blind)).toEqual(["rest"]);
    expect(
      plannerGuardIssues(
        proposal(session("2030-06-03", { load: null })),
        context("Le 3 juin, squat arrière, charge habituelle, repos 120 secondes."),
      ),
    ).toEqual(["load"]);
    const rest = { ...blind, history: true };
    expect(plannerGuardIssues(proposal(session("2030-06-03", { restS: null })), rest)).toEqual([]);
    expect(plannerWarnings(proposal(session("2030-06-03", { restS: null })), rest)[0]).toContainEqual(
      expect.objectContaining({ code: "habit_rest", field: "rest" }),
    );
    const load = { ...context("Le 3 juin, squat arrière, charge habituelle, repos 120 secondes."), history: true };
    expect(plannerWarnings(proposal(session("2030-06-03", { load: null })), load)[0]).toContainEqual(
      expect.objectContaining({ code: "habit_load", field: "load" }),
    );
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
  it("après une réponse du coach, une date fausse est encore refusée", () => {
    const answered = {
      ...context("Squat arrière 3 x 4 à 40 kg."),
      instructions: ["Squat arrière 3 x 4 à 40 kg.", "Quel jour ?\nMercredi"],
    };
    expect(plannerGuardIssues(proposal(session("2030-06-03")), answered)).toContain("date");
    expect(plannerGuardIssues(proposal(session("2030-06-05")), answered)).toEqual([]);
  });
  it("une unité proposée dans la question du modèle ne confirme pas la charge", () => {
    const answered = {
      ...context("Le 3 juin : squat arrière 3 x 4 à 40."),
      instructions: ["Le 3 juin : squat arrière 3 x 4 à 40.", "Est-ce 40 kg ou 40 % ?\nComme d'habitude"],
    };
    expect(plannerGuardIssues(proposal(session("2030-06-03")), answered)).toContain("load");
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
  it("exige un nom ou un alias, jamais un mot isolé", () => {
    expect(plannerExerciseIsNamed("back squat", "exercise_1", exercises)).toBe(true);
    expect(plannerExerciseIsNamed("gainage ventral, 3 séries", "exercise_3", exercises)).toBe(true);
    // « gainage » seul peut être ventral ou latéral : la fiche n'est pas choisie.
    expect(plannerExerciseIsNamed("gainage, 3 séries", "exercise_3", exercises)).toBe(false);
    expect(plannerExerciseIsNamed("le tirage habituel", "exercise_4", exercises)).toBe(false);
  });
  it("un alias court contenu dans un autre geste ne permet pas sa substitution", () => {
    const catalog = [
      { token: "clean", name: "Épaulé", aliases: ["clean"] },
      { token: "power", name: "Épaulé puissance", aliases: ["power clean"] },
    ];
    expect(plannerExerciseIsNamed("power clean, trois séries", "clean", catalog)).toBe(false);
    expect(plannerExerciseIsNamed("power clean, trois séries", "power", catalog)).toBe(true);
    expect(plannerExerciseIsNamed("clean puis power clean", "clean", catalog)).toBe(true);
    expect(plannerExerciseIsNamed("front squat", "exercise_1", exercises)).toBe(false);
    expect(plannerExerciseIsNamed("front squat", "exercise_2", exercises)).toBe(true);
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

describe("points à vérifier", () => {
  const nested = () => {
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
    return value;
  };
  it("des tours absents de la consigne laissent passer la séance, signalés sur le bloc", () => {
    expect(plannerGuardIssues(nested(), context(single))).toEqual([]);
    expect(plannerWarnings(nested(), context(single))[0]).toContainEqual(
      expect.objectContaining({ code: "rounds_not_stated", field: "rounds", block: 0, detail: "10" }),
    );
    expect(
      plannerWarnings(nested(), context(`${single} Répéter dix fois chaque groupe.`))[0]!.map((w) => w.code),
    ).not.toContain("rounds_not_stated");
  });
  it("un superset dont les tours disparaissent est signalé, sans être refusé", () => {
    const value = proposal(session("2030-06-03"));
    const text = "Le 3 juin, superset trois tours : squat arrière à 40 kg puis gainage ventral.";
    expect(plannerGuardIssues(value, context(text))).toEqual([]);
    expect(plannerWarnings(value, context(text))[0]).toContainEqual(
      expect.objectContaining({ code: "rounds_missing", detail: "3" }),
    );
    expect(
      plannerWarnings(value, context("Le 3 juin, circuit un tour : squat arrière à 40 kg."))[0]!.map((w) => w.code),
    ).not.toContain("rounds_missing");
  });
  it("une pause après une série unique, qui serait perdue à l'exécution, est signalée sur l'exercice", () => {
    const value = proposal(session(today));
    const block = value.sessions[0]!.blocks[0]!;
    block.items[0]!.ref = "squat";
    block.items[0]!.prescription.sets = 1;
    block.sequence = [{ kind: "exercise", itemRef: "squat" }];
    const codes = () => plannerWarnings(value, context(single))[0]!.map((w) => w.code);
    expect(plannerWarnings(value, context(single))[0]).toContainEqual(
      expect.objectContaining({ code: "rest_not_executed", field: "rest", block: 0, item: 0 }),
    );
    block.items[0]!.prescription.sets = 3;
    expect(codes()).not.toContain("rest_not_executed");
    block.items[0]!.prescription.sets = 1;
    block.items[0]!.prescription.restS = null;
    block.sequence.push({ kind: "recovery", ref: "pause", durationS: 120 });
    expect(codes()).not.toContain("rest_not_executed");
  });
  it("une fiche proche du nom cité passe avec un point à vérifier ; une fiche sans rapport reste bloquante", () => {
    const catalog = [
      { token: "lunge", name: "Fentes avant", aliases: ["Forward lunge"] },
      { token: "goblet", name: "Goblet squat", aliases: ["Squat gobelet"] },
      { token: "pull", name: "Tractions", aliases: [] },
    ];
    const text = "Le 3 juin, circuit : dix fentes par jambe puis huit squats goblet à 40 kg.";
    const lunge = proposal(session("2030-06-03", {}, "lunge"));
    expect(plannerGuardIssues(lunge, context(text, { exercises: catalog }))).toEqual([]);
    expect(plannerWarnings(lunge, context(text, { exercises: catalog }))[0]).toContainEqual(
      expect.objectContaining({ code: "approximate_exercise", field: "exercise", detail: "Fentes avant" }),
    );
    // Mêmes mots dans un autre ordre : la désignation est exacte, rien à vérifier.
    expect(plannerExerciseIsNamed(text, "goblet", catalog)).toBe(true);
    expect(plannerExerciseIsApproximate("Le 3 juin, squat gobelet.", "pull", catalog)).toBe(false);
    expect(
      plannerGuardIssues(proposal(session("2030-06-03", {}, "pull")), context(text, { exercises: catalog })),
    ).toContain("exercise");
  });
  it("ce que le contexte désigne déjà n'est ni une substitution ni une charge inventée", () => {
    const text = "Le 3 juin, refais la séance de mardi.";
    const value = proposal(session("2030-06-03", { load: { type: "kg", value: 16 } }, "exercise_4"));
    expect(plannerGuardIssues(value, context(text))).toEqual(expect.arrayContaining(["exercise", "load"]));
    expect(plannerGuardIssues(value, context(text, { known: { tokens: ["exercise_4"], loads: [16] } }))).toEqual([]);
  });
});

describe("séries détaillées et autonomie", () => {
  const detailed = (loads: number[], away?: { token: string; load: number | null }) => {
    const value = proposal(session("2030-06-03")) as PlannerRichInterpretation;
    const item = value.sessions[0]!.blocks[0]!.items[0]!;
    item.prescription = {
      ...item.prescription,
      setPlan: loads.map((value, index) => ({ reps: 5, load: { type: "kg", value }, warmup: index === 0 })),
    };
    if (away)
      item.autonomous = {
        exerciseToken: away.token,
        prescription: {
          ...prescription({ load: away.load === null ? null : { type: "kg", value: away.load } }),
          setPlan: null,
        },
      };
    return value;
  };
  const text = "Le 3 juin, squat arrière : 5 à 40 kg pour s'échauffer, puis 5 à 60 kg et 5 à 70 kg.";
  it("chaque charge d'une série détaillée doit figurer dans la consigne", () => {
    expect(plannerGuardIssues(detailed([40, 60, 70]), context(text))).toEqual([]);
    expect(plannerGuardIssues(detailed([40, 60, 65]), context(text))).toContain("load");
  });
  it("le remplacement en autonomie est contrôlé comme l'exercice principal", () => {
    const away = `${text} En autonomie, tractions à la place, 3 séries de 4.`;
    expect(plannerGuardIssues(detailed([40, 60, 70], { token: "exercise_4", load: null }), context(away))).toEqual([]);
    expect(plannerGuardIssues(detailed([40, 60, 70], { token: "exercise_3", load: null }), context(away))).toContain(
      "exercise",
    );
    expect(plannerGuardIssues(detailed([40, 60, 70], { token: "exercise_4", load: 30 }), context(away))).toContain(
      "load",
    );
  });
});

describe("mode « Proposer une séance »", () => {
  const brief = { date: "2030-06-05", durationMin: 45 };
  const proposed = (date: string, load: PlannerPrescription["load"] = null) =>
    proposal({ ...session(date, { load }), durationMin: 40 } as unknown as ReturnType<typeof session>);
  it("accepte une séance unique, à la date du brief, sans charge", () => {
    expect(plannerProposalIssues(proposed("2030-06-05"), { brief })).toEqual([]);
  });
  it("refuse une autre date, plusieurs séances ou un kilo proposé", () => {
    expect(plannerProposalIssues(proposed("2030-06-04"), { brief })).toContain("date");
    expect(plannerProposalIssues(proposed("2030-06-05", { type: "kg", value: 60 }), { brief })).toContain("load");
    const two = proposal(session("2030-06-05"), session("2030-06-05"));
    expect(plannerProposalIssues(two, { brief })).toContain("session_count");
  });
  it("un pourcentage n'est admis que si chaque destinataire a sa référence de force", () => {
    const percent = proposed("2030-06-05", { type: "pct_1rm", value: 75 });
    expect(plannerProposalIssues(percent, { brief })).toContain("load");
    expect(plannerProposalIssues(percent, { brief, percentTokens: new Set(["exercise_2"]) })).toContain("load");
    expect(plannerProposalIssues(percent, { brief, percentTokens: new Set(["exercise_1"]) })).toEqual([]);
    expect(
      plannerProposalIssues(proposed("2030-06-05", { type: "kg", value: 60 }), {
        brief,
        percentTokens: new Set(["exercise_1"]),
      }),
    ).toContain("load");
  });
});

describe("unités et désignations proches", () => {
  it("une durée lue dans un nombre sans unité est une question ; secondes ou minutes écrites passent", () => {
    const plank = (durationS: number) =>
      proposal(session("2030-06-03", { durationS, reps: null, load: null, restS: null }, "exercise_3"));
    expect(plannerGuardIssues(plank(20), context("Le 3 juin, trois fois vingt de gainage ventral."))).toContain("unit");
    expect(plannerGuardIssues(plank(20), context("Le 3 juin, gainage ventral 3 × 20 secondes."))).toEqual([]);
    expect(plannerGuardIssues(plank(120), context("Le 3 juin, gainage ventral 3 × 2 minutes."))).toEqual([]);
  });
  it("un mot partagé par plusieurs fiches ne désigne aucune d'elles", () => {
    const catalog = [
      { token: "bench", name: "Développé couché", aliases: [] },
      { token: "military", name: "Développé militaire", aliases: [] },
      { token: "hang", name: "Épaulé suspension au-dessus des genoux", aliases: [] },
      { token: "power", name: "Épaulé puissance", aliases: [] },
      { token: "snatch", name: "Arraché suspension au-dessus des genoux", aliases: [] },
    ];
    expect(plannerExerciseIsApproximate("Mercredi, développé, trois séries de dix.", "bench", catalog)).toBe(false);
    expect(plannerExerciseIsApproximate("Mercredi, épaulé suspension puis épaulé puissance.", "hang", catalog)).toBe(
      true,
    );
  });
});

describe("pyramides et montées de charge", () => {
  it("des charges différentes série après série ne se contredisent pas ; une montée sans paliers est une question", () => {
    const text = "Le 3 juin, squat arrière en pyramide : 10, 8 puis 6 répétitions, à 40, 45 et 50 kg.";
    const value = proposal(session("2030-06-03")) as PlannerRichInterpretation;
    value.sessions[0]!.blocks[0]!.items[0]!.prescription = {
      ...prescription(),
      setPlan: [
        { reps: 10, load: { type: "kg", value: 40 }, warmup: false },
        { reps: 8, load: { type: "kg", value: 45 }, warmup: false },
        { reps: 6, load: { type: "kg", value: 50 }, warmup: false },
      ],
    };
    expect(plannerGuardIssues(value, context(text))).toEqual([]);
    expect(
      plannerRequiredFields(context("Le 3 juin, squat arrière : 5 séries de 2 en montant la charge jusqu'à 60 kg.")),
    ).toEqual(["load"]);
    expect(plannerRequiredFields(context(text))).toEqual([]);
  });
});

it("un nom court suivi du qualificatif d'une autre fiche ne désigne pas la variante sans qualificatif", () => {
  const catalog = [
    { token: "clean", name: "Épaulé", aliases: ["Clean"] },
    { token: "hang", name: "Épaulé suspension au-dessus des genoux", aliases: [] },
    { token: "power", name: "Épaulé puissance", aliases: [] },
    { token: "lunge", name: "Fentes avant", aliases: [] },
    { token: "walking", name: "Fentes marchées", aliases: ["Fentes avant marchées"] },
  ];
  const text = "Mercredi, épaulé suspension puis épaulé puissance, 3 séries de 2.";
  expect(plannerExerciseIsNamed(text, "clean", catalog)).toBe(false);
  expect(plannerExerciseIsNamed(text, "power", catalog)).toBe(true);
  expect(plannerExerciseIsNamed("Mercredi, épaulé, 3 séries de 2.", "clean", catalog)).toBe(true);
  expect(plannerExerciseIsNamed("Mardi, fentes avant, 3 x 8.", "lunge", catalog)).toBe(true);
});
