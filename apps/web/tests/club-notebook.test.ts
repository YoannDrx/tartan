import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { w } from "@tartan/i18n/web";
import { todayIso } from "@/lib/dates";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/server/access";
import { getPlannerUsage, reservePlannerOperation } from "@/server/ai/usage.service";
import { getAthleteToday } from "@/server/athlete-view.service";
import { getMe } from "@/server/me.service";
import { queuePersonalActivationEmails } from "@/server/personal-email";
import { canOpenNotebook, createPersonalSpace } from "@/server/personal-space.service";
import { listPlanning, publishSession, saveScheduledSession } from "@/server/session.service";
import { getAlerts, getTrackingGrid } from "@/server/tracking.service";
import { addAthlete, addStaff, makeOrg, makeUser } from "./helpers";

// L'athlète invité par un coach ouvre son carnet pour planifier lui-même (décision du 27 novembre 2026), même
// quand les inscriptions des athlètes autonomes sont fermées. Le quota du coach n'est jamais touché, et ses
// séances restent invisibles du coach.
const settings = vi.hoisted(() => ({ AI_PLANNER_ENABLED: "true" }));
vi.mock("@/lib/env", async (original) => {
  const actual = await original<typeof import("@/lib/env")>();
  return { ...actual, env: () => ({ ...actual.env(), ...settings }) };
});

const DAY = 86_400_000;
const notebookInput = {
  firstName: "Lina",
  lastName: "Club",
  disciplines: ["sprint"],
  trainingObjectives: ["speed" as const],
  termsAccepted: true as const,
};

// Les inscriptions des athlètes autonomes, fermées pour tout ce fichier : la clé enregistrée prime sur l'environnement.
const setAthleteSignup = (mode: "public" | "closed") =>
  prisma.platformSetting.upsert({
    where: { key: "athleteSignupMode" },
    create: { key: "athleteSignupMode", value: mode },
    update: { value: mode },
  });

beforeAll(async () => {
  await setAthleteSignup("closed");
});
afterAll(async () => {
  await prisma.platformSetting.deleteMany({ where: { key: "athleteSignupMode" } });
});
beforeEach(() => {
  outbox.length = 0;
});

describe("canOpenNotebook", () => {
  it("inscriptions fermées : l'athlète actif d'un club l'ouvre, un compte sans club non", async () => {
    const club = await makeOrg("Ouvre");
    const athlete = await addAthlete(club.organizationId, club.groupId, "Invitée");
    const alone = await makeUser("Seule");
    expect(await canOpenNotebook(athlete.userId)).toBe(true);
    expect(await canOpenNotebook(alone.userId)).toBe(false);
    await expect(createPersonalSpace(alone.userId, notebookInput)).rejects.toMatchObject({ code: "signup_closed" });
  });

  it("ni le coach, ni l'adjoint, ni un membre suspendu, ni l'athlète de la seule démonstration", async () => {
    const club = await makeOrg("Droits");
    const staff = await addStaff(club.organizationId, "Adjoint", "assistant");
    const gone = await addAthlete(club.organizationId, club.groupId, "Partie");
    await prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: club.organizationId, userId: gone.userId } },
      data: { status: "suspended" },
    });
    const demo = await makeOrg("Démo");
    await prisma.organization.update({ where: { id: demo.organizationId }, data: { isDemo: true } });
    const demoAthlete = await addAthlete(demo.organizationId, demo.groupId, "Fictive");
    for (const userId of [club.owner.userId, staff.userId, gone.userId, demoAthlete.userId])
      expect(await canOpenNotebook(userId)).toBe(false);
  });

  it("jamais à un mineur, même athlète d'un club", async () => {
    const club = await makeOrg("Âge");
    const minor = await addAthlete(club.organizationId, club.groupId, "Jeune", {
      birthDate: `${new Date().getFullYear() - 15}-01-01`,
    });
    expect(await canOpenNotebook(minor.userId)).toBe(false);
    await expect(createPersonalSpace(minor.userId, notebookInput)).rejects.toMatchObject({ status: 403 });
    expect(await prisma.organization.count({ where: { personalOwnerId: minor.userId } })).toBe(0);
  });

  it("inscriptions ouvertes : tout compte adulte l'ouvre", async () => {
    await setAthleteSignup("public");
    try {
      expect(await canOpenNotebook((await makeUser("Libre")).userId)).toBe(true);
    } finally {
      await setAthleteSignup("closed");
    }
  });

  it("`/me` le dit à l'app native, et le redit vrai une fois le carnet ouvert", async () => {
    const club = await makeOrg("Moi");
    const athlete = await addAthlete(club.organizationId, club.groupId, "Native");
    const alone = await makeUser("Ailleurs");
    expect((await getMe(athlete.userId)).notebook).toEqual({ available: true });
    expect((await getMe(alone.userId)).notebook).toEqual({ available: false });
    await createPersonalSpace(athlete.userId, notebookInput);
    expect((await getMe(athlete.userId)).notebook).toEqual({ available: true });
  });
});

