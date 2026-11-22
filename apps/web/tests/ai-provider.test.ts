import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlannerComposeInput, PlannerUnderstandInput } from "@/server/ai/pipeline";
import { libraryLines, openAiPlannerProvider, PlannerProviderError } from "@/server/ai/provider";
import { composed, node, understanding } from "./planner-scripted";

// L'adaptateur OpenAI : une fonction typée par étape, et rien d'autre. Ce qu'il envoie, ce qu'il lit, et les pannes
// qu'il nomme. Les règles du planificateur sont éprouvées ailleurs, sur tout prestataire (`ai-pipeline.test.ts`).

const settings = vi.hoisted(() => ({
  AI_PLANNER_ENABLED: "true" as string | undefined,
  OPENAI_API_KEY: "test-only" as string | undefined,
  OPEN_AI_API_KEY: undefined as string | undefined,
  AI_PLANNER_MODEL: "gpt-6.2-sol",
  AI_PLANNER_FAST_MODEL: "gpt-6.1-terra",
  AI_PLANNER_DESCRIBED_MODEL: undefined as string | undefined,
  AI_PLANNER_UNDERSTAND_EFFORT: "none",
  AI_PLANNER_MATCH_EFFORT: "low",
  AI_PLANNER_COMPOSE_EFFORT: "none",
  AI_PLANNER_REPAIR_EFFORT: "medium",
}));
vi.mock("@/lib/env", () => ({ env: () => settings }));
beforeEach(() => {
  Object.assign(settings, {
    AI_PLANNER_ENABLED: "true",
    OPENAI_API_KEY: "test-only",
    OPEN_AI_API_KEY: undefined,
    AI_PLANNER_MODEL: "gpt-6.2-sol",
    AI_PLANNER_FAST_MODEL: "gpt-6.1-terra",
    AI_PLANNER_DESCRIBED_MODEL: undefined,
  });
});

const answer = (value: unknown, init: ResponseInit = {}) =>
  new Response(
    JSON.stringify({
      status: "completed",
      output: [
        { type: "reasoning", summary: [] },
        { type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] },
      ],
    }),
    { status: 200, ...init },
  );
type Body = {
  model: string;
  store: boolean;
  stream?: boolean;
  temperature?: number;
  reasoning?: { effort: string };
  max_output_tokens: number;
  prompt_cache_options?: { mode: string };
  input: { role: string; content: string | { type: string; text: string; prompt_cache_breakpoint?: unknown }[] }[];
  text: { format: { type: string; name: string; strict: boolean; schema: Record<string, unknown> } };
};
const recorder = (...responses: (Response | Error)[]) => {
  const bodies: Body[] = [];
  const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init!.body)) as Body);
    const next = responses.shift() ?? answer(understanding());
    if (next instanceof Error) throw next;
    return next;
  });
  return { fetcher: fetcher as unknown as typeof fetch, calls: fetcher, bodies };
};
const understandInput: PlannerUnderstandInput = {
  today: "2026-11-23",
  todayWeekday: "lundi",
  calendar: [
    { date: "2026-11-23", weekday: "lundi" },
    { date: "2026-11-24", weekday: "mardi" },
  ],
  relative: { hier: "2026-11-22", aujourdHui: "2026-11-23", demain: "2026-11-24", apresDemain: "2026-11-25" },
  recipients: [
    { token: "group_1", kind: "group" },
    { token: "athlete_1", kind: "athlete" },
  ],
  recipientsChosen: true,
  request: "Demain pour group_1 : squat arrière, 3 séries de 8.",
  followUps: [],
  adjusting: false,
  hints: { intent: null, date: null, durationMin: null, level: null, equipment: null },
};
const composeInput: PlannerComposeInput = {
  today: "2026-11-23",
  request: understandInput.request,
  followUps: [],
  understanding: {
    intent: "described",
    sessions: [
      {
        index: 0,
        date: "2026-11-24",
        weekday: "mardi",
        startTime: null,
        targetTokens: ["group_1"],
        structure: null,
        movements: [
          { id: "m1", said: "squat arrière", prescription: "3 séries de 8", replaces: null, exerciseToken: "exercise_1", confidence: "exact" },
          { id: "m2", said: "saut du dragon", prescription: null, replaces: null, exerciseToken: "slot_1", confidence: "absent" },
        ],
        proposal: null,
      },
    ],
    corrections: [],
  },
  exercises: [
    {
      token: "exercise_1",
      name: "Squat arrière",
      family: "strength",
      level: "intermediate",
      unit: "repetitions",
      sides: "total",
      loadKind: "external_total",
      equipment: ["barbell", "rack"],
      objective: null,
    },
  ],
  slots: [{ token: "slot_1", said: "saut du dragon" }],
  candidates: [],
  percentAllowed: [],
  space: null,
  neighbours: [],
  phases: [],
  previous: null,
  adjustment: null,
};
const text = (message: Body["input"][number]) =>
  typeof message.content === "string" ? message.content : message.content.map((part) => part.text).join("");

