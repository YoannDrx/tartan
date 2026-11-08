import { plannerInterpretation } from "@tartan/contracts";
import type { PlannerEvalCase } from "./planner-corpus";

export type PlannerScore = {
  passed: boolean;
  differences: string[];
  // Borne basse automatique. Ce n'est pas un nombre de corrections mesuré par un coach.
  minimumFieldCorrections: number;
  exerciseMatches: number;
  expectedExercises: number;
  askedClarification: boolean;
};
export function scorePlannerCase(test: PlannerEvalCase, raw: unknown): PlannerScore {
  const differences: string[] = [];
  let exerciseMatches = 0;
  const expectedExercises =
    test.expected.status === "proposal" ? test.expected.sessions.reduce((n, s) => n + s.items.length, 0) : 0;
  const parsed = plannerInterpretation.safeParse(raw);
  const result = (askedClarification = false): PlannerScore => ({
    passed: differences.length === 0,
    differences,
    minimumFieldCorrections: differences.length,
    exerciseMatches,
    expectedExercises,
    askedClarification,
  });
  if (!parsed.success) {
    differences.push("schema");
    return result();
  }
  const actual = parsed.data;
  if (actual.status !== test.expected.status) differences.push("status");
  if (test.expected.status === "clarification") {
    if (actual.sessions.length) differences.push("sessions_must_be_empty");
    if (!actual.questions.length) differences.push("question_missing");
    if (
      !actual.questions.some((q) => test.expected.status === "clarification" && test.expected.fields.includes(q.field))
    )
      differences.push("question_field");
    return result(actual.status === "clarification" && actual.questions.length > 0 && actual.sessions.length === 0);
  }
  if (actual.questions.length) differences.push("unexpected_question");
  if (actual.sessions.length !== test.expected.sessions.length) differences.push("session_count");
  const sessions = [...actual.sessions].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""),
  );
  const expected = [...test.expected.sessions].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""),
  );
  for (const [i, session] of expected.entries()) {
    const got = sessions[i];
    if (!got) {
      differences.push(`sessions.${i}.missing`);
      continue;
    }
    if (got.date !== session.date) differences.push(`sessions.${i}.date`);
    if (JSON.stringify([...got.targetTokens].sort()) !== JSON.stringify([...session.targets].sort()))
      differences.push(`sessions.${i}.targets`);
    if (session.startTime !== undefined && got.startTime !== session.startTime)
      differences.push(`sessions.${i}.startTime`);
    const items = got.blocks.flatMap((b) => b.items);
    if (items.length !== session.items.length) differences.push(`sessions.${i}.item_count`);
    for (const [j, item] of session.items.entries()) {
      const received = items[j];
      if (!received) {
        differences.push(`sessions.${i}.items.${j}.missing`);
        continue;
      }
      if (received.exerciseToken !== item.exerciseToken) differences.push(`sessions.${i}.items.${j}.exercise`);
      else exerciseMatches++;
      for (const [field, value] of Object.entries(item.prescription))
        if (
          JSON.stringify(received.prescription[field as keyof typeof received.prescription]) !== JSON.stringify(value)
        )
          differences.push(`sessions.${i}.items.${j}.${field}`);
    }
  }
  return result(actual.status === "clarification");
}
