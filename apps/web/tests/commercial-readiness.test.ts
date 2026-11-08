import { randomUUID } from "node:crypto";
import { billingEmailsFor } from "@tartan/domain";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { queueTrialReminders } from "@/server/email-outbox.service";
import { createOrganization } from "@/server/org.service";
import { exportSpace } from "@/server/space-export.service";
import { addAthlete, makeOrg, makeUser } from "./helpers";

const NOW = new Date("2030-06-12T07:00:00Z");
const base = { paid: true, cancelAt: null, subscriptionId: "sub_1", periodEnd: new Date("2030-07-01T00:00:00Z") };

describe("relances de paiement", () => {
  it("prévient une seule fois par échéance quand le paiement échoue", () => {
    const emails = billingEmailsFor({ ...base, status: "active" }, { ...base, status: "past_due" });
    expect(emails).toEqual([{ kind: "payment_failed", dedupeKey: "sub_1:past_due:2030-07-01" }]);
    expect(billingEmailsFor({ ...base, status: "past_due" }, { ...base, status: "past_due" })).toEqual([]);
  });

  it("confirme la reprise après un impayé", () => {
    expect(billingEmailsFor({ ...base, status: "past_due" }, { ...base, status: "active" })).toEqual([
      { kind: "recovered", dedupeKey: "sub_1:recovered:2030-07-01" },
    ]);
  });

  it("rappelle la fin d'essai trois jours avant, une seule fois", async () => {
    const org = await makeOrg("Essai");
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: org.owner.userId } });
    const providerRef = `sub_${randomUUID()}`;
    await prisma.subscription.create({
      data: {
        organizationId: org.organizationId,
        planKey: "coach",
        status: "trialing",
        provider: "stripe",
        providerRef,
        trialEndsAt: new Date("2030-06-14T12:00:00Z"),
        interval: "month",
      },
    });
    expect(await queueTrialReminders(NOW)).toBe(1);
    expect(await queueTrialReminders(NOW)).toBe(0);
    expect(
      await prisma.emailOutbox.count({ where: { kind: "trial_ending", toEmail: owner.email, dedupeKey: { startsWith: providerRef } } }),
    ).toBe(1);
  });
});

describe("limitation de débit", () => {
  it("reste exacte sous des appels simultanés", async () => {
    const key = `test:${randomUUID()}`;
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => enforceRateLimit(key, 5, 60)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);
  });
});

describe("ouverture des fonctions", () => {
  it("active progression et phases pour un nouvel espace", async () => {
    const owner = await makeUser("Nouveau");
    const org = await createOrganization(owner.userId, {
      name: "Espace neuf",
      type: "independent",
      disciplines: [],
      firstGroupName: "Groupe",
    });
    expect(await prisma.organization.findUnique({ where: { id: org.id } })).toMatchObject({
      progressionEnabled: true,
      phasesEnabled: true,
    });
  });
});

describe("export d'un espace", () => {
  it("donne la programmation au propriétaire, sans santé ni note privée", async () => {
    const org = await makeOrg("Export");
    await addAthlete(org.organizationId, org.groupId, "Mia");
    const data = await exportSpace(org.owner.userId, org.organizationId);
    expect(data.groups).toHaveLength(1);
    expect(data.templates.length).toBeGreaterThan(0);
    const text = JSON.stringify(data);
    for (const forbidden of ['"rpe"', '"pain"', '"injur', "coachNotes", '"birthDate"']) expect(text).not.toContain(forbidden);
  });

  it("est réservé au propriétaire", async () => {
    const org = await makeOrg("Reserve");
    const athlete = await addAthlete(org.organizationId, org.groupId, "Noa");
    await expect(exportSpace(athlete.userId, org.organizationId)).rejects.toThrow();
  });
});
