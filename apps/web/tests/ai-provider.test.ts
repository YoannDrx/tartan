import { plannerInterpretation } from "@tartan/contracts";
import { beforeEach, expect, it, vi } from "vitest";
import { openAiPlannerProvider, type PlannerProviderContext } from "@/server/ai/provider";
const settings = vi.hoisted(() => ({
  AI_PLANNER_ENABLED: "true" as string | undefined,
  AI_PLANNER_MODEL: "gpt-4.1-mini",
  OPENAI_API_KEY: undefined as string | undefined,
  OPEN_AI_API_KEY: "test-only",
}));
vi.mock("@/lib/env", () => ({ env: () => settings }));
const context: PlannerProviderContext = {
  period: { from: "2026-11-09", to: "2026-11-15" },
  today: "2026-11-08",
  timeZone: "Europe/Paris",
  targets: [{ token: "group_1", kind: "group", phase: null }],
  exercises: [{ token: "exercise_1", name: "Squat", category: "strength", aliases: [] }],
  instructions: ["Demain : squat."],
};
const clarification = {
  status: "clarification",
  sessions: [],
  assumptions: [],
  suggestions: [],
  questions: [
    { id: "rest", field: "rest", question: "Quelles séries, répétitions, charge et récupération ?", options: [] },
  ],
};
const completed = (value: unknown = clarification) => ({
  status: "completed",
  output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }],
});
const transport = (value: unknown = completed(), status = 200) =>
  vi.fn<typeof fetch>(async () => Response.json(value, { status }));
