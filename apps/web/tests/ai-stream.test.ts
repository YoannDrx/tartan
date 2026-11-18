import { describe, expect, it, vi } from "vitest";
import { plannerStreamEvent, type PlannerProposalResponse } from "@tartan/contracts";
import { AppError } from "@/lib/errors";
import { plannerEventStream, plannerPlanLines, wantsPlannerStream } from "@/server/ai/stream";
import { openAiPlannerProvider, type PlannerProviderContext } from "@/server/ai/provider";

const settings = vi.hoisted(() => ({
  AI_PLANNER_ENABLED: "true",
  AI_PLANNER_MODEL: "gpt-4.1-mini",
  OPENAI_API_KEY: "test-only",
}));
vi.mock("@/lib/env", () => ({ env: () => settings }));

const read = async (response: Response) => {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((chunk) => {
      const event = /^event: (.+)$/m.exec(chunk)![1];
      const data = JSON.parse(/^data: (.+)$/m.exec(chunk)![1]!);
      return event === "result" ? { event, data } : plannerStreamEvent.parse({ event, data });
    });
};
const result = { id: "00000000-0000-4000-8000-000000000001" } as PlannerProposalResponse;

describe("réponse diffusée du planificateur", () => {
  it("n'est servie qu'au client qui la demande ; l'app installée garde le JSON", () => {
    expect(wantsPlannerStream(new Request("http://x", { headers: { Accept: "text/event-stream" } }))).toBe(true);
    expect(wantsPlannerStream(new Request("http://x", { headers: { Accept: "application/json" } }))).toBe(false);
  });
  it("diffuse les étapes, le plan puis la proposition", async () => {
    const response = plannerEventStream(async (hooks) => {
      hooks.onProgress({ step: "context" });
      hooks.onProgress({ step: "model" });
      hooks.onPlan([{ kind: "block", label: "Force" }]);
      hooks.onPlan([{ kind: "block", label: "Force" }]);
      hooks.onPlan([
        { kind: "block", label: "Force" },
        { kind: "exercise", label: "Squat arrière" },
      ]);
      hooks.onProgress({ step: "saved" });
      return { ...result, failure: null } as never;
    });
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    const events = await read(response);
    expect(events.map((e) => e.event)).toEqual(["step", "step", "plan", "plan", "step", "result"]);
    expect(events[3]).toMatchObject({ data: { lines: [{ label: "Force" }, { label: "Squat arrière" }] } });
  });
  it("rend une erreur lisible, jamais un détail technique", async () => {
    const readable = await read(
      plannerEventStream(async () => {
        throw new AppError(503, "planner_saturated", "Le service d’IA est saturé.");
      }),
    );
    expect(readable).toEqual([
      { event: "error", data: { status: 503, code: "planner_saturated", message: "Le service d’IA est saturé." } },
    ]);
    const hidden = await read(
      plannerEventStream(async () => {
        throw new Error("sensitive stack");
      }),
    );
    expect(JSON.stringify(hidden)).not.toContain("sensitive");
  });
  it("termine la génération même si l'écran se ferme en cours de route", async () => {
    let finish!: () => void;
    const saved = vi.fn();
    const response = plannerEventStream(async (hooks) => {
      hooks.onProgress({ step: "model" });
      await new Promise<void>((resolve) => (finish = resolve));
      saved();
      hooks.onProgress({ step: "saved" });
      return result;
    });
    await response.body!.cancel();
    finish();
    await vi.waitFor(() => expect(saved).toHaveBeenCalled());
  });
  it("lit le plan dans un texte encore incomplet, sans rien deviner", () => {
    const names = new Map([["exercise_1", "Squat arrière"]]);
    const partial =
      '{"sessions":[{"blocks":[{"name":"Force \\"lourde\\"","content":[{"kind":"exercise","exerciseToken":"exercise_1"},{"kind":"exercise","exerciseToken":"exer';
    expect(plannerPlanLines(partial, (token) => names.get(token) ?? null)).toEqual([
      { kind: "block", label: 'Force "lourde"' },
      { kind: "exercise", label: "Squat arrière" },
    ]);
  });
});

describe("appel diffusé au prestataire", () => {
  const context: PlannerProviderContext = {
    period: { from: "2026-11-09", to: "2026-11-15" },
    today: "2026-11-08",
    timeZone: "Europe/Paris",
    targets: [{ token: "group_1", kind: "group", phase: null }],
    exercises: [{ token: "exercise_1", name: "Squat", category: "strength", aliases: [] }],
    instructions: ["Demain : squat."],
  };
  const answer = {
    status: "clarification",
    sessions: [],
    assumptions: [],
    suggestions: [],
    questions: [{ id: "q", field: "other", question: "Combien de séries ?", exerciseName: null, options: [] }],
  };
  const sse = (events: unknown[]) =>
    new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), {
      headers: { "Content-Type": "text/event-stream" },
    });
  it("demande stream:true, transmet chaque morceau et garde la réponse complète", async () => {
    const text = JSON.stringify(answer);
    const fetcher = vi.fn<typeof fetch>(async () =>
      sse([
        { type: "response.output_text.delta", delta: text.slice(0, 20) },
        { type: "response.output_text.delta", delta: text.slice(20) },
        {
          type: "response.completed",
          response: { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }] },
        },
      ]),
    );
    const deltas: string[] = [];
    const steps: string[] = [];
    const value = await openAiPlannerProvider(fetcher).interpret(context, {
      onDelta: (delta) => deltas.push(delta),
      onProgress: ({ step }) => steps.push(step),
    });
    expect(value).toMatchObject({ status: "clarification", questions: [{ field: "other" }] });
    expect(deltas.join("")).toBe(text);
    expect(steps).toEqual(["context", "model", "checks"]);
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body)).stream).toBe(true);
  });
  it("classe une réponse diffusée coupée ou en erreur", async () => {
    const incomplete = vi.fn<typeof fetch>(async () =>
      sse([{ type: "response.incomplete", response: { status: "incomplete", output: [] } }]),
    );
    await expect(openAiPlannerProvider(incomplete).interpret(context, { onDelta: () => {} })).rejects.toMatchObject({
      code: "incomplete",
    });
    const limited = vi.fn<typeof fetch>(async () =>
      sse([{ type: "error", error: { code: "rate_limit_exceeded", message: "secret" } }]),
    );
    await expect(openAiPlannerProvider(limited).interpret(context, { onDelta: () => {} })).rejects.toMatchObject({
      code: "saturated",
    });
  });
});
