import { expect, it } from "vitest";
import { captureVideoInput } from "./capture-input";

it("écarte la barre conservée dans le formulaire quand le coach filme un autre geste", () => {
  const fields = {
    athleteId: "athlete",
    scheduledSessionId: "session",
    fps: 240,
    recordedAt: "2026-11-08T10:00:00Z",
    attempt: { barHeightCm: 160, attemptNo: 1, result: "O" as const, approachSteps: 9 },
  };
  expect(captureVideoInput(fields, false)).toEqual({ ...fields, attempt: null });
  expect(captureVideoInput(fields, true)).toEqual(fields);
  // Replier après avoir renseigné une vraie barre ne doit pas l'associer à la prochaine vidéo générique.
  const changed = { ...fields, attempt: { ...fields.attempt, barHeightCm: 185, result: "X" as const } };
  expect(captureVideoInput(changed, true).attempt).toEqual(changed.attempt);
  expect(captureVideoInput(changed, false).attempt).toBeNull();
  expect(fields.attempt.barHeightCm).toBe(160);
});
