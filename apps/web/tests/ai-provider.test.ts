import { beforeEach, expect, it, vi } from "vitest";
import { openAiPlannerProvider, type PlannerProviderContext } from "@/server/ai/provider";
const settings = vi.hoisted(() => ({
  AI_PLANNER_ENABLED: "true",
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
  expect(JSON.parse(body.input)).toEqual({ ...context, ambiguousExerciseTerms: [] });
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
