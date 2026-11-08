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
  expect(JSON.parse(body.input)).toEqual(context);
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
