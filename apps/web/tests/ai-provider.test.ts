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
  expect(body).not.toHaveProperty("tools");
  expect(body).not.toHaveProperty("previous_response_id");
  expect(JSON.parse(body.input)).toEqual({
    ...context,
    ambiguousExerciseTerms: [],
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
  await expect(
    openAiPlannerProvider(fetcher).interpret({ ...context, instructions: [hier] }),
  ).resolves.toMatchObject({ status: "clarification", sessions: [], questions: [{ field: "date" }] });
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
  expect(await openAiPlannerProvider(transport(completed(result))).interpret(clarified)).toEqual(result);
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
it("neutralise les erreurs HTTP et réseau sans rejouer automatiquement une génération facturable", async () => {
  for (const status of [401, 429, 500]) {
    const fetcher = transport({ error: { message: "sensitive-provider-message" } }, status);
    await expect(openAiPlannerProvider(fetcher).interpret(context)).rejects.toMatchObject({
      message: "planner_unavailable",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  }
  const fetcher = vi.fn<typeof fetch>(async () => {
    throw new Error("sensitive-network-message");
  });
  await expect(openAiPlannerProvider(fetcher).interpret(context)).rejects.toMatchObject({
    message: "planner_unavailable",
  });
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
