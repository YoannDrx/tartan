import { describe, expect, it } from "vitest";
import {
  DEMO_ATHLETES,
  DEMO_COMMENTS,
  DEMO_SPACE_TTL_DAYS,
  DEMO_WEEKS_AFTER,
  DEMO_WEEKS_BEFORE,
  demoOutcome,
  demoPhases,
  demoSchedule,
  demoSpaceExpiry,
  demoSquatLoad,
  demoStrengthTests,
  demoTemplate,
  demoValidatedToday,
  isDemoSpaceExpired,
  seededRandom,
} from "./demo-space";
import { STARTER_LIBRARY } from "./starter-library";
import { addDays, startOfWeek } from "./status";

describe("espace de démonstration", () => {
  it("expire 14 jours après son ouverture, pas avant", () => {
    const opened = new Date("2026-11-19T10:00:00Z");
    const expiry = demoSpaceExpiry(opened);
    expect(DEMO_SPACE_TTL_DAYS).toBe(14);
    expect(expiry.toISOString()).toBe("2026-12-03T10:00:00.000Z");
    expect(isDemoSpaceExpired(expiry, new Date("2026-12-03T09:59:59Z"))).toBe(false);
    expect(isDemoSpaceExpired(expiry, new Date("2026-12-03T10:00:00Z"))).toBe(true);
    expect(isDemoSpaceExpired(null, new Date("2030-01-01T00:00:00Z"))).toBe(false);
  });

  it("donne la même saison pour la même graine", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const first = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(first);
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it("étale des séances passées et à venir, avec toujours une séance aujourd'hui", () => {
    for (const today of ["2026-11-19", "2026-11-22", "2026-11-23"]) {
      const slots = demoSchedule(today);
      expect(slots.some((slot) => slot.past)).toBe(true);
      expect(slots.some((slot) => slot.date > today)).toBe(true);
      expect(slots.filter((slot) => slot.today && slot.group === 0)).toHaveLength(1);
      expect(slots.every((slot) => slot.past === slot.date < today)).toBe(true);
      expect(slots[0]!.date).toBe(addDays(startOfWeek(today), -7 * DEMO_WEEKS_BEFORE));
      const dates = slots.map((slot) => slot.date);
      expect([...dates].sort()).toEqual(dates);
    }
    const weeks = DEMO_WEEKS_BEFORE + DEMO_WEEKS_AFTER + 1;
    expect(demoSchedule("2026-11-18").length).toBe(weeks * 5);
  });

  it("ne cite que des exercices de la bibliothèque initiale", () => {
    const names = new Set(STARTER_LIBRARY.map((exercise) => exercise.name));
    for (const kind of ["strength", "plyo", "running", "cones"] as const) {
      for (const block of demoTemplate(kind).blocks) {
        for (const item of block.items) expect(names.has(item.exercise), item.exercise).toBe(true);
      }
    }
  });

  it("produit des validations cohérentes", () => {
    const random = seededRandom(7);
    const outcomes = DEMO_ATHLETES.flatMap((athlete) =>
      Array.from({ length: 40 }, () => ({
        athlete,
        outcome: demoOutcome({ kind: "plyo", durationMin: 45, athlete, random }),
      })),
    );
    for (const { athlete, outcome } of outcomes) {
      if (outcome.status === "missed") {
        expect(outcome).toEqual({ status: "missed", rpe: null, durationMin: null, variant: null, comment: null });
        continue;
      }
      // Sans accord santé, aucun effort ressenti.
      if (!athlete.health) expect(outcome.rpe).toBeNull();
      else expect(outcome.rpe).toBeGreaterThanOrEqual(5);
      expect(outcome.durationMin).toBeGreaterThan(0);
      expect(outcome.durationMin).toBeLessThanOrEqual(45);
      if (outcome.status === "partial") expect(outcome.durationMin).toBeLessThan(40);
      if (outcome.comment) expect(DEMO_COMMENTS[outcome.comment]).toBeTruthy();
      if (outcome.status === "done") expect(["good", "heavy", null]).toContain(outcome.comment);
      else expect(["short", "tired", null]).toContain(outcome.comment);
    }
    const statuses = new Set(outcomes.map(({ outcome }) => outcome.status));
    expect(statuses).toEqual(new Set(["done", "partial", "missed"]));
    // Les plus assidus font plus souvent la séance en entier.
    const doneRate = (name: string) => {
      const mine = outcomes.filter(({ athlete }) => athlete.firstName === name);
      return mine.filter(({ outcome }) => outcome.status === "done").length / mine.length;
    };
    expect(doneRate("Léa")).toBeGreaterThan(doneRate("Yanis"));
  });

  it("fait valider un athlète sur deux le jour même", () => {
    const group = DEMO_ATHLETES.filter((athlete) => athlete.group === 0).map((_, index) => demoValidatedToday(index));
    expect(group.filter(Boolean).length).toBe(Math.ceil(group.length / 2));
    expect(group.some((validated) => !validated)).toBe(true);
  });

  it("fait progresser la force sans dépasser le maximum du jour", () => {
    for (const athlete of DEMO_ATHLETES) {
      const tests = demoStrengthTests(athlete, "2026-11-19");
      expect(tests.map((test) => test.value)).toEqual([...tests.map((test) => test.value)].sort((a, b) => a - b));
      expect(tests.at(-1)!.value).toBe(athlete.squat);
      expect(demoSquatLoad(athlete, 0)).toBeLessThan(athlete.squat);
      expect(demoSquatLoad(athlete, 3)).toBeLessThanOrEqual(demoSquatLoad(athlete, 0));
    }
  });

  it("enchaîne deux phases sans chevauchement, la seconde en cours", () => {
    const [first, second] = demoPhases("2026-11-19");
    expect(first!.endDate < second!.startDate).toBe(true);
    expect(second!.startDate <= "2026-11-19" && second!.endDate >= "2026-11-19").toBe(true);
  });

  it("n'utilise que des personnes fictives, sans adresse", () => {
    expect(JSON.stringify(DEMO_ATHLETES)).not.toMatch(/@/);
    expect(new Set(DEMO_ATHLETES.map((athlete) => athlete.group))).toEqual(new Set([0, 1]));
  });
});
