import { describe, expect, it } from "vitest";
import { plannerOpenSlots } from "@tartan/domain";
import { fakePlannerProvider } from "@/server/ai/fake-provider";
import {
  checkSession,
  composeSession,
  matchMovements,
  planComposition,
  PlannerProviderError,
  runPlannerPipeline,
  understandRequest,
  PLANNER_MAX_REPAIRS,
} from "@/server/ai/pipeline";
import {
  composed,
  fiche,
  node,
  pipelineContext,
  said,
  scripted,
  understanding,
  understoodSession,
} from "./planner-scripted";

// Les quatre étapes du planificateur, sans base : chacune seule contre le prestataire simulé, puis les
// comportements que les règles du serveur garantissent quel que soit le prestataire.

const library = [
  fiche(1, "Squat arrière", { aliases: ["Back squat"], unit: "repetitions" }),
  fiche(2, "Développé couché"),
  fiche(3, "Fentes avant", { family: "strength" }),
  fiche(4, "Fentes arrière", { family: "strength" }),
  fiche(5, "Gainage ventral", { family: "core", unit: "seconds" }),
];
const never = () => new AbortController().signal;
const itemsOf = (value: { sessions: { blocks: { items: { exerciseToken: string }[] }[] }[] }) =>
  value.sessions.flatMap((session) => session.blocks.flatMap((block) => block.items));

describe("chaque étape, seule, contre le prestataire simulé", () => {
  const text = "Demain pour group_1 : Squat arrière, 3 séries de 8, repos 90 secondes.";
  const context = pipelineContext(text, library);
  it("comprendre : la demande, sans la bibliothèque, et le résumé diffusé", async () => {
    const summaries: [string | null, boolean][] = [];
    const request = await understandRequest(context, fakePlannerProvider(), never(), (summary, done) =>
      summaries.push([summary, done]),
    );
    expect(request).toMatchObject({
      intent: "described",
      blockers: [],
      sessions: [
        {
          date: "2026-11-24",
          targetTokens: ["group_1"],
          movements: [{ id: "m1", said: "Squat arrière", prescription: "3 séries de 8, repos 90 secondes" }],
        },
      ],
    });
    expect(summaries[0]).toEqual([null, false]);
    expect(summaries.at(-1)).toEqual(["Tu décris une séance de 1 exercice.", true]);
    // Le résumé arrive aussi pendant qu'il s'écrit.
    expect(summaries.some(([summary, done]) => summary !== null && !done)).toBe(true);
  });
  it("comprendre ne reçoit jamais la bibliothèque", async () => {
    const provider = scripted({ understand: () => understanding() });
    await understandRequest(context, provider, never());
    const sent = JSON.stringify(provider.understand.mock.calls[0]![0]);
    for (const exercise of library) expect(sent).not.toContain(exercise.token);
    expect(sent).not.toContain("Back squat");
  });
  it("retrouver : les règles d'abord, puis un seul appel pour tous les termes restants", async () => {
    const provider = scripted({ understand: () => understanding() });
    const matches = await matchMovements(
      context,
      [
        { id: "m1", said: "squats arrière", prescription: null },
        { id: "m2", said: "dév couché", prescription: "4 x 6" },
        { id: "m3", said: "planche Copenhague", prescription: null },
      ],
      {
        ...provider,
        match: async (input) => {
          await provider.match(input);
          return {
            matches: [
              { id: "m2", confidence: "sure", key: "f1", others: [], suggestion: null },
              { id: "m3", confidence: "absent", key: null, others: ["f4"], suggestion: null },
            ],
          };
        },
      },
      never(),
    );
    expect(matches).toMatchObject([
      { id: "m1", confidence: "exact", exerciseToken: "exercise_1", source: "name" },
      { id: "m2", confidence: "sure", exerciseToken: "exercise_2", source: "model" },
      { id: "m3", confidence: "absent", exerciseToken: null, alternatives: ["exercise_5"] },
    ]);
    // Un seul appel, sans le terme déjà reconnu, avec cinq champs par fiche et rien d'autre.
    expect(provider.match).toHaveBeenCalledTimes(1);
    const sent = provider.match.mock.calls[0]![0];
    expect(sent.movements.map((movement) => movement.id)).toEqual(["m2", "m3"]);
    expect(sent.library).toHaveLength(library.length);
    expect(Object.keys(sent.library[0]!).sort()).toEqual(["aliases", "equipment", "family", "key", "name"]);
  });
  it("retrouver ne fait aucun appel quand les règles suffisent", async () => {
    const provider = scripted({ understand: () => understanding() });
    await matchMovements(context, [{ id: "m1", said: "back squat", prescription: null }], provider, never());
    expect(provider.match).not.toHaveBeenCalled();
  });
  it("composer : seules les fiches utiles partent, et la séance s'écrit en morceaux", async () => {
    const request = await understandRequest(context, fakePlannerProvider(), never());
    const matches = await matchMovements(context, request.sessions[0]!.movements, fakePlannerProvider(), never());
    const plan = planComposition(context, request, matches);
    expect(plan.input.exercises.map((exercise) => exercise.token)).toEqual(["exercise_1"]);
    expect(plan.input.candidates).toEqual([]);
    let written = "";
    const composition = await composeSession(plan.input, fakePlannerProvider(), never(), (delta) => {
      written += delta;
    });
    expect(JSON.parse(written)).toEqual(composition);
    expect(composition.sessions[0]!.blocks[0]!.content).toMatchObject([
      { kind: "exercise", movementId: "m1", exerciseToken: "exercise_1" },
    ]);
  });
  it("contrôler : la séance du prestataire simulé passe les règles sans réparation", async () => {
    const request = await understandRequest(context, fakePlannerProvider(), never());
    const matches = await matchMovements(context, request.sessions[0]!.movements, fakePlannerProvider(), never());
    const plan = planComposition(context, request, matches);
    const composition = await composeSession(plan.input, fakePlannerProvider(), never());
    const progress: [number, boolean][] = [];
    const value = await checkSession(context, request, plan, composition, fakePlannerProvider(), never(), (n, done) =>
      progress.push([n, done]),
    );
    expect(value.sessions).toMatchObject([{ date: "2026-11-24", targetTokens: ["group_1"] }]);
    expect(progress).toEqual([
      [0, false],
      [0, true],
    ]);
  });
});

