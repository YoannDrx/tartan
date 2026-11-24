import type { SpaceSummary } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { describe, expect, it } from "vitest";
import {
  canPlanIn,
  hasPersonalSpace,
  isPersonalSpace,
  offersHistoryShare,
  personalAthleteOf,
  spaceCaption,
  toggleHistoryScope,
  welcomeChoices,
} from "./personal-space";
import { publishedMessage } from "./publication-message";

const space = (over: Partial<SpaceSummary> = {}): SpaceSummary => ({
  organizationId: "org",
  organizationName: "Mon entraînement",
  role: "athlete",
  athleteId: "fiche",
  ...over,
});

describe("l'aiguillage d'un compte sans espace", () => {
  it("propose les trois chemins, dans l'ordre du web, quand tout est ouvert", () => {
    expect(welcomeChoices({ coach: true, athlete: true })).toEqual(["coach", "solo", "invite"]);
  });

  it("ne montre pas un choix fermé par la console : plus de refus après tout un formulaire", () => {
    expect(welcomeChoices({ coach: false, athlete: true })).toEqual(["solo", "invite"]);
    expect(welcomeChoices({ coach: true, athlete: false })).toEqual(["coach", "invite"]);
    expect(welcomeChoices({ coach: false, athlete: false })).toEqual(["invite"]);
  });

  it("garde toujours le lien d'invitation, même avant d'avoir lu le réglage", () => {
    expect(welcomeChoices(undefined)).toEqual(["invite"]);
    expect(welcomeChoices(null)).toEqual(["invite"]);
  });

  it("ramène à son espace personnel un compte qui en a déjà un, même inscriptions fermées", () => {
    expect(welcomeChoices({ coach: false, athlete: false }, true)).toEqual(["solo", "invite"]);
  });
});

describe("l'espace personnel", () => {
  it("se reconnaît à son genre ; un ancien serveur sans genre décrit un espace de coach", () => {
    expect(isPersonalSpace(space({ kind: "personal" }))).toBe(true);
    expect(isPersonalSpace(space({ kind: "coach" }))).toBe(false);
    expect(isPersonalSpace(space())).toBe(false);
    expect(isPersonalSpace(null)).toBe(false);
    expect(hasPersonalSpace({ spaces: [space({ kind: "coach" }), space({ kind: "personal" })] })).toBe(true);
    expect(hasPersonalSpace({ spaces: [] })).toBe(false);
  });

  it("ouvre la planification à son titulaire, pas à l'athlète d'un coach", () => {
    expect(canPlanIn(space({ kind: "personal" }))).toBe(true);
    expect(canPlanIn(space({ kind: "coach" }))).toBe(false);
    expect(canPlanIn(space())).toBe(false);
    expect(canPlanIn(space({ role: "owner", kind: "coach" }))).toBe(true);
    expect(canPlanIn(space({ role: "assistant" }))).toBe(true);
    expect(canPlanIn(null)).toBe(false);
  });

  it("vise toujours la fiche du titulaire, et seulement dans son espace personnel", () => {
    expect(personalAthleteOf(space({ kind: "personal" }))).toBe("fiche");
    expect(personalAthleteOf(space({ kind: "coach" }))).toBeNull();
    expect(personalAthleteOf(space({ kind: "personal", role: "owner" }))).toBeNull();
  });

  it("se présente sans rôle dans le sélecteur d'espace", () => {
    expect(spaceCaption(space({ kind: "personal" }))).toBe(m.mobile.solo.spaceKind);
    expect(spaceCaption(space({ kind: "coach" }))).toBe(m.roles.athlete);
    expect(spaceCaption(space({ role: "owner" }))).toBe(m.roles.owner);
  });

  it("annonce une séance publiée pour soi, sans décompte de destinataires", () => {
    expect(publishedMessage({ athletes: 1, notified: 0 }, true)).toBe(m.mobile.solo.published);
    expect(publishedMessage({ athletes: 1, notified: 0 })).not.toBe(m.mobile.solo.published);
  });
});

describe("le partage de l'historique", () => {
  it("coche et décoche une case, dans l'ordre de l'écran", () => {
    expect(toggleHistoryScope([], "sessions")).toEqual(["sessions"]);
    expect(toggleHistoryScope(["sessions"], "records")).toEqual(["records", "sessions"]);
    expect(toggleHistoryScope(["records", "sessions"], "records")).toEqual(["sessions"]);
  });

  it("n'est proposé qu'à un athlète qui avait déjà son espace personnel", () => {
    expect(offersHistoryShare({ hadPersonal: true, role: "athlete" })).toBe(true);
    expect(offersHistoryShare({ hadPersonal: false, role: "athlete" })).toBe(false);
    expect(offersHistoryShare({ hadPersonal: true, role: "coach" })).toBe(false);
    expect(offersHistoryShare({ hadPersonal: true, role: undefined })).toBe(false);
  });
});
