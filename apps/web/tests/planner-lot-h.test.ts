import { expect, it } from "vitest";
import { independentCatalog } from "../evals/planner-independent";
import { lotHContext, lotHCorpus, scoreLotHCase } from "../evals/planner-lot-h";
import { plannerProviderContext } from "@/server/ai/provider";

const token = (key: string) => independentCatalog.find((e) => e.catalogKey === key)!.token;
const prescription = (values: Record<string, unknown> = {}) => ({
  sets: 3,
  reps: 5,
  distanceM: null,
  durationS: null,
  restS: 120,
  load: null,
  intensityTarget: null,
  tempo: null,
  contacts: null,
  notes: null,
  ...values,
});
const answer = (date: string, items: unknown[]) => ({
  status: "proposal",
  questions: [],
  assumptions: ["Choix à relire."],
  suggestions: [],
  sessions: [
    {
      date,
      startTime: null,
      title: "Force",
      type: "strength",
      durationMin: 40,
      targetTokens: ["group_1"],
      blocks: [{ name: "Force", items }],
    },
  ],
});

it("charge les 20 cas neufs, figés par empreinte, sans transmettre d'attendu", () => {
  expect(lotHCorpus.cases).toHaveLength(20);
  for (const test of lotHCorpus.cases) {
    const context = plannerProviderContext.parse(lotHContext(test));
    expect(JSON.stringify(context)).not.toContain("expected");
    if (test.previous) expect(context.previous?.sessions).toHaveLength(1);
  }
});
it("note les séries détaillées série par série et refuse une charge intermédiaire inventée", () => {
  const test = lotHCorpus.cases.find((c) => c.id === "H-01")!;
  const plan = (third: number) => [
    { reps: 8, load: { type: "kg", value: 40 }, warmup: true },
    { reps: 5, load: { type: "kg", value: 60 }, warmup: false },
    { reps: 3, load: { type: "kg", value: third }, warmup: false },
    { reps: 1, load: { type: "kg", value: 80 }, warmup: false },
  ];
  const item = (third: number) => ({
    exerciseToken: token("back-squat"),
    instruction: test.text,
    prescription: prescription({ sets: 4, setPlan: plan(third) }),
  });
  expect(scoreLotHCase(test, answer("2026-11-25", [item(70)]))).toMatchObject({ passed: true });
  expect(scoreLotHCase(test, answer("2026-11-25", [item(75)]))).toMatchObject({
    passed: false,
    critical: ["invented_load"],
  });
});
it("note l'autonomie et la politique de charge du mode « Proposer »", () => {
  const autonomy = lotHCorpus.cases.find((c) => c.id === "H-06")!;
  const plank = {
    exerciseToken: token("front-plank"),
    instruction: autonomy.text,
    prescription: prescription({ reps: null, restS: null, durationS: 30 }),
    autonomous: {
      exerciseToken: token("side-plank"),
      prescription: prescription({ reps: null, restS: null, durationS: 20 }),
    },
  };
  expect(scoreLotHCase(autonomy, answer("2026-11-26", [plank])).passed).toBe(true);
  expect(scoreLotHCase(autonomy, answer("2026-11-26", [{ ...plank, autonomous: null }])).differences).toContain(
    "autonomous",
  );
  const percent = lotHCorpus.cases.find((c) => c.id === "H-17")!;
  const bench = (load: unknown) => ({
    exerciseToken: token("bench-press"),
    instruction: "Choix.",
    prescription: prescription({ load }),
  });
  expect(scoreLotHCase(percent, answer("2026-11-26", [bench(null)])).passed).toBe(true);
  expect(scoreLotHCase(percent, answer("2026-11-26", [bench({ type: "pct_1rm", value: 80 })])).critical).toContain(
    "invented_load",
  );
});