describe("face au doute", () => {
  it("une fiche probable est posée dans la séance et marquée « À vérifier », avec les autres fiches possibles", async () => {
    const { interpretation } = await runPlannerPipeline(
      pipelineContext("Demain : fentes, 3 séries de 10.", library),
      fakePlannerProvider(),
    );
    expect(interpretation.status).toBe("proposal");
    expect(interpretation.sessions[0]!.blocks[0]!.items[0]).toMatchObject({
      // Deux fiches conviennent autant : la première par ordre de nom est posée, l'autre proposée.
      exerciseToken: "exercise_4",
      confidence: "probable",
      alternatives: ["exercise_3"],
      said: "fentes",
    });
    expect(interpretation.sessions[0]!.warnings).toContainEqual(
      expect.objectContaining({ code: "approximate_exercise", block: 0, item: 0 }),
    );
  });
  it("une fiche absente ne bloque pas : un emplacement à sa place, le reste de la séance écrit", async () => {
    const { interpretation } = await runPlannerPipeline(
      pipelineContext(
        "Demain : planche Copenhague, 3 séries de 20 secondes, puis Squat arrière, 3 séries de 8.",
        library,
      ),
      fakePlannerProvider(),
    );
    expect(interpretation.status).toBe("proposal");
    expect(interpretation.questions).toEqual([]);
    expect(itemsOf(interpretation).map((item) => item.exerciseToken)).toEqual(["slot_1", "exercise_1"]);
    expect(plannerOpenSlots(interpretation)).toMatchObject([
      { id: "slot_1", said: "planche Copenhague", session: 0, block: 0, item: 0, suggestion: { name: "Planche Copenhague" } },
    ]);
    expect(interpretation.understanding?.movements).toMatchObject([
      { said: "planche Copenhague", confidence: "absent", exerciseToken: null },
      { said: "Squat arrière", confidence: "exact", exerciseToken: "exercise_1" },
    ]);
  });
  it("une charge sans unité est laissée vide et signalée, sans question", async () => {
    const provider = scripted({
      understand: () =>
        understanding({ sessions: [understoodSession({ movements: [said("m1", "squat arrière", "4 fois 6 à 70")] })] }),
      compose: () => composed([node("m1", "exercise_1", { sets: 4, reps: 6, load: { type: "kg", value: 70 } })]),
    });
    const { interpretation } = await runPlannerPipeline(
      pipelineContext("Demain squat arrière 4 fois 6 à 70.", library),
      provider,
    );
    expect(interpretation.status).toBe("proposal");
    expect(interpretation.sessions[0]!.blocks[0]!.items[0]!.prescription.load).toBeNull();
    expect(interpretation.sessions[0]!.warnings).toContainEqual(
      expect.objectContaining({ code: "load_unclear", detail: "70" }),
    );
    expect(provider.repair).not.toHaveBeenCalled();
  });
});