describe("une fonction typée par étape", () => {
  it("comprendre : modèle rapide, sortie stricte, store:false, sans outil ni historique distant", async () => {
    const { fetcher, calls, bodies } = recorder(answer(understanding()));
    const result = await openAiPlannerProvider(fetcher).understand(understandInput);
    expect(result).toEqual(understanding());
    expect(calls.mock.calls[0]![0]).toBe("https://api.openai.com/v1/responses");
    expect((calls.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer test-only" });
    const body = bodies[0]!;
    expect(body).toMatchObject({
      model: "gpt-6.1-terra",
      store: false,
      reasoning: { effort: "none" },
      text: { format: { type: "json_schema", name: "tartan_understanding", strict: true } },
    });
    expect(body).not.toHaveProperty("tools");
    expect(body).not.toHaveProperty("previous_response_id");
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("stream");
    // Les consignes en message `developer`, avec un repère de cache ; la demande du coach, elle, n'est jamais mise en cache.
    expect(body.prompt_cache_options).toEqual({ mode: "explicit" });
    expect(body.input.map((message) => message.role)).toEqual(["developer", "user"]);
    expect(body.input[0]!.content).toMatchObject([{ type: "input_text", prompt_cache_breakpoint: { mode: "explicit" } }]);
    expect(JSON.parse(text(body.input[1]!))).toEqual(understandInput);
    // Le schéma est le même pour toutes les demandes : ni dates ni jetons de la demande, que les règles vérifient.
    const schema = JSON.stringify(body.text.format.schema);
    expect(schema).not.toContain("2026-11-23");
    expect(schema).not.toContain("group_1");
    expect(schema).not.toContain("oneOf");
  });
  it("retrouver : la bibliothèque en cinq champs par fiche, avant les termes", async () => {
    const judgement = {
      matches: [{ id: "m1", candidates: [{ key: "f1", relation: "same_name" }], suggestion: null }],
    };
    const generation = { matches: [{ id: "m1", confidence: "sure" as const, key: "f1", others: [], suggestion: null }] };
    const { fetcher, bodies } = recorder(answer(judgement));
    const library = [
      { key: "f1", name: "Soulevé de terre roumain", aliases: ["RDL"], family: "strength", equipment: ["barbell"] },
      { key: "f2", name: "Gainage ventral", aliases: [], family: "core", equipment: [] },
      { key: "f3", name: "Fiche privée", aliases: [], family: null, equipment: null },
    ];
    const result = await openAiPlannerProvider(fetcher).match({
      movements: [{ id: "m1", said: "RDL", prescription: "3 x 8", near: [] }],
      library,
    });
    expect(result).toEqual(generation);
    const body = bodies[0]!;
    expect(body).toMatchObject({ model: "gpt-6.1-terra", reasoning: { effort: "low" } });
    expect(body.input.map((message) => message.role)).toEqual(["developer", "developer", "user"]);
    expect(text(body.input[1]!)).toBe(libraryLines(library));
    expect(text(body.input[1]!).split("\n").slice(1)).toEqual([
      "f1 | Soulevé de terre roumain | RDL | strength | barbell",
      "f2 | Gainage ventral | - | core | aucun",
      "f3 | Fiche privée | - | - | ?",
    ]);
    // Le repère de cache est à la fin de la bibliothèque : elle se relit d'une demande à l'autre.
    expect(body.input[0]!.content).toEqual(expect.any(String));
    expect(body.input[1]!.content).toMatchObject([{ prompt_cache_breakpoint: { mode: "explicit" } }]);
    expect(JSON.parse(text(body.input[2]!))).toEqual({ movements: [{ id: "m1", said: "RDL", prescription: "3 x 8", near: [] }] });
    // Le schéma demande une relation par fiche, jamais une confiance : elle est décidée par règle.
    const schema = JSON.stringify(body.text.format.schema);
    expect(schema).toContain("same_known");
    expect(schema).not.toContain("confidence");
  });
  it("retrouver : une équivalence que seul le modèle connaît, ou une précision de matériel, reste à vérifier", async () => {
    const judgement = {
      matches: [
        { id: "m1", candidates: [{ key: "f1", relation: "same_known" }], suggestion: null },
        { id: "m2", candidates: [{ key: "f2", relation: "variant" }, { key: "f3", relation: "neighbor" }], suggestion: null },
      ],
    };
    const { fetcher } = recorder(answer(judgement));
    const result = await openAiPlannerProvider(fetcher).match({
      movements: [
        { id: "m1", said: "chaise au mur", prescription: null, near: [] },
        { id: "m2", said: "squat à la barre guidée", prescription: null, near: [] },
      ],
      library: [],
    });
    expect(result.matches).toEqual([
      { id: "m1", confidence: "probable", key: "f1", others: [], suggestion: null },
      { id: "m2", confidence: "probable", key: "f2", others: ["f3"], suggestion: null },
    ]);
  });
  it("composer et réparer : fiches et emplacements seuls permis, prescription écrite une fois", async () => {
    const composition = composed([node("m1", "exercise_1"), node("m2", "slot_1")]);
    const { fetcher, bodies } = recorder(answer(composition), answer(composition));
    const provider = openAiPlannerProvider(fetcher);
    expect(await provider.compose(composeInput)).toEqual(composition);
    const defects = [{ code: "missing_movement" as const, session: 0, movementId: "m2", detail: "Le mouvement m2 manque." }];
    expect(await provider.repair({ ...composeInput, previousAnswer: composition, defects })).toEqual(composition);
    const [compose, repair] = bodies;
    // Une demande seulement décrite se compose avec le modèle rapide ; la réparation reste au principal.
    expect(compose).toMatchObject({
      model: "gpt-6.1-terra",
      reasoning: { effort: "none" },
      text: { format: { name: "tartan_session", strict: true } },
    });
    expect(repair).toMatchObject({ model: "gpt-6.2-sol", reasoning: { effort: "medium" } });
    const schema = JSON.stringify(compose!.text.format.schema);
    // Schéma fixe, pour rester en cache : les jetons permis sont vérifiés par le serveur, pas par le schéma.
    expect(schema).not.toContain("exercise_1");
    expect(schema).toContain("$defs");
    // La réparation reçoit la réponse fautive et la liste précise des défauts.
    const sent = JSON.parse(text(repair!.input.at(-1)!)) as { previousAnswer: unknown; defects: unknown };
    expect(sent.previousAnswer).toEqual(composition);
    expect(sent.defects).toEqual(defects);
  });
  it("composer : le modèle principal dès qu'une partie est à proposer, ou pour un ajustement", async () => {
    const proposal = { objective: "gainage", durationMin: 15, level: null, equipment: [], families: ["core" as const] };
    const objective: PlannerComposeInput = {
      ...composeInput,
      understanding: {
        ...composeInput.understanding,
        intent: "objective",
        sessions: composeInput.understanding.sessions.map((session) => ({ ...session, movements: [], proposal })),
      },
    };
    const mixed: PlannerComposeInput = {
      ...composeInput,
      understanding: {
        ...composeInput.understanding,
        intent: "mixed",
        sessions: composeInput.understanding.sessions.map((session) => ({ ...session, proposal })),
      },
    };
    const adjusting: PlannerComposeInput = { ...composeInput, previous: { sessions: [] }, adjustment: "ajoute des fentes" };
    const composition = composed([node("m1", "exercise_1")]);
    const { fetcher, bodies } = recorder(answer(composition), answer(composition), answer(composition));
    const provider = openAiPlannerProvider(fetcher);
    for (const input of [objective, mixed, adjusting]) await provider.compose(input);
    // `none` n'existe pas sur Sol : l'effort devient `low`.
    expect(bodies).toHaveLength(3);
    for (const body of bodies) expect(body).toMatchObject({ model: "gpt-6.2-sol", reasoning: { effort: "low" } });
  });
  it("composer : le modèle d'une demande seulement décrite se règle par AI_PLANNER_DESCRIBED_MODEL", async () => {
    settings.AI_PLANNER_DESCRIBED_MODEL = "gpt-6.2-sol";
    const composition = composed([node("m1", "exercise_1"), node("m2", "slot_1")]);
    const { fetcher, bodies } = recorder(answer(composition));
    await openAiPlannerProvider(fetcher).compose(composeInput);
    expect(bodies[0]).toMatchObject({ model: "gpt-6.2-sol", reasoning: { effort: "low" } });
  });
  it("un modèle d'avant GPT-5 reçoit une température nulle, ni effort ni repère de cache", async () => {
    settings.AI_PLANNER_FAST_MODEL = "gpt-4.1-mini";
    const { fetcher, bodies } = recorder(answer(understanding()));
    await openAiPlannerProvider(fetcher).understand(understandInput);
    expect(bodies[0]).toMatchObject({ model: "gpt-4.1-mini", temperature: 0 });
    expect(bodies[0]).not.toHaveProperty("reasoning");
    expect(bodies[0]).not.toHaveProperty("prompt_cache_options");
    expect(bodies[0]!.input[0]!.content).toEqual(expect.any(String));
  });
  it("diffuse le texte à mesure qu'il s'écrit et rend la réponse complète", async () => {
    const value = understanding({ summary: "Tu veux une séance demain." });
    const full = JSON.stringify(value);
    const events = [
      { type: "response.created" },
      { type: "response.output_text.delta", delta: full.slice(0, 20) },
      { type: "response.output_text.delta", delta: full.slice(20) },
      {
        type: "response.completed",
        response: { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: full }] }] },
      },
    ];
    const { fetcher, bodies } = recorder(
      new Response(events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("")),
    );
    const deltas: string[] = [];
    const result = await openAiPlannerProvider(fetcher).understand(understandInput, {
      onDelta: (delta) => deltas.push(delta),
    });
    expect(bodies[0]!.stream).toBe(true);
    expect(deltas.join("")).toBe(full);
    expect(result).toEqual(value);
  });
});

