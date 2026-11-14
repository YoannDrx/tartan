import { expect, it } from "vitest";
import { captureVideoInput, queuedVideoInput } from "./capture-input";

it("la capture personnelle laisse le serveur choisir l’identité de l’athlète", () => {
  expect(captureVideoInput({ athleteId: "autre", scheduledSessionId: "séance" }, false, true)).toEqual({
    scheduledSessionId: "séance",
    attempt: null,
  });
});

it("une reprise d’envoi conserve la même clé, même pour une ancienne file persistée", () => {
  const oldInput = { athleteId: "athlete", recordedAt: "2026-11-13T10:00:00Z" };
  expect(queuedVideoInput("queue-id", oldInput)).toEqual(queuedVideoInput("queue-id", oldInput));
  expect(queuedVideoInput("queue-id", oldInput).clientId).toBe("queue-id");
  expect(queuedVideoInput("queue-id", { ...oldInput, clientId: "already-sent" }).clientId).toBe("already-sent");
});

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