describe("les seules questions qui arrêtent le coach", () => {
  it("aucun destinataire : une question, pas une erreur de saisie", async () => {
    const provider = scripted({ understand: () => understanding({ sessions: [understoodSession({ date: "2026-11-24" })] }) });
    const { interpretation } = await runPlannerPipeline(
      pipelineContext("Demain : squat arrière, 3 séries de 8.", library, {
        targetsChosen: false,
        targets: [
          { token: "group_1", kind: "group", phase: null },
          { token: "group_2", kind: "group", phase: null },
        ],
      }),
      provider,
    );
    expect(interpretation).toMatchObject({
      status: "clarification",
      sessions: [],
      questions: [{ field: "target", options: ["group_1", "group_2"] }],
    });
    // La question nomme ce dont elle parle, tient sur une ligne et finit par « ? ».
    expect(interpretation.questions[0]!.question).toMatch(/^[^\n]*groupe[^\n]*\?$/);
    expect(provider.match).not.toHaveBeenCalled();
    expect(provider.compose).not.toHaveBeenCalled();
  });
  it("aucune date déductible : la question cite les mots du coach", async () => {
    const provider = scripted({
      understand: () =>
        understanding({ sessions: [understoodSession({ dateSaid: "quand la météo le permettra" })] }),
    });
    const { interpretation } = await runPlannerPipeline(
      pipelineContext("Séance de côtes pour group_1 quand la météo le permettra.", library),
      provider,
    );
    expect(interpretation.status).toBe("clarification");
    expect(interpretation.questions).toMatchObject([{ field: "date", exerciseName: null }]);
    expect(interpretation.questions[0]!.question).toContain("quand la météo le permettra");
  });
  it("une demande hors sujet : une seule question, reconnaissable", async () => {
    const provider = scripted({ understand: () => understanding({ offTopic: true }) });
    const { interpretation } = await runPlannerPipeline(pipelineContext("Publie la séance de demain.", library), provider);
    expect(interpretation.questions).toMatchObject([{ id: "off-topic", field: "other" }]);
  });
  it("un jeton de destinataire n'est jamais pris pour un mouvement", async () => {
    const provider = scripted({
      understand: () =>
        understanding({
          sessions: [
            understoodSession({
              dateSaid: "quand la météo le permettra",
              movements: [said("m1", "group_1 quand la météo le permettra"), said("m2", "group_1")],
            }),
          ],
        }),
    });
    const { request } = await runPlannerPipeline(
      pipelineContext("group_1 quand la météo le permettra : 8 fois course en côte.", library),
      provider,
    );
    expect(request.sessions[0]!.movements.map((movement) => movement.said)).toEqual(["quand la météo le permettra"]);
    expect(JSON.stringify(request.sessions[0]!.movements)).not.toContain("group_1");
  });
});