beforeEach(() => {
  settings.AI_PLANNER_ENABLED = "true";
  settings.OPENAI_API_KEY = undefined;
});
it("utilise l’alias local, une sortie stricte et store:false sans outil ni historique distant", async () => {
  const fetcher = transport();
  expect(await openAiPlannerProvider(fetcher).interpret(context)).toEqual(clarification);
  const [url, request] = fetcher.mock.calls[0]!;
  expect(url).toBe("https://api.openai.com/v1/responses");
  expect(new Headers(request?.headers).get("Authorization")).toBe("Bearer test-only");
  const body = JSON.parse(String(request?.body));
  expect(body).toMatchObject({
    model: "gpt-4.1-mini",
    store: false,
    text: { format: { type: "json_schema", strict: true } },
  });
  expect(JSON.stringify(body.text.format.schema)).not.toContain('"oneOf"');
  expect(
    body.text.format.schema.properties.sessions.items.properties.blocks.items.properties.content.items.anyOf,
  ).toHaveLength(3);
  expect(body).not.toHaveProperty("tools");
  expect(body).not.toHaveProperty("previous_response_id");
  expect(JSON.parse(body.input)).toEqual({
    ...context,
    ambiguousExerciseTerms: [],
    namedExercises: [{ term: "squat", token: "exercise_1" }],
    dateHints: {
      todayWeekday: "dimanche",
      days: [
        { date: "2026-11-09", weekday: "lundi" },
        { date: "2026-11-10", weekday: "mardi" },
        { date: "2026-11-11", weekday: "mercredi" },
        { date: "2026-11-12", weekday: "jeudi" },
        { date: "2026-11-13", weekday: "vendredi" },
        { date: "2026-11-14", weekday: "samedi" },
        { date: "2026-11-15", weekday: "dimanche" },
      ],
      relative: {
        avantHier: "2026-11-06",
        hier: "2026-11-07",
        aujourdHui: "2026-11-08",
        demain: "2026-11-09",
        apresDemain: "2026-11-10",
      },
    },
  });
  expect(body.temperature).toBe(0);
});
it("le drapeau global coupe tout appel et le nom standard prend priorité sur l’alias", async () => {
  const fetcher = transport();
  settings.AI_PLANNER_ENABLED = "false";
  await expect(openAiPlannerProvider(fetcher).interpret(context)).rejects.toMatchObject({ code: "disabled" });
  expect(fetcher).not.toHaveBeenCalled();
  settings.AI_PLANNER_ENABLED = "true";
  settings.OPENAI_API_KEY = "standard-test-only";
  await openAiPlannerProvider(fetcher).interpret(context);
  expect(new Headers(fetcher.mock.calls[0]![1]?.headers).get("Authorization")).toBe("Bearer standard-test-only");
});
it("sans drapeau, le planificateur dépend de la clé ; false reste un coupe-circuit", async () => {
  settings.AI_PLANNER_ENABLED = undefined;
  await expect(openAiPlannerProvider(transport()).interpret(context)).resolves.toMatchObject({
    status: "clarification",
  });
  settings.OPEN_AI_API_KEY = undefined as unknown as string;
  const fetcher = transport();
  await expect(openAiPlannerProvider(fetcher).interpret(context)).rejects.toMatchObject({ code: "disabled" });
  expect(fetcher).not.toHaveBeenCalled();
  settings.OPEN_AI_API_KEY = "test-only";
});
const proposalFor = (instruction: string, sessions: { date: string; targetTokens?: string[] }[]) => ({
  status: "proposal",
  questions: [],
  assumptions: [],
  suggestions: [],
  sessions: sessions.map((session) => ({
    date: session.date,
    startTime: null,
    title: "Force",
    type: "strength",
    durationMin: null,
    targetTokens: session.targetTokens ?? ["group_1"],
    blocks: [
      {
        name: "Force",
        items: [
          {
            exerciseToken: "exercise_1",
            instruction,
            prescription: {
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
            },
          },
        ],
      },
    ],
  })),
});
it("une date ou une habitude contredite par la consigne devient une question sans séance", async () => {
  const hier = "Hier : squat, 3 séries de 4 à 40 kg, repos 120 secondes.";
  const fetcher = transport(completed(proposalFor(hier, [{ date: "2026-11-09" }])));
  await expect(openAiPlannerProvider(fetcher).interpret({ ...context, instructions: [hier] })).resolves.toMatchObject({
    status: "clarification",
    sessions: [],
    questions: [{ field: "date" }],
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("une proposition vide devient une question, sans erreur pour le coach", async () => {
  const fetcher = transport(completed(proposalFor("Demain : squat.", [])));
  await expect(openAiPlannerProvider(fetcher).interpret(context)).resolves.toMatchObject({
    status: "clarification",
    sessions: [],
    questions: [{ id: "empty-proposal", field: "other" }],
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("restaure une citation altérée au lieu de rejeter toute la proposition", async () => {
  const text = "Demain : Squat, 3 séries de 4 à 40 kg, repos 120 secondes.";
  const altered = "demain : squat, 3 séries de 4 à 40 kg, repos 120 secondes";
  const fetcher = transport(completed(proposalFor(altered, [{ date: "2026-11-09" }])));
  const result = await openAiPlannerProvider(fetcher).interpret({ ...context, instructions: [text] });
  expect(result.status).toBe("proposal");
  expect(text).toContain(result.sessions[0]!.blocks[0]!.items[0]!.instruction);
});
it("demande une seule reprise quand un jour cité manque, puis pose la question", async () => {
  const text = "Le 9 novembre et le 12 novembre pour group_1 : squat, 3 séries de 4 à 40 kg, repos 120 secondes.";
  const truncated = proposalFor(text, [{ date: "2026-11-09" }]);
  const complete = proposalFor(text, [{ date: "2026-11-09" }, { date: "2026-11-12" }]);
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(completed(truncated)))
    .mockResolvedValueOnce(Response.json(completed(complete)));
  await expect(openAiPlannerProvider(fetcher).interpret({ ...context, instructions: [text] })).resolves.toMatchObject({
    status: "proposal",
    sessions: [{ date: "2026-11-09" }, { date: "2026-11-12" }],
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0]![1]?.signal).toBe(fetcher.mock.calls[1]![1]?.signal);
  expect(JSON.parse(JSON.parse(String(fetcher.mock.calls[1]![1]?.body)).input).correction).toBeTruthy();
  const stillTruncated = vi.fn<typeof fetch>(async () => Response.json(completed(truncated)));
  await expect(
    openAiPlannerProvider(stillTruncated).interpret({ ...context, instructions: [text] }),
  ).resolves.toMatchObject({ status: "clarification", questions: [{ field: "date" }] });
  expect(stillTruncated).toHaveBeenCalledTimes(2);
});
it("transmet les collisions de termes sans choisir arbitrairement une variante", async () => {
  const fetcher = transport();
  const input: PlannerProviderContext = {
    ...context,
    exercises: [
      { token: "exercise_1", name: "Squat arrière", category: "strength", aliases: ["Squat"] },
      { token: "exercise_2", name: "Squat avant", category: "strength", aliases: ["squat"] },
    ],
  };
  await openAiPlannerProvider(fetcher).interpret(input);
  const body = JSON.parse(String(fetcher.mock.calls[0]![1]?.body));
  expect(JSON.parse(body.input)).toMatchObject({
    exercises: input.exercises,
    ambiguousExerciseTerms: [{ term: "Squat", exerciseTokens: ["exercise_1", "exercise_2"] }],
  });
});
it("n'annonce pas une ambiguïté absente ou déjà résolue par le nom complet", async () => {
  const exercises: PlannerProviderContext["exercises"] = [
    { token: "exercise_1", name: "Squat arrière", category: "strength", aliases: ["Squat", "Back squat"] },
    { token: "exercise_2", name: "Squat avant", category: "strength", aliases: ["squat"] },
    { token: "exercise_3", name: "Accélérations", category: "running_drill", aliases: [] },
  ];
  for (const instruction of [
    "Back squat, 3 séries de 4 à 40 kg, repos 120 secondes.",
    "Accélérations : 4 fois 30 mètres, repos 120 secondes.",
  ]) {
    const fetcher = transport();
    await openAiPlannerProvider(fetcher).interpret({ ...context, exercises, instructions: [instruction] });
    expect(JSON.parse(JSON.parse(String(fetcher.mock.calls[0]![1]?.body)).input).ambiguousExerciseTerms).toEqual([]);
  }
});
it("remplace une attribution ambiguë du modèle par une question, sans nouvelle génération", async () => {
  const input: PlannerProviderContext = {
    ...context,
    instructions: ["Demain pour group_1 : squat, 3 séries de 4 à 40 kg, repos 120 secondes."],
    exercises: [
      { token: "exercise_1", name: "Squat arrière", category: "strength", aliases: ["Squat"] },
      { token: "exercise_2", name: "Squat avant", category: "strength", aliases: ["squat"] },
    ],
  };
  const result = {
    status: "proposal",
    questions: [],
    assumptions: [],
    suggestions: [],
    sessions: [
      {
        date: "2026-11-09",
        startTime: null,
        title: "Force",
        type: "strength",
        durationMin: null,
        targetTokens: ["group_1"],
        blocks: [
          {
            name: "Force",
            items: [
              {
                exerciseToken: "exercise_1",
                instruction: input.instructions[0],
                prescription: {
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
                },
              },
            ],
          },
        ],
      },
    ],
  };
  const fetcher = transport(completed(result));
  expect(await openAiPlannerProvider(fetcher).interpret(input)).toMatchObject({
    status: "clarification",
    sessions: [],
    questions: [{ field: "exercise", options: ["Squat arrière", "Squat avant"] }],
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  const clarified = { ...input, instructions: [...input.instructions, "Je choisis le squat arrière."] };
  expect(await openAiPlannerProvider(transport(completed(result))).interpret(clarified)).toEqual({
    ...result,
    sessions: result.sessions.map((session) => ({ ...session, warnings: [] })),
  });
});
it("refuse un contexte enrichi de données privées avant tout appel", async () => {
  const fetcher = transport();
  await expect(
    openAiPlannerProvider(fetcher).interpret({ ...context, privateNotes: "private" } as PlannerProviderContext),
  ).rejects.toMatchObject({ code: "configuration" });
  await expect(
    openAiPlannerProvider(fetcher).interpret({ ...context, targets: [...context.targets, ...context.targets] }),
  ).rejects.toMatchObject({ code: "configuration" });
  await expect(openAiPlannerProvider(fetcher).interpret({ ...context, timeZone: "invalid" })).rejects.toMatchObject({
    code: "configuration",
  });
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([
  [{ status: "incomplete", output: [] }, "incomplete"],
  [
    { status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "secret" }] }] },
    "refused",
  ],
  [
    { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "invalid secret" }] }] },
    "invalid_output",
  ],
  [completed({ ...clarification, status: "proposal" }), "invalid_output"],
  [{ status: "completed", output: [] }, "invalid_output"],
])("refuse une réponse inutilisable sans reprendre son contenu dans l’erreur", async (body, code) => {
  const fetcher = transport(body);
  await expect(openAiPlannerProvider(fetcher).interpret(context)).rejects.toMatchObject({
    code,
    message: `planner_${code}`,
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([
  [401, "configuration"],
  [403, "configuration"],
  [404, "configuration"],
  [400, "configuration"],
  [429, "saturated"],
  [500, "unavailable"],
  [503, "unavailable"],
] as const)(
  "classe l’erreur HTTP %i en %s, sans reprendre le corps ni rejouer une génération facturable",
  async (status, code) => {
    const fetcher = transport({ error: { message: "sensitive-provider-message" } }, status);
    const failure = await openAiPlannerProvider(fetcher)
      .interpret(context)
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({ code, message: `planner_${code}` });
    expect(JSON.stringify(failure)).not.toContain("sensitive");
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);
it("distingue une panne réseau d’un délai dépassé", async () => {
  const network = vi.fn<typeof fetch>(async () => {
    throw new Error("sensitive-network-message");
  });
  await expect(openAiPlannerProvider(network).interpret(context)).rejects.toMatchObject({ code: "unavailable" });
  const slow = vi.fn<typeof fetch>(async () => {
    throw new DOMException("The operation timed out.", "TimeoutError");
  });
  await expect(openAiPlannerProvider(slow).interpret(context)).rejects.toMatchObject({ code: "timeout" });
  const failed = transport({ status: "failed", output: [] });
  await expect(openAiPlannerProvider(failed).interpret(context)).rejects.toMatchObject({ code: "unavailable" });
});
it.each(["date", "target"] as const)("transforme un %s hors périmètre en clarification sans séance", async (field) => {
  const result = {
    status: "proposal",
    questions: [],
    assumptions: [],
    suggestions: [],
    sessions: [
      {
        date: field === "date" ? "2026-11-08" : "2026-11-09",
        startTime: null,
        title: "Force",
        type: "strength",
        durationMin: null,
        targetTokens: [field === "target" ? "athlete_999" : "group_1"],
        blocks: [
          {
            name: "Force",
            items: [
              {
                exerciseToken: "exercise_1",
                instruction: context.instructions[0],
                prescription: {
                  sets: 3,
                  reps: 4,
                  restS: 120,
                  load: { type: "kg", value: 40 },
                  intensityTarget: null,
                  distanceM: null,
                  durationS: null,
                  contacts: null,
                  tempo: null,
                  notes: null,
                },
              },
            ],
          },
        ],
      },
    ],
  };
  const fetcher = transport(completed(result));
  expect(await openAiPlannerProvider(fetcher).interpret(context)).toMatchObject({
    status: "clarification",
    sessions: [],
    questions: [{ field }],
    assumptions: [],
    suggestions: [],
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("accepte uniquement les métadonnées sportives connues, sans notes ni champ privé imbriqué", async () => {
  const fetcher = transport();
  const exercise = {
    ...context.exercises[0]!,
    classification: { movement: "squat" as const, equipment: ["barbell" as const] },
    strengthLoadKind: "external_total" as const,
  };
  await openAiPlannerProvider(fetcher).interpret({ ...context, exercises: [exercise] });
  const sent = JSON.parse(JSON.parse(String(fetcher.mock.calls[0]![1]?.body)).input);
  expect(sent.exercises).toEqual([exercise]);
  for (const invalid of [
    { ...exercise, classification: { ...exercise.classification, privateNotes: "secret" } },
    { ...exercise, classification: { ...exercise.classification, equipment: ["unknown"] } },
    { ...exercise, strengthLoadKind: "unknown" },
  ]) {
    await expect(
      openAiPlannerProvider(fetcher).interpret({ ...context, exercises: [invalid] } as PlannerProviderContext),
    ).rejects.toMatchObject({ code: "configuration" });
  }
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("corrige une structure invalide une seule fois sans multiplier les séries", async () => {
  const instruction = "Demain : squat, 3 séries de 4 à 40 kg, repos 120 secondes.";
  const valid = proposalFor(instruction, [{ date: "2026-11-09" }]);
  const block = valid.sessions[0]!.blocks[0]!;
  const malformed = {
    ...valid,
    sessions: [
      {
        ...valid.sessions[0],
        blocks: [
          {
            ...block,
            items: block.items.map((item) => ({ ...item, ref: "squat" })),
            sequence: [
              { kind: "exercise", itemRef: "squat" },
              { kind: "exercise", itemRef: "squat" },
            ],
          },
        ],
      },
    ],
  };
  const fetcher = transport(completed(malformed));
  fetcher
    .mockResolvedValueOnce(Response.json(completed(malformed)))
    .mockResolvedValueOnce(Response.json(completed(valid)));
  const result = await openAiPlannerProvider(fetcher).interpret({ ...context, instructions: [instruction] });
  expect(result.status).toBe("proposal");
  expect(result.sessions[0]?.blocks[0]?.items[0]?.prescription.sets).toBe(3);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0]![1]?.signal).toBe(fetcher.mock.calls[1]![1]?.signal);
  expect(JSON.parse(JSON.parse(String(fetcher.mock.calls[1]![1]?.body)).input).correction).toContain("content");
  const repeated = transport(completed(malformed));
  await expect(
    openAiPlannerProvider(repeated).interpret({ ...context, instructions: [instruction] }),
  ).rejects.toMatchObject({ code: "invalid_output" });
  expect(repeated).toHaveBeenCalledTimes(2);
});

it("préserve un bloc de récupération après validation et réattachement des citations", async () => {
  const instruction = "Demain : squat, 3 séries de 4 à 40 kg, repos 120 secondes. Puis récupération 75 secondes.";
  const value = plannerInterpretation.parse(proposalFor(instruction, [{ date: "2026-11-09" }]));
  value.sessions[0]!.blocks.push({
    name: "Récupération finale",
    items: [],
    sequence: [{ kind: "recovery", ref: "final-rest", durationS: 75 }],
  });
  const fetcher = transport(completed(value));
  const result = await openAiPlannerProvider(fetcher).interpret({ ...context, instructions: [instruction] });
  expect(result.status).toBe("proposal");
  expect(result.sessions[0]!.blocks).toHaveLength(2);
  expect(result.sessions[0]!.blocks[1]).toEqual(value.sessions[0]!.blocks[1]);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("refuse un lundi inventé pour une consigne du mercredi même si sa citation omet le jour", async () => {
  const instruction = "Mercredi : squat, 3 séries de 4 à 40 kg, repos 120 secondes.";
  const wrong = proposalFor(instruction, [{ date: "2026-11-09" }]);
  wrong.sessions[0]!.blocks[0]!.items[0]!.instruction = "squat, 3 séries de 4 à 40 kg, repos 120 secondes.";
  const result = await openAiPlannerProvider(transport(completed(wrong))).interpret({
    ...context,
    instructions: [instruction],
  });
  expect(result).toMatchObject({ status: "clarification", sessions: [], questions: [{ field: "date" }] });
});

it("refuse de remplacer un power clean par le clean dont l’alias est plus court", async () => {
  const instruction = "Mercredi : power clean, 3 séries de 4 à 40 kg, repos 120 secondes.";
  const wrong = proposalFor(instruction, [{ date: "2026-11-11" }]);
  const fetcher = transport(completed(wrong));
  const result = await openAiPlannerProvider(fetcher).interpret({
    ...context,
    instructions: [instruction],
    exercises: [
      { token: "exercise_1", name: "Épaulé", category: "strength", aliases: ["clean"] },
      { token: "exercise_2", name: "Épaulé puissance", category: "strength", aliases: ["power clean"] },
    ],
  });
  expect(result).toMatchObject({ status: "clarification", sessions: [], questions: [{ field: "exercise" }] });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("place en récupération explicite une pause qui serait perdue après une série unique, sans nouvel appel", async () => {
  const instruction = "Demain : squat, une série de quatre à 40 kg, puis récupération 120 secondes.";
  const wrong = plannerInterpretation.parse(proposalFor(instruction, [{ date: "2026-11-09" }]));
  const block = wrong.sessions[0]!.blocks[0]!;
  block.items[0]!.ref = "squat";
  block.items[0]!.prescription.sets = 1;
  block.sequence = [{ kind: "exercise", itemRef: "squat" }];
  const fetcher = transport(completed(wrong));
  const result = await openAiPlannerProvider(fetcher).interpret({ ...context, instructions: [instruction] });
  expect(result).toMatchObject({
    status: "proposal",
    sessions: [
      {
        warnings: [],
        blocks: [
          {
            items: [{ prescription: { sets: 1, restS: null } }],
            sequence: [{ kind: "exercise" }, { kind: "recovery", durationS: 120 }],
          },
        ],
      },
    ],
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  // Dans un circuit, la pause entre gestes relève du modèle : elle reste signalée après une correction.
  const nested = structuredClone(wrong);
  nested.sessions[0]!.blocks[0]!.sequence = [
    {
      kind: "repeat",
      ref: "tours",
      name: "Tours",
      rounds: 2,
      restBetweenRoundsS: 0,
      children: [{ kind: "exercise", itemRef: "squat" }],
    },
  ];
  const twice = transport(completed(nested));
  const kept = await openAiPlannerProvider(twice).interpret({
    ...context,
    instructions: ["Demain : squat, deux tours d'une série de quatre à 40 kg, puis récupération 120 secondes."],
  });
  expect(kept.sessions[0]!.warnings).toContainEqual(expect.objectContaining({ code: "rest_not_executed" }));
  expect(twice).toHaveBeenCalledTimes(2);
});
it("ajoute la question qu'aucune réponse ne peut deviner : unité absente, habitude sans historique", async () => {
  const exerciseQuestion = {
    ...clarification,
    questions: [{ id: "q", field: "exercise", question: "Quel gainage ?", exerciseName: null, options: [] }],
  };
  const unit = await openAiPlannerProvider(transport(completed(exerciseQuestion))).interpret({
    ...context,
    exercises: [{ token: "exercise_1", name: "Gainage ventral", category: "strength", aliases: [] }],
    instructions: ["Demain, trois fois vingt de gainage."],
  });
  expect(unit.questions.map((q) => q.field)).toEqual(["unit", "exercise"]);
  const habit = await openAiPlannerProvider(transport(completed(exerciseQuestion))).interpret({
    ...context,
    instructions: ["Fais les squats habituels demain."],
  });
  expect(habit.questions.map((q) => q.field)).toEqual(["load", "exercise"]);
});

it("propose avec le matériel disponible, une charge nulle dans le schéma et une explication générée", async () => {
  const result = plannerInterpretation.parse(
    proposalFor("Choix proposé pour renforcer les jambes.", [{ date: "2026-11-09" }]),
  );
  result.sessions[0]!.durationMin = 30;
  result.sessions[0]!.blocks[0]!.items[0]!.prescription.load = null;
  const proposedContext: PlannerProviderContext = {
    ...context,
    mode: "propose",
    brief: {
      objective: "Force générale",
      date: "2026-11-09",
      durationMin: 40,
      level: "beginner",
      equipment: ["haltères"],
    },
    exercises: [
      { ...context.exercises[0]!, classification: { movement: "squat", equipment: [] } },
      {
        token: "exercise_2",
        name: "Développé sur banc",
        aliases: [],
        category: "strength",
        classification: { movement: "push", equipment: ["dumbbells", "bench"] },
      },
      { token: "exercise_3", name: "Fiche inconnue", aliases: [], category: "strength", classification: null },
    ],
  };
  const fetcher = transport(completed(result));
  expect((await openAiPlannerProvider(fetcher).interpret(proposedContext)).status).toBe("proposal");
  const body = JSON.parse(String(fetcher.mock.calls[0]![1]?.body));
  expect(JSON.parse(body.input).exercises.map((e: { token: string }) => e.token)).toEqual(["exercise_1"]);
  const item =
    body.text.format.schema.properties.sessions.items.properties.blocks.items.properties.content.items.anyOf.find(
      (node: { properties: { kind: { const: string } } }) => node.properties.kind.const === "exercise",
    );
  expect(Object.keys(item.properties)[0]).toBe("kind");
  expect(item.properties.prescription.properties.load).toEqual({ type: "null" });
  expect(item.properties.exerciseToken.enum).toEqual(["exercise_1"]);
  const wrong = structuredClone(result);
  wrong.sessions[0]!.blocks[0]!.items[0]!.exerciseToken = "exercise_2";
  await expect(openAiPlannerProvider(transport(completed(wrong))).interpret(proposedContext)).rejects.toMatchObject({
    code: "invalid_output",
  });
});
it("en mode « Proposer », pose lui-même la date, l'heure, les destinataires et la durée de la demande", async () => {
  settings.OPENAI_API_KEY = "standard-test-only";
  const brief = {
    objective: "Force générale",
    date: "2026-11-09",
    durationMin: 40,
    level: "beginner" as const,
    equipment: [],
  };
  const proposedContext: PlannerProviderContext = {
    ...context,
    mode: "propose",
    brief,
    startTime: "18:30",
    targets: [...context.targets, { token: "athlete_1", kind: "athlete", phase: null }],
    exercises: [{ ...context.exercises[0]!, classification: { movement: "squat", equipment: [] } }],
  };
  const generated = {
    status: "proposal",
    questions: [],
    assumptions: ["Volume modéré pour un niveau débutant."],
    suggestions: [],
    sessions: [
      {
        title: "Force",
        type: "strength",
        durationMin: 55,
        blocks: [
          {
            name: "Principal",
            content: [
              {
                kind: "exercise",
                exerciseToken: "exercise_1",
                instruction: "Base du travail des jambes.",
                autonomous: null,
                prescription: {
                  ...proposalFor("x", [{ date: "2026-11-09" }]).sessions[0]!.blocks[0]!.items[0]!.prescription,
                  load: null,
                  setPlan: null,
                },
              },
            ],
          },
        ],
      },
    ],
  };
  const fetcher = transport(completed(generated));
  const result = await openAiPlannerProvider(fetcher).interpret(proposedContext);
  expect(result).toMatchObject({
    status: "proposal",
    sessions: [{ date: "2026-11-09", startTime: "18:30", targetTokens: ["group_1", "athlete_1"], durationMin: 40 }],
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  // Le modèle ne reçoit ni date à choisir, ni destinataire à écrire : son schéma ne les contient pas.
  const schema = JSON.parse(String(fetcher.mock.calls[0]![1]?.body)).text.format.schema;
  expect(Object.keys(schema.properties.sessions.items.properties).sort()).toEqual([
    "blocks",
    "durationMin",
    "title",
    "type",
  ]);
});
it("demande du matériel précis sans appel au modèle si aucune fiche n’est compatible", async () => {
  const fetcher = transport();
  const result = await openAiPlannerProvider(fetcher).interpret({
    ...context,
    mode: "propose",
    brief: { objective: "Force", date: "2026-11-09", durationMin: 30, level: "beginner", equipment: [] },
  });
  expect(result).toMatchObject({ status: "clarification", sessions: [], questions: [{ id: "equipment" }] });
  expect(fetcher).not.toHaveBeenCalled();
});

it("respecte une correspondance choisie explicitement sans boucler sur l’alias ambigu", async () => {
  const instruction = "Demain : squat, 3 séries de 4 à 40 kg, repos 120 secondes.";
  const resolved: PlannerProviderContext = {
    ...context,
    instructions: [instruction],
    exercises: [
      { token: "exercise_1", name: "Squat arrière", category: "strength", aliases: ["squat"] },
      { token: "exercise_2", name: "Squat avant", category: "strength", aliases: ["squat"] },
    ],
    resolvedExercises: [{ term: "squat", token: "exercise_1" }],
  };
  const valid = proposalFor(instruction, [{ date: "2026-11-09" }]);
  expect((await openAiPlannerProvider(transport(completed(valid))).interpret(resolved)).status).toBe("proposal");
  valid.sessions[0]!.blocks[0]!.items[0]!.exerciseToken = "exercise_2";
  expect(await openAiPlannerProvider(transport(completed(valid))).interpret(resolved)).toMatchObject({
    status: "clarification",
    questions: [{ field: "exercise" }],
  });
});

it("après un exercice substitué, redemande une clarification nommée avec une seule reprise", async () => {
  const instruction = "Demain : marche du dragon, 3 séries de 4 à 40 kg, repos 120 secondes.";
  const wrong = proposalFor(instruction, [{ date: "2026-11-09" }]);
  const unknown = {
    ...clarification,
    questions: [
      {
        id: "unknown",
        field: "exercise",
        question: "Quelle fiche correspond à la marche du dragon ?",
        exerciseName: "marche du dragon",
        options: [],
      },
    ],
  };
  const fetcher = transport(completed(wrong));
  fetcher
    .mockResolvedValueOnce(Response.json(completed(wrong)))
    .mockResolvedValueOnce(Response.json(completed(unknown)));
  // Le nom inconnu, placé devant sa prescription, est repéré avant tout appel : aucune substitution possible.
  expect(await openAiPlannerProvider(fetcher).interpret({ ...context, instructions: [instruction] })).toMatchObject({
    status: "clarification",
    questions: [{ exerciseName: "marche du dragon" }],
  });
  expect(fetcher).not.toHaveBeenCalled();
  // Sans prescription qui le suive, il revient au modèle : une substitution est corrigée une fois.
  const loose = "Demain : 3 séries de 4 à 40 kg de marche du dragon, repos 120 secondes.";
  const substituted = proposalFor(loose, [{ date: "2026-11-09" }]);
  const second = transport(completed(substituted));
  second
    .mockResolvedValueOnce(Response.json(completed(substituted)))
    .mockResolvedValueOnce(Response.json(completed(unknown)));
  expect(await openAiPlannerProvider(second).interpret({ ...context, instructions: [loose] })).toMatchObject({
    status: "clarification",
    questions: [{ exerciseName: "marche du dragon" }],
  });
  expect(second).toHaveBeenCalledTimes(2);
});

it("convertit la réponse ordonnée du modèle en circuit sans fabriquer un exercice pour le repos", async () => {
  const instruction = "Demain : squat, 2 tours de 4 à 40 kg avec 120 secondes entre les tours, sans repos final.";
  const legacy = proposalFor(instruction, [{ date: "2026-11-09" }]);
  const item = legacy.sessions[0]!.blocks[0]!.items[0]!;
  const generated = {
    ...legacy,
    sessions: [
      {
        ...legacy.sessions[0],
        blocks: [
          {
            name: "Force",
            content: [
              {
                kind: "repeat",
                name: "Tours",
                rounds: 2,
                restBetweenRoundsS: 120,
                children: [
                  {
                    ...item,
                    kind: "exercise",
                    autonomous: null,
                    prescription: { ...item.prescription, sets: 1, restS: 0, setPlan: null },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const result = await openAiPlannerProvider(transport(completed(generated))).interpret({
    ...context,
    instructions: [instruction],
  });
  expect(result.status).toBe("proposal");
  expect(result.sessions[0]!.blocks[0]!.items).toHaveLength(1);
  expect(result.sessions[0]!.blocks[0]!.sequence).toMatchObject([
    { kind: "repeat", rounds: 2, restBetweenRoundsS: 120, children: [{ kind: "exercise" }] },
  ]);
});

it("ne conserve jamais une séance amputée après une citation sans attache", async () => {
  const instruction = "Demain : squat, 3 séries de 4 à 40 kg, repos 120 secondes, puis marche du dragon.";
  const wrong = proposalFor(instruction, [{ date: "2026-11-09" }]);
  const block = wrong.sessions[0]!.blocks[0]!;
  block.items.push({ ...block.items[0]!, exerciseToken: "exercise_2", instruction: "Mouvement ajouté sans source" });
  const fetcher = transport(completed(wrong));
  const result = await openAiPlannerProvider(fetcher).interpret({
    ...context,
    instructions: [instruction],
    exercises: [...context.exercises, { token: "exercise_2", name: "Pompes", category: "strength", aliases: [] }],
  });
  expect(result).toMatchObject({ status: "clarification", sessions: [], questions: [{ field: "exercise" }] });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("signale un circuit dont les tours ont été omis après une seule correction, sans le refuser", async () => {
  const instruction =
    "Demain : circuit trois tours de squat, quatre répétitions à 40 kg, repos 120 secondes entre tours.";
  const flat = proposalFor(instruction, [{ date: "2026-11-09" }]);
  const corrected = structuredClone(flat);
  corrected.sessions[0]!.blocks[0]!.items[0]!.prescription.sets = 1;
  const repeated = {
    ...corrected,
    sessions: corrected.sessions.map((session) => ({
      ...session,
      blocks: session.blocks.map((block) => ({
        ...block,
        items: block.items.map((item) => ({
          ...item,
          ref: "squat",
          prescription: { ...item.prescription, restS: null },
        })),
        sequence: [
          {
            kind: "repeat",
            ref: "rounds",
            name: "Circuit",
            rounds: 3,
            restBetweenRoundsS: 120,
            children: [{ kind: "exercise", itemRef: "squat" }],
          },
        ],
      })),
    })),
  };
  const fetcher = transport(completed(repeated));
  const done = await openAiPlannerProvider(fetcher).interpret({ ...context, instructions: [instruction] });
  expect(done).toMatchObject({ status: "proposal", sessions: [{ blocks: [{ sequence: [{ rounds: 3 }] }] }] });
  expect(done.sessions[0]!.warnings).toEqual([]);
  // Des tours demandés mais absents de la séance : elle reste proposée, avec le point à vérifier sur les tours.
  const missing = transport(completed(flat));
  expect(await openAiPlannerProvider(missing).interpret({ ...context, instructions: [instruction] })).toMatchObject({
    status: "proposal",
    sessions: [{ warnings: [{ code: "rounds_missing", field: "rounds", detail: "3" }] }],
  });
  expect(missing).toHaveBeenCalledTimes(2);
  // La correction qui rétablit les tours remplace la première séance.
  const fixed = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(completed(flat)))
    .mockResolvedValueOnce(Response.json(completed(repeated)));
  const better = await openAiPlannerProvider(fixed).interpret({ ...context, instructions: [instruction] });
  expect(better).toMatchObject({
    status: "proposal",
    sessions: [{ warnings: [], blocks: [{ sequence: [{ rounds: 3 }] }] }],
  });
  expect(JSON.parse(JSON.parse(String(fixed.mock.calls[1]![1]?.body)).input).correction).toContain("repeat");
});

const node = (
  token: string,
  instruction: string,
  values: Record<string, unknown> = {},
  autonomous: unknown = null,
) => ({
  kind: "exercise",
  exerciseToken: token,
  instruction,
  autonomous,
  prescription: {
    sets: 3,
    reps: 4,
    distanceM: null,
    durationS: null,
    restS: 120,
    load: null,
    intensityTarget: null,
    tempo: null,
    contacts: null,
    notes: null,
    setPlan: null,
    ...values,
  },
});
const tree = (date: string, content: unknown[]) => ({
  status: "proposal",
  questions: [],
  assumptions: [],
  suggestions: [],
  sessions: [
    {
      date,
      startTime: null,
      title: "Force",
      type: "strength",
      durationMin: null,
      targetTokens: ["group_1"],
      blocks: [{ name: "Force", content }],
    },
  ],
});
const catalog = [
  { token: "exercise_1", name: "Squat arrière", category: "strength" as const, aliases: [] },
  { token: "exercise_2", name: "Tractions", category: "strength" as const, aliases: [] },
  { token: "exercise_3", name: "Fentes avant", category: "strength" as const, aliases: [] },
];
it("demande au modèle les séries détaillées et l'autonomie, et garde chaque charge écrite", async () => {
  const instruction =
    "Demain : squat arrière, 8 à 40 kg pour s'échauffer puis 5 à 60 kg et 3 à 70 kg. En autonomie, tractions 3 × 4 à la place.";
  const answer = tree("2026-11-09", [
    node(
      "exercise_1",
      instruction,
      {
        setPlan: [
          { reps: 8, load: { type: "kg", value: 40 }, warmup: true },
          { reps: 5, load: { type: "kg", value: 60 }, warmup: false },
          { reps: 3, load: { type: "kg", value: 70 }, warmup: false },
        ],
      },
      { exerciseToken: "exercise_2", instruction, prescription: node("exercise_2", "x").prescription },
    ),
  ]);
  const fetcher = transport(completed(answer));
  const result = await openAiPlannerProvider(fetcher).interpret({
    ...context,
    exercises: catalog,
    instructions: [instruction],
  });
  expect(result).toMatchObject({
    status: "proposal",
    sessions: [
      {
        warnings: [],
        blocks: [
          {
            items: [
              {
                prescription: {
                  sets: 3,
                  reps: 5,
                  load: { type: "kg", value: 60 },
                  setPlan: [{ warmup: true }, {}, {}],
                },
                autonomous: { exerciseToken: "exercise_2", prescription: { sets: 3, reps: 4 } },
              },
            ],
          },
        ],
      },
    ],
  });
  const exercise = JSON.parse(String(fetcher.mock.calls[0]![1]?.body)).text.format.schema.properties.sessions.items
    .properties.blocks.items.properties.content.items.anyOf[0];
  expect(Object.keys(exercise.properties)).toEqual(
    expect.arrayContaining(["autonomous", "prescription", "exerciseToken", "instruction"]),
  );
  expect(exercise.properties.prescription.properties.setPlan).toBeDefined();
  // Une charge intermédiaire que le coach n'a pas écrite est une charge inventée : une question, jamais une séance.
  const invented = structuredClone(answer);
  (
    invented.sessions[0]!.blocks[0]!.content[0] as { prescription: { setPlan: { load: { value: number } }[] } }
  ).prescription.setPlan[1]!.load.value = 65;
  expect(
    await openAiPlannerProvider(transport(completed(invented))).interpret({
      ...context,
      exercises: catalog,
      instructions: [instruction],
    }),
  ).toMatchObject({ status: "clarification", sessions: [], questions: [{ field: "load" }] });
});
it("un exercice proche du nom cité passe, signalé « À vérifier » sur l'exercice", async () => {
  const instruction = "Demain : fentes par jambe, 3 séries de 4, repos 120 secondes.";
  const result = await openAiPlannerProvider(
    transport(completed(tree("2026-11-09", [node("exercise_3", instruction)]))),
  ).interpret({ ...context, exercises: catalog, instructions: [instruction] });
  expect(result).toMatchObject({
    status: "proposal",
    sessions: [
      { warnings: [{ code: "approximate_exercise", field: "exercise", block: 0, item: 0, detail: "Fentes avant" }] },
    ],
  });
});
it("« Ajuster » envoie la séance précédente : ses exercices et charges ne sont ni inventés ni substitués", async () => {
  const original = "Demain : squat arrière 3 × 4 à 40 kg, repos 120 secondes.";
  const previousTree = tree("2026-11-09", [node("exercise_1", original, { load: { type: "kg", value: 40 } })]);
  const adjustment = "Ajustement du coach : passe à quatre séries.";
  const adjusted = tree("2026-11-09", [node("exercise_1", original, { sets: 4, load: { type: "kg", value: 40 } })]);
  const fetcher = transport(completed(adjusted));
  const result = await openAiPlannerProvider(fetcher).interpret({
    ...context,
    exercises: catalog,
    instructions: [original, adjustment],
    previous: { sessions: previousTree.sessions as never },
  });
  expect(result).toMatchObject({
    status: "proposal",
    sessions: [{ blocks: [{ items: [{ prescription: { sets: 4 } }] }] }],
  });
  const input = JSON.parse(JSON.parse(String(fetcher.mock.calls[0]![1]?.body)).input);
  expect(input.previous.sessions[0].blocks[0].content[0]).toMatchObject({ exerciseToken: "exercise_1" });
});

it("en mode « Proposer », ouvre le pourcentage aux seuls exercices couverts pour tous, jamais le kilo", async () => {
  const brief = { objective: "Force", date: "2026-11-09", durationMin: 40, level: "advanced" as const, equipment: [] };
  const exercises = [
    { ...catalog[0]!, classification: { movement: "squat" as const, equipment: [] } },
    { ...catalog[1]!, classification: { movement: "pull" as const, equipment: [] } },
  ];
  const proposed: PlannerProviderContext = {
    ...context,
    mode: "propose",
    brief,
    exercises,
    space: { disciplines: ["sprint"], objectives: ["strength"], equipment: [] },
    neighbours: [
      {
        date: "2026-11-08",
        type: "strength",
        targetTokens: ["group_1"],
        exercises: [{ exerciseToken: "exercise_1", sets: 5, reps: 5, distanceM: null, durationS: null, load: null }],
      },
    ],
    strength: [
      { exerciseToken: "exercise_1", coverage: "all" },
      { exerciseToken: "exercise_2", coverage: "some" },
    ],
  };
  const percent = { type: "pct_1rm", value: 80 };
  const answer = {
    status: "proposal",
    questions: [],
    assumptions: ["Intensité élevée."],
    suggestions: [],
    sessions: [
      {
        title: "Force",
        type: "strength",
        durationMin: 40,
        blocks: [
          {
            name: "Principal",
            content: [node("exercise_1", "Base.", { load: percent }), node("exercise_2", "Tirage.", { load: percent })],
          },
        ],
      },
    ],
  };
  const fetcher = transport(completed(answer));
  const result = await openAiPlannerProvider(fetcher).interpret(proposed);
  const items = result.sessions[0]!.blocks[0]!.items;
  expect(items[0]!.prescription.load).toEqual(percent);
  // Sans référence pour chacun, le pourcentage ne serait résolu pour personne : il est retiré.
  expect(items[1]!.prescription.load).toBeNull();
  const body = JSON.parse(String(fetcher.mock.calls[0]![1]?.body));
  const input = JSON.parse(body.input);
  expect(input).toMatchObject({ percentAllowed: ["exercise_1"], space: { disciplines: ["sprint"] } });
  expect(input.neighbours[0].exercises[0]).toMatchObject({ exerciseToken: "exercise_1", sets: 5 });
  expect(JSON.stringify(body.text.format.schema)).not.toContain('"kg"');
  // Un kilo reste refusé même si le modèle l'écrivait.
  const kilos = structuredClone(answer);
  (kilos.sessions[0]!.blocks[0]!.content[0] as { prescription: { load: unknown } }).prescription.load = {
    type: "kg",
    value: 80,
  };
  await expect(openAiPlannerProvider(transport(completed(kilos))).interpret(proposed)).rejects.toMatchObject({
    code: "invalid_output",
  });
});
