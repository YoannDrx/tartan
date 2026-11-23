import { describe, expect, it } from "vitest";
import { orgRole } from "@tartan/contracts";
import { plannerLimits, plannerQuotaFits } from "./ai-planner";
import { finishSignupDue, personalActivationEmailFor } from "./lifecycle-emails";
import {
  personalActivationStep,
  personalChecklist,
  personalGuideVisible,
  personalNextStep,
  personalOnboardingDone,
} from "./onboarding";
import { can, canIn, PERMISSIONS, personalScopeOf, plansSessions } from "./permissions";
import {
  ATHLETE_VIDEOS_PER_MONTH,
  COACH_PLANS,
  isPaidPlan,
  PERSONAL_QUOTAS,
  planForSubscription,
  PLANS,
} from "./plans";

describe("droits d'un espace personnel", () => {
  it("le titulaire garde tout ce qu'un athlète peut faire", () => {
    for (const permission of PERMISSIONS) {
      if (can("athlete", permission)) expect(canIn("personal", "athlete", permission)).toBe(true);
    }
  });

  it("il planifie pour lui seul : séances, bibliothèque, mesures, toujours à la portée « self »", () => {
    for (const permission of ["manageSessions", "editExercises", "recordPerformance"] as const) {
      expect(personalScopeOf("athlete", permission)).toBe("self");
      expect(can("athlete", permission)).toBe(false);
    }
    expect(plansSessions("personal", "athlete")).toBe(true);
    expect(plansSessions("coach", "athlete")).toBe(false);
  });

  it("aucun droit d'équipe n'en déborde : ni invitation, ni fiches, ni notes, ni annonces, ni abonnement", () => {
    for (const permission of [
      "inviteAthlete",
      "inviteCoach",
      "manageAthletes",
      "privateNotes",
      "filmAndAnnotate",
      "publishAnnouncement",
      "manageSubscription",
      "manageOrganization",
    ] as const) {
      expect(canIn("personal", "athlete", permission)).toBe(false);
    }
  });

  it("aucun autre rôle n'a de droit dans un espace personnel", () => {
    for (const role of orgRole.options.filter((r) => r !== "athlete")) {
      for (const permission of PERMISSIONS) expect(canIn("personal", role, permission)).toBe(false);
    }
  });

  it("l'espace d'un coach garde exactement la matrice", () => {
    for (const role of orgRole.options) {
      for (const permission of PERMISSIONS) expect(canIn("coach", role, permission)).toBe(can(role, permission));
    }
  });

  it("les mesures d'un athlète ont la portée de la gestion des fiches, sans elle", () => {
    for (const role of orgRole.options) expect(can(role, "recordPerformance")).toBe(can(role, "manageAthletes"));
  });
});

describe("offre personnelle", () => {
  it("gratuite, jamais vendue, hors des offres de coach", () => {
    expect(PLANS.personal.prices).toBeNull();
    expect(isPaidPlan("personal")).toBe(false);
    expect(COACH_PLANS).not.toContain("personal");
    expect(planForSubscription("personal", "canceled")).toBe("personal");
  });

  it("un athlète, aucun groupe ni coach, et les petits quotas mensuels", () => {
    expect(PLANS.personal.limits).toMatchObject({ maxAthletes: 1, maxGroups: 0, maxCoaches: 0 });
    expect(PLANS.personal.limits.maxVideosPerMonth).toBe(PERSONAL_QUOTAS.videosPerMonth);
    expect(ATHLETE_VIDEOS_PER_MONTH.personal).toBe(4);
    expect(plannerLimits("personal")).toEqual({ proposals: 5, audioSeconds: 600 });
    expect(plannerQuotaFits("personal", { proposals: 4, audioSeconds: 0 }, { proposals: 1, audioSeconds: 0 })).toBe(
      true,
    );
    expect(plannerQuotaFits("personal", { proposals: 5, audioSeconds: 0 }, { proposals: 1, audioSeconds: 0 })).toBe(
      false,
    );
    expect(plannerQuotaFits("personal", { proposals: 0, audioSeconds: 590 }, { proposals: 0, audioSeconds: 20 })).toBe(
      false,
    );
  });
});

describe("premiers pas de l'athlète autonome", () => {
  const none = { sessions: 0, validations: 0, measures: 0, installed: false };

  it("planifier, valider, mesurer, installer, dans cet ordre", () => {
    expect(personalChecklist(none).map((step) => step.key)).toEqual(["plan", "validate", "measure", "install"]);
    expect(personalNextStep(none)).toBe("plan");
    expect(personalNextStep({ ...none, sessions: 1 })).toBe("validate");
  });

  it("une validation prouve la planification ; la fin demande les quatre", () => {
    expect(personalChecklist({ ...none, validations: 1 })[0]!.done).toBe(true);
    expect(personalOnboardingDone({ sessions: 1, validations: 1, measures: 1, installed: false })).toBe(false);
    expect(personalOnboardingDone({ sessions: 1, validations: 1, measures: 1, installed: true })).toBe(true);
  });

  it("l'installation ne vaut pas un e-mail", () => {
    expect(personalActivationStep({ sessions: 1, validations: 1, measures: 1, installed: false })).toBeNull();
  });

  it("la carte attend un nouveau venu, et se referme", () => {
    const memory = {
      tourSeenAt: null,
      welcomeSeenAt: null,
      dismissedAt: null,
      celebratedAt: null,
      skipped: [],
      seenScreens: [],
    };
    expect(personalGuideVisible(none, null)).toBe(false);
    expect(personalGuideVisible(none, memory)).toBe(true);
    expect(personalGuideVisible(none, { ...memory, dismissedAt: new Date() })).toBe(false);
  });
});

describe("e-mails de l'athlète autonome", () => {
  const created = new Date("2026-11-01T08:00:00Z");
  const facts = { sessions: 0, validations: 0, measures: 0, installed: false };
  const at = (days: number) => new Date(created.getTime() + days * 86_400_000);

  it("J1, J3 et J7, sur la prochaine étape, une clé par échéance", () => {
    expect(personalActivationEmailFor({ id: "s", createdAt: created, facts }, at(1.5))).toEqual({
      day: 1,
      step: "plan",
      dedupeKey: "personal_activation:s:1",
    });
    expect(personalActivationEmailFor({ id: "s", createdAt: created, facts }, at(4))?.day).toBe(3);
    expect(personalActivationEmailFor({ id: "s", createdAt: created, facts }, at(8))?.day).toBe(7);
    expect(personalActivationEmailFor({ id: "s", createdAt: created, facts }, at(2.5))).toBeNull();
    expect(personalActivationEmailFor({ id: "s", createdAt: created, facts }, at(11))).toBeNull();
  });

  it("« Termine ton inscription » : une fois, de 24 à 72 heures, sans espace ni invitation", () => {
    const hours = (h: number) => new Date(created.getTime() + h * 3_600_000);
    const account = { createdAt: created, spaces: 0, openInvitations: 0 };
    expect(finishSignupDue(account, hours(23))).toBe(false);
    expect(finishSignupDue(account, hours(25))).toBe(true);
    expect(finishSignupDue(account, hours(73))).toBe(false);
    expect(finishSignupDue({ ...account, spaces: 1 }, hours(25))).toBe(false);
    expect(finishSignupDue({ ...account, openInvitations: 1 }, hours(25))).toBe(false);
  });
});