describe("réparation ciblée", () => {
  const text = "Demain squat arrière 3 séries de 8 puis développé couché 4 fois 6.";
  const understand = () =>
    understanding({
      sessions: [
        understoodSession({
          movements: [said("m1", "squat arrière", "3 séries de 8"), said("m2", "développé couché", "4 fois 6")],
        }),
      ],
    });
  it("le modèle reçoit sa réponse fautive et la liste précise de ses défauts", async () => {
    const faulty = composed([node("m1", "exercise_1")]);
    const provider = scripted({
      understand,
      compose: () => faulty,
      repair: () => composed([node("m1", "exercise_1"), node("m2", "exercise_2", { sets: 4, reps: 6 })]),
    });
    const repairs: number[] = [];
    const { interpretation } = await runPlannerPipeline(pipelineContext(text, library), provider, {
      onChecking: (count) => repairs.push(count),
    });
    expect(provider.repair).toHaveBeenCalledTimes(1);
    const sent = provider.repair.mock.calls[0]![0];
    expect(sent.previousAnswer).toEqual(faulty);
    expect(sent.defects).toMatchObject([{ code: "missing_movement", session: 0, movementId: "m2" }]);
    expect(sent.defects[0]!.detail).toContain("développé couché");
    expect(itemsOf(interpretation).map((item) => item.exerciseToken)).toEqual(["exercise_1", "exercise_2"]);
    expect(repairs).toEqual([0, 1, 1]);
  });
  it("deux réparations au plus ; ce qui manque encore revient avec sa fiche, à compléter", async () => {
    const provider = scripted({ understand, compose: () => composed([node("m1", "exercise_1")]) });
    const { interpretation } = await runPlannerPipeline(pipelineContext(text, library), provider);
    // La réparation qui n'améliore rien n'est pas rejouée sans fin.
    expect(provider.repair.mock.calls.length).toBeLessThanOrEqual(PLANNER_MAX_REPAIRS);
    expect(itemsOf(interpretation).map((item) => item.exerciseToken)).toEqual(["exercise_1", "exercise_2"]);
    expect(interpretation.sessions[0]!.warnings).toContainEqual(expect.objectContaining({ code: "to_complete" }));
  });
  it("une réparation en panne n'est pas une panne : la meilleure réponse est gardée", async () => {
    const provider = scripted({
      understand,
      compose: () => composed([node("m1", "exercise_1"), node("m2", "exercise_2", { load: { type: "kg", value: 55 } })]),
      repair: () => {
        throw new PlannerProviderError("saturated");
      },
    });
    const { interpretation } = await runPlannerPipeline(pipelineContext(text, library), provider);
    expect(interpretation.status).toBe("proposal");
    // La charge que le coach n'a pas dite ne survit pas, réparation ou non.
    expect(interpretation.sessions[0]!.blocks[0]!.items[1]!.prescription.load).toBeNull();
  });
});

describe("pannes lisibles par étape", () => {
  it.each(["understand", "match", "compose"] as const)("une panne à l'étape %s porte son étape", async (step) => {
    const text = `Demain : planche Copenhague, 3 séries de 20 secondes. #panne-${step}-saturated`;
    await expect(runPlannerPipeline(pipelineContext(text, library), fakePlannerProvider())).rejects.toMatchObject({
      code: "saturated",
      step,
    });
  });
  it("une réponse hors contrat ou une erreur inattendue reste une réponse inexploitable, à son étape", async () => {
    const broken = scripted({ understand: () => ({ summary: "" }) as never });
    await expect(runPlannerPipeline(pipelineContext("Demain squat.", library), broken)).rejects.toMatchObject({
      code: "invalid_output",
      step: "understand",
    });
    const thrown = scripted({
      understand: () => understanding({ sessions: [understoodSession({ movements: [said("m1", "saut du dragon")] })] }),
      match: () => {
        throw new Error("détail interne");
      },
    });
    const error = await runPlannerPipeline(pipelineContext("Demain saut du dragon 3 x 5.", library), thrown).catch(
      (cause: unknown) => cause,
    );
    expect(error).toMatchObject({ code: "invalid_output", step: "match" });
    expect(String(error)).not.toContain("détail interne");
  });
  it("un délai dépassé se lit à l'étape en cours", async () => {
    const expired = AbortSignal.abort();
    await expect(
      understandRequest(pipelineContext("Demain squat.", library), fakePlannerProvider(), expired),
    ).rejects.toMatchObject({ code: "timeout", step: "understand" });
  });
});

