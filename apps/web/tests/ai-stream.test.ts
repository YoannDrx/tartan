import { describe, expect, it } from "vitest";
import { plannerStreamEvent, type PlannerProposalResponse } from "@tartan/contracts";
import { AppError } from "@/lib/errors";
import { plannerFailureError } from "@/server/ai/failure";
import { plannerSummaryPreview } from "@/server/ai/pipeline/understand";
import { plannerEventStream, plannerPlanLines, wantsPlannerStream } from "@/server/ai/stream";

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
  it("diffuse un événement par étape, sans répéter un contenu identique, puis la proposition", async () => {
    const response = plannerEventStream(async (hooks) => {
      hooks.onUnderstanding(null, false);
      hooks.onUnderstanding("Tu veux", false);
      hooks.onUnderstanding("Tu veux", false);
      hooks.onUnderstanding("Tu veux une séance demain.", true);
      hooks.onMatching([], false);
      hooks.onMatching(
        [
          { said: "squat arrière", confidence: "exact", name: "Squat arrière" },
          { said: "saut du dragon", confidence: "absent", name: null },
        ],
        true,
      );
      hooks.onPlan([{ kind: "block", label: "Force" }]);
      hooks.onPlan([{ kind: "block", label: "Force" }]);
      hooks.onPlan([
        { kind: "block", label: "Force" },
        { kind: "exercise", label: "Squat arrière" },
      ]);
      hooks.onChecking(0, false);
      hooks.onChecking(1, false);
      hooks.onChecking(1, true);
      return { ...result, failure: null } as never;
    });
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    const events = await read(response);
    expect(events.map((e) => e.event)).toEqual([
      "understanding",
      "understanding",
      "understanding",
      "matching",
      "matching",
      "composing",
      "composing",
      "checking",
      "checking",
      "checking",
      "result",
    ]);
    expect(events[2]).toMatchObject({ data: { summary: "Tu veux une séance demain.", done: true } });
    expect(events[4]).toMatchObject({ data: { done: true, movements: [{ name: "Squat arrière" }, { name: null }] } });
    expect(events[6]).toMatchObject({ data: { lines: [{ label: "Force" }, { label: "Squat arrière" }] } });
    expect(events[9]).toMatchObject({ data: { repairs: 1, done: true } });
  });
  it("rend une erreur lisible, avec l'étape de la panne, jamais un détail technique", async () => {
    const readable = await read(
      plannerEventStream(async () => {
        throw plannerFailureError("saturated", "compose");
      }),
    );
    expect(readable).toEqual([
      {
        event: "error",
        data: { status: 503, code: "planner_saturated", message: expect.stringContaining("saturé"), step: "compose" },
      },
    ]);
    const plain = await read(
      plannerEventStream(async () => {
        throw new AppError(409, "planner_proposal_conflict", "Cette proposition a changé.");
      }),
    );
    expect(plain).toEqual([
      { event: "error", data: { status: 409, code: "planner_proposal_conflict", message: "Cette proposition a changé." } },
    ]);
    const hidden = await read(
      plannerEventStream(async () => {
        throw new Error("postgres://secret");
      }),
    );
    expect(hidden).toMatchObject([{ event: "error", data: { status: 500, code: "internal" } }]);
    expect(JSON.stringify(hidden)).not.toContain("secret");
  });
  it("termine la génération même si l'écran se ferme en cours de route", async () => {
    let finished = false;
    const response = plannerEventStream(async (hooks) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      hooks.onUnderstanding("Tu veux une séance.", true);
      finished = true;
      return result;
    });
    await response.body!.cancel();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(finished).toBe(true);
  });
  it("lit le plan dans un texte encore incomplet, sans rien deviner", () => {
    const text =
      '{"sessions":[{"index":0,"title":"Force","blocks":[{"name":"Échauffement \\"léger\\"","content":[{"kind":"exercise","exerciseToken":"exercise_1","prescription":{"sets":3}},{"kind":"exercise","exerciseToken":"slot_1"},{"kind":"exercise","exerciseToken":"exerc';
    const names = new Map([
      ["exercise_1", "Squat arrière"],
      ["slot_1", "saut du dragon"],
    ]);
    expect(plannerPlanLines(text, (token) => names.get(token) ?? null)).toEqual([
      { kind: "block", label: 'Échauffement "léger"' },
      { kind: "exercise", label: "Squat arrière" },
      // Un emplacement à compléter porte le terme dit par le coach.
      { kind: "exercise", label: "saut du dragon" },
    ]);
  });
  it("lit le résumé de compréhension dès ses premiers mots", () => {
    expect(plannerSummaryPreview('{"summ')).toBeNull();
    expect(plannerSummaryPreview('{"summary":"Tu veux une s')).toBe("Tu veux une s");
    // Un échappement coupé en fin de morceau est retiré, pas deviné.
    expect(plannerSummaryPreview('{"summary":"Tu veux \\"jeudi\\" et l\\u00e9')).toBe('Tu veux "jeudi" et lé');
    expect(plannerSummaryPreview('{"summary":"Tu veux \\')).toBe("Tu veux ");
    expect(plannerSummaryPreview('{"summary":"Fini.","offTopic":false')).toBe("Fini.");
  });
});