describe("le carnet de l'athlète d'un club", () => {
  it("s'ouvre inscriptions fermées, sans e-mail d'athlète autonome, sur l'offre personnelle", async () => {
    const club = await makeOrg("Carnet");
    const athlete = await addAthlete(club.organizationId, club.groupId, "Lina");
    // Les conditions du carnet restent demandées, même depuis un club.
    await expect(
      createPersonalSpace(athlete.userId, { ...notebookInput, termsAccepted: false } as never),
    ).rejects.toBeTruthy();
    const created = await createPersonalSpace(athlete.userId, notebookInput);
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: created.organizationId } });
    expect(org).toMatchObject({ kind: "personal", plan: "personal", personalOwnerId: athlete.userId });
    expect(
      await prisma.consent.findFirst({ where: { userId: athlete.userId, kind: "terms", revokedAt: null } }),
    ).toBeTruthy();
    // Ni bienvenue, ni conseils J1 à J7 de l'athlète autonome : son coach l'a déjà accueilli.
    await prisma.organization.update({
      where: { id: created.organizationId },
      data: { createdAt: new Date(Date.now() - 1.5 * DAY) },
    });
    await queuePersonalActivationEmails(new Date());
    expect(await prisma.emailOutbox.count({ where: { organizationId: created.organizationId } })).toBe(0);
    expect(outbox.filter((mail) => mail.subject === w.personal.emails.welcome.subject)).toEqual([]);
  });

  it("son planificateur a ses propres quotas : celui du coach n'est jamais touché", async () => {
    const club = await makeOrg("Quota");
    await prisma.organization.update({
      where: { id: club.organizationId },
      data: { plan: "coach", aiPlannerEnabled: true },
    });
    const athlete = await addAthlete(club.organizationId, club.groupId, "Quota");
    const { organizationId } = await createPersonalSpace(athlete.userId, notebookInput);
    // L'athlète ne planifie pas dans le club : ni lecture ni réservation du quota du coach.
    await expect(getPlannerUsage(athlete.userId, club.organizationId)).rejects.toMatchObject({ status: 403 });
    const usage = await getPlannerUsage(athlete.userId, organizationId);
    expect(usage.limit).toEqual({ proposals: 5, audioSeconds: 600 });
    await reservePlannerOperation(athlete.userId, organizationId, {
      id: randomUUID(),
      kind: "proposal",
      fingerprint: createHash("sha256").update(randomUUID()).digest("hex"),
    });
    expect((await getPlannerUsage(athlete.userId, organizationId)).reserved.proposals).toBe(1);
    const coach = await getPlannerUsage(club.owner.userId, club.organizationId);
    expect(coach.used).toEqual({ proposals: 0, audioSeconds: 0 });
    expect(coach.reserved).toEqual({ proposals: 0, audioSeconds: 0 });
  });

  it("ses séances restent invisibles du coach : suivi, alertes, planning et accès", async () => {
    const club = await makeOrg("Secret");
    const athlete = await addAthlete(club.organizationId, club.groupId, "Secrète");
    const notebook = await createPersonalSpace(athlete.userId, notebookInput);
    const [exercise] = await prisma.exercise.findMany({ where: { organizationId: notebook.organizationId }, take: 1 });
    const today = todayIso();
    const saved = await saveScheduledSession(athlete.userId, notebook.organizationId, {
      date: today,
      publishAt: null,
      startTime: null,
      location: null,
      assignments: [],
      overrides: [],
      draft: {
        title: "Ma séance à moi",
        type: "strength",
        durationMin: 30,
        coachNote: null,
        blocks: [
          { name: "Force", variant: "club", items: [{ exerciseId: exercise!.id, prescription: { sets: 3, reps: 5 } }] },
        ],
      },
    });
    await publishSession(athlete.userId, notebook.organizationId, saved.id);
    expect(JSON.stringify(await getAthleteToday(athlete.userId, notebook.organizationId))).toContain(saved.id);
    const coach = club.owner.userId;
    const seen = JSON.stringify([
      await getTrackingGrid(coach, club.organizationId, { week: today }),
      await getAlerts(coach, club.organizationId),
      await listPlanning(coach, club.organizationId, { from: today, to: today }),
    ]);
    expect(seen).not.toContain(saved.id);
    expect(seen).not.toContain("Ma séance à moi");
    await expect(requireOrgMember(coach, notebook.organizationId, "viewTracking")).rejects.toMatchObject({
      status: 403,
    });
    await expect(listPlanning(coach, notebook.organizationId, { from: today, to: today })).rejects.toMatchObject({
      status: 403,
    });
  });
});