describe("bibliothèque de 700 fiches", () => {
  const big = [
    ...Array.from({ length: 697 }, (_, i) => fiche(i + 1, `Mouvement privé ${i + 1}`, { family: "strength" })),
    fiche(698, "Réception caisson bas", { family: "plyometrics" }),
    fiche(699, "Réception caisson haut", { family: "plyometrics" }),
    fiche(700, "Tirage élastique maison"),
  ];
  it("aucune coupe : la dernière fiche se retrouve par son nom, et le modèle voit celles qui partagent un mot", async () => {
    const provider = scripted({
      understand: () =>
        understanding({
          sessions: [
            understoodSession({
              movements: [said("m1", "tirage élastique maison"), said("m2", "réception depuis un caisson")],
            }),
          ],
        }),
      match: (input) => ({
        matches: [
          {
            id: "m2",
            confidence: "probable",
            key: input.library.find((entry) => entry.name === "Réception caisson bas")!.key,
            others: [input.library.find((entry) => entry.name === "Réception caisson haut")!.key],
            suggestion: null,
          },
        ],
      }),
    });
    const { interpretation, matches } = await runPlannerPipeline(
      pipelineContext("Demain : tirage élastique maison 3 x 8, réception depuis un caisson 3 x 5.", big),
      provider,
    );
    expect(matches).toMatchObject([
      { confidence: "exact", exerciseToken: "exercise_700" },
      { confidence: "probable", exerciseToken: "exercise_698", alternatives: ["exercise_699"] },
    ]);
    const sent = provider.match.mock.calls[0]![0].library;
    expect(sent).toHaveLength(600);
    expect(sent.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(["Réception caisson bas", "Réception caisson haut"]),
    );
    expect(itemsOf(interpretation).map((item) => item.exerciseToken)).toEqual(["exercise_700", "exercise_698"]);
    // « Composer » ne reçoit que les fiches retrouvées, jamais la bibliothèque.
    expect(provider.compose.mock.calls[0]![0].exercises.map((exercise) => exercise.token)).toEqual([
      "exercise_700",
      "exercise_698",
    ]);
  });
});

describe("partie à composer", () => {
  it("20 à 40 fiches candidates, choisies par règles, et jamais de kilos", async () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      fiche(i + 1, `Fiche ${i + 1}`, {
        family: i % 2 ? "core" : "plyometrics",
        approved: i !== 0,
        classification: { movement: null, equipment: i === 1 ? ["barbell"] : [] },
      }),
    );
    const provider = scripted({
      understand: () =>
        understanding({
          intent: "objective",
          sessions: [
            understoodSession({
              date: "2026-11-26",
              dateSaid: "jeudi",
              proposal: {
                objective: "Tronc et pliométrie légère",
                durationMin: 40,
                level: null,
                equipment: ["bodyweight"],
                families: ["core", "plyometrics"],
              },
            }),
          ],
        }),
      compose: (input) =>
        composed([
          node(null, input.candidates[0]!, { load: { type: "kg", value: 20 } }),
          node(null, input.candidates[1]!, { load: { type: "pct_1rm", value: 70 } }),
        ]),
    });
    const { interpretation } = await runPlannerPipeline(
      pipelineContext("Jeudi, tronc et pliométrie légère pour group_1, 40 minutes, sans matériel.", many),
      provider,
    );
    const sent = provider.compose.mock.calls[0]![0];
    expect(sent.candidates.length).toBeGreaterThanOrEqual(20);
    expect(sent.candidates.length).toBeLessThanOrEqual(40);
    // Ni la fiche non relue, ni celle qui demande une barre.
    expect(sent.candidates).not.toContain("exercise_1");
    expect(sent.candidates).not.toContain("exercise_2");
    expect(sent.exercises).toHaveLength(sent.candidates.length);
    expect(interpretation.sessions[0]).toMatchObject({ date: "2026-11-26", durationMin: 40 });
    expect(interpretation.sessions[0]!.blocks[0]!.items.map((item) => item.prescription.load)).toEqual([null, null]);
  });
});
