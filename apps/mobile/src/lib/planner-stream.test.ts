import { describe, expect, it } from "vitest";
import {
  applyPlannerEvent,
  createPlannerEventParser,
  idlePlannerStream,
  plannerCurrentStep,
  readPlannerEvents,
  type PlannerRawEvent,
} from "./planner-stream";

const proposal = {
  id: "11111111-1111-4111-8111-111111111111",
  version: 1,
  state: "proposal",
  clarificationCount: 0,
  expiresAt: "2026-11-29T10:00:00.000Z",
  selection: {
    period: { from: "2026-11-23", to: "2026-11-23" },
    groupIds: [],
    athleteIds: [],
    exerciseIds: [],
    phaseChoices: [],
  },
  messages: ["Squat 3 x 8"],
  pendingText: null,
  interpretation: null,
  targets: [],
  exercises: [],
  phaseReviews: [],
  draftIds: null,
};
const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

describe("createPlannerEventParser", () => {
  it("ne rend un événement qu'une fois sa ligne vide arrivée, même coupé au milieu", () => {
    const parser = createPlannerEventParser();
    const text = frame("understanding", { summary: "Squat", done: false });
    expect(parser.push(text.slice(0, 20))).toEqual([]);
    expect(parser.push(text.slice(20, -1))).toEqual([]);
    expect(parser.push(text.slice(-1))).toEqual([{ event: "understanding", data: { summary: "Squat", done: false } }]);
  });

  it("lit plusieurs événements d'un morceau, accepte \\r\\n et ignore une donnée illisible", () => {
    const parser = createPlannerEventParser();
    const events = parser.push(
      `${frame("matching", { movements: [], done: true })}event: composing\r\ndata: {pas du json\r\n\r\n${frame("checking", { repairs: 0, done: false })}`,
    );
    expect(events.map((event) => event.event)).toEqual(["matching", "checking"]);
  });

  it("rend à la fin un événement sans ligne vide finale", () => {
    const parser = createPlannerEventParser();
    expect(parser.push(`event: result\ndata: {"a":1}`)).toEqual([]);
    expect(parser.end()).toEqual([{ event: "result", data: { a: 1 } }]);
  });
});

describe("applyPlannerEvent", () => {
  const running = { ...idlePlannerStream, running: true };
  it("avance les étapes dans l'ordre, sans doublon, et garde le résumé", () => {
    let state = running;
    const events: PlannerRawEvent[] = [
      { event: "understanding", data: { summary: null, done: false } },
      { event: "understanding", data: { summary: "Trois séries de squat", done: true } },
      { event: "matching", data: { movements: [{ said: "squat", confidence: "exact", name: "Squat" }], done: true } },
      { event: "composing", data: { lines: [{ kind: "exercise", label: "Squat" }] } },
      { event: "checking", data: { repairs: 1, done: false } },
    ];
    for (const event of events) state = applyPlannerEvent(state, event).state;
    expect(state.steps).toEqual(["context", "matching", "model", "retry"]);
    expect(state.summary).toBe("Trois séries de squat");
    expect(state.plan).toEqual([{ kind: "exercise", label: "Squat" }]);
    expect(plannerCurrentStep(state)).toBe("retry");
    expect(plannerCurrentStep({ ...state, running: false })).toBeNull();
  });

  it("rend le résultat et la panne lisible, ignore un événement inconnu", () => {
    expect(applyPlannerEvent(running, { event: "result", data: proposal }).result?.id).toBe(proposal.id);
    expect(applyPlannerEvent(running, { event: "result", data: { id: "x" } }).result).toBeUndefined();
    const failed = applyPlannerEvent(running, {
      event: "error",
      data: { status: 504, code: "planner_timeout", message: "Trop long", step: "compose" },
    });
    expect(failed.error?.step).toBe("compose");
    expect(failed.state.error?.message).toBe("Trop long");
    expect(applyPlannerEvent(running, { event: "ping", data: {} }).state).toBe(running);
  });
});

describe("readPlannerEvents", () => {
  it("lit un flux d'octets découpé n'importe où, accents compris", async () => {
    const text = frame("understanding", { summary: "Séance décrite", done: true }) + frame("result", proposal);
    const bytes = new TextEncoder().encode(text);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        // Un caractère accentué tient sur deux octets : la coupure tombe au milieu.
        const cut = text.indexOf("é") + 1;
        controller.enqueue(bytes.slice(0, cut));
        controller.enqueue(bytes.slice(cut));
        controller.close();
      },
    });
    const seen: PlannerRawEvent[] = [];
    await readPlannerEvents(body, (event) => seen.push(event));
    expect(seen.map((event) => event.event)).toEqual(["understanding", "result"]);
    expect((seen[0]!.data as { summary: string }).summary).toBe("Séance décrite");
  });
});
