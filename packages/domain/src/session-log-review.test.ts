import { expect, it } from "vitest";
import type { AthleteSessionDetail, SessionLogInput } from "@tartan/contracts";
import { reviewSessionLogs } from "./session-log-review";

const session = {
  variant: "club",
  sessionVersion: 3,
  progressionEnabled: true,
  healthConsent: true,
  blocks: [{ items: [{ ref: "stable" }] }],
  log: { status: "partial", version: 5, rpe: 7, pain: null, durationMin: 40, comment: "Serveur" },
} as unknown as AthleteSessionDetail;
const change: SessionLogInput = {
  clientId: "client-old",
  variantDone: "club",
  status: "done",
  expectedVersion: 2,
  expectedSessionVersion: 3,
  writeScope: "sets",
  detailedSets: [
    {
      itemRef: "stable",
      setIndex: 0,
      done: true,
      reps: 4,
      loadKg: 40,
      setKind: "work",
      loadKind: "external",
      repetitionScope: "total",
      sideCount: 1,
    },
  ],
};
it("compose les modifications relues sans effacer un retour omis et conserve la version serveur affichée", () => {
  const result = reviewSessionLogs(session, [
    change,
    { ...change, detailedSets: undefined, writeScope: "feedback", comment: "Local" },
  ]);
  expect(result.reason).toBeNull();
  expect(result.input).toMatchObject({
    expectedVersion: 5,
    expectedSessionVersion: 3,
    rpe: 7,
    durationMin: 40,
    comment: "Local",
    status: "done",
    detailedSets: change.detailedSets,
  });
});
it("refuse le rattachement des séries à une prescription révisée, un exercice absent ou une autre variante", () => {
  expect(reviewSessionLogs({ ...session, sessionVersion: 4 }, [change]).reason).toBe("prescription");
  expect(reviewSessionLogs({ ...session, blocks: [] }, [change]).reason).toBe("exercise");
  expect(reviewSessionLogs({ ...session, variant: "autonomous" }, [change]).reason).toBe("variant");
  expect(reviewSessionLogs({ ...session, progressionEnabled: false }, [change]).reason).toBe("disabled");
});
it("conserve une suppression explicite de séries et masque les données santé sans consentement", () => {
  const result = reviewSessionLogs({ ...session, healthConsent: false }, [
    { ...change, detailedSets: [], writeScope: "all", rpe: 8, pain: { bodyArea: "knee", side: "left", intensity: 3 } },
  ]);
  expect(result.reason).toBeNull();
  expect(result.input).toMatchObject({ detailedSets: [], rpe: null, pain: null });
});
it("ne transforme pas une validation simple en séries détaillées et refuse les données invalides", () => {
  const simple = { ...change, writeScope: "status", detailedSets: undefined, sets: [] };
  expect(reviewSessionLogs(session, [simple]).input.detailedSets).toBeUndefined();
  expect(reviewSessionLogs(session, [{ ...change, status: "invalid" }]).reason).toBe("invalid");
});

it("une relecture coach avec droit retiré ne propose aucune réécriture applicable", () => {
  const result = reviewSessionLogs({ ...session, canRecordSets: false }, [change]);
  expect(result.reason).toBe("access");
  expect(result.input.detailedSets).toEqual(change.detailedSets);
});