describe("saturation", () => {
  it("est rejouée après l'attente demandée, deux fois au plus, avant de devenir une panne lisible", async () => {
    const busy = () => new Response("{}", { status: 429, headers: { "retry-after-ms": "5" } });
    const twice = recorder(busy(), busy(), answer(understanding()));
    await expect(openAiPlannerProvider(twice.fetcher).understand(understandInput)).resolves.toEqual(understanding());
    expect(twice.calls).toHaveBeenCalledTimes(3);
    const thrice = recorder(busy(), busy(), busy(), answer(understanding()));
    await expect(openAiPlannerProvider(thrice.fetcher).match({ movements: [], library: [] })).rejects.toMatchObject({
      code: "saturated",
      step: "match",
    });
    expect(thrice.calls).toHaveBeenCalledTimes(3);
  });
  it("n'attend pas au-delà du délai de l'étape", async () => {
    const { fetcher, calls } = recorder(new Response("{}", { status: 429, headers: { "retry-after": "60" } }));
    await expect(
      openAiPlannerProvider(fetcher).understand(understandInput, { signal: AbortSignal.timeout(30) }),
    ).rejects.toMatchObject({ code: "timeout" });
    expect(calls).toHaveBeenCalledTimes(1);
  });
});

describe("pannes nommées, sans jamais reprendre le corps de la réponse", () => {
  it.each([
    [401, "configuration"],
    [404, "configuration"],
    [500, "unavailable"],
    [503, "unavailable"],
  ] as const)("HTTP %s : %s, à l'étape en cours", async (status, code) => {
    const { fetcher } = recorder(new Response(JSON.stringify({ error: { message: "sk-secret et consigne" } }), { status }));
    const error = await openAiPlannerProvider(fetcher)
      .compose(composeInput)
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(PlannerProviderError);
    expect(error).toMatchObject({ code, step: "compose" });
    expect(String(error)).not.toContain("sk-secret");
  });
  it.each([
    [{ status: "incomplete", output: [] }, "incomplete"],
    [{ status: "failed", output: [] }, "unavailable"],
    [{ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "non" }] }] }, "refused"],
    [{ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "{" }] }] }, "invalid_output"],
    [{ status: "completed", output: [] }, "invalid_output"],
  ] as const)("réponse %j : %s", async (payload, code) => {
    const { fetcher } = recorder(new Response(JSON.stringify(payload)));
    await expect(openAiPlannerProvider(fetcher).understand(understandInput)).rejects.toMatchObject({
      code,
      step: "understand",
    });
  });
  it("une sortie hors du type de l'étape est inexploitable", async () => {
    const { fetcher } = recorder(answer({ summary: "sans le reste" }));
    await expect(openAiPlannerProvider(fetcher).understand(understandInput)).rejects.toMatchObject({
      code: "invalid_output",
      step: "understand",
    });
  });
  it("distingue une panne réseau d'un délai dépassé", async () => {
    const network = recorder(new TypeError("fetch failed"));
    await expect(openAiPlannerProvider(network.fetcher).understand(understandInput)).rejects.toMatchObject({
      code: "unavailable",
    });
    const late = recorder(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
    await expect(openAiPlannerProvider(late.fetcher).understand(understandInput)).rejects.toMatchObject({
      code: "timeout",
    });
  });
  it("le drapeau global coupe tout appel ; sans clé, la panne est une panne de réglage", async () => {
    const { fetcher, calls } = recorder();
    settings.AI_PLANNER_ENABLED = "false";
    await expect(openAiPlannerProvider(fetcher).understand(understandInput)).rejects.toMatchObject({ code: "disabled" });
    settings.AI_PLANNER_ENABLED = "true";
    settings.OPENAI_API_KEY = undefined;
    await expect(openAiPlannerProvider(fetcher).understand(understandInput)).rejects.toMatchObject({
      code: "configuration",
    });
    expect(calls).not.toHaveBeenCalled();
    // Le nom déjà utilisé par la configuration locale reste lu.
    settings.OPEN_AI_API_KEY = "alias-only";
    await openAiPlannerProvider(fetcher).understand(understandInput);
    expect((calls.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer alias-only" });
  });
});
