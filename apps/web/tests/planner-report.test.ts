import { describe, expect, it } from "vitest";
import { costOf, summarizeRuns, type EvalRow } from "../evals/planner-report";

const row = (run: number, id: string, extra: Partial<EvalRow> = {}): EvalRow => ({
  run,
  id,
  durationMs: 1000,
  calls: 1,
  score: { passed: true, differences: [], critical: [] },
  ...extra,
});

describe("rapport d'évaluation du planificateur", () => {
  it("compte, par passage, les réussites, les questions posées à tort et les erreurs", () => {
    const [first, second] = summarizeRuns([
      row(1, "a"),
      row(1, "b", { score: { passed: false, differences: ["status", "unexpected_question"], critical: [] } }),
      row(1, "c", { score: { passed: false, differences: ["restS"], critical: ["load"] }, calls: 2 }),
      row(1, "d", { score: undefined, error: "unavailable" }),
      row(2, "a"),
    ]);
    expect(first).toMatchObject({ run: 1, evaluated: 4, passed: 1, falseQuestions: 1, errors: 1, critical: ["c"], calls: 5 });
    expect(second).toMatchObject({ run: 2, evaluated: 1, passed: 1, falseQuestions: 0 });
  });

  it("donne la latence médiane et le 95e centile", () => {
    const rows = Array.from({ length: 20 }, (_, index) => row(1, `c${index}`, { durationMs: (index + 1) * 100 }));
    expect(summarizeRuns(rows)[0]).toMatchObject({ p50Ms: 1100, p95Ms: 2000 });
  });

  it("ne chiffre un coût que si chaque ligne a ses jetons", () => {
    const price = { inputPerMillion: 0.4, outputPerMillion: 1.6 };
    const counted = summarizeRuns([
      row(1, "a", { inputTokens: 1_000_000, outputTokens: 250_000 }),
      row(1, "b", { inputTokens: 500_000, outputTokens: 0 }),
    ]);
    expect(counted[0]).toMatchObject({ inputTokens: 1_500_000, outputTokens: 250_000 });
    expect(costOf(counted, price)).toBe(1);
    // Un ancien rapport, sans jetons : aucun coût inventé.
    const old = summarizeRuns([row(1, "a"), row(1, "b", { inputTokens: 10, outputTokens: 10 })]);
    expect(old[0]).toMatchObject({ inputTokens: null, outputTokens: null });
    expect(costOf(old, price)).toBeNull();
  });
});
