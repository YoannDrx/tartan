import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { todayIso } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { logSession } from "@/server/athlete-view.service";
import { saveExercise } from "@/server/exercise.service";
import { acceptInvitation, groupInvitationLink, inviteByEmails } from "@/server/invitation.service";
import { getOnboarding, getOnboardingMemory, updateOnboarding } from "@/server/onboarding.service";
import { publishSession, saveScheduledSession } from "@/server/session.service";
import { makeOrg, makeUser } from "./helpers";

const tokenOf = (link: string) => link.split("/").at(-1)!;
const join = (consents: { health: boolean; video: boolean }) => ({
  firstName: "Léa",
  lastName: "Arrivante",
  birthDate: "2000-01-01",
  consents: { terms: true, ...consents },
});

const publishToday = async (org: Awaited<ReturnType<typeof makeOrg>>) => {
  const exercise = await saveExercise(org.owner.userId, org.organizationId, { name: "Bonds", category: "plyo" });
  const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
    date: todayIso(),
    startTime: null,
    location: null,
    draft: {
      title: "Pliométrie",
      type: "strength" as const,
      durationMin: 45,
      coachNote: null,
      blocks: [
        {
          name: "Corps de séance",
          variant: "club" as const,
          items: [{ exerciseId: exercise.id, prescription: { sets: 3, reps: 5 } }],
        },
      ],
    },
    assignments: [{ targetType: "group", targetId: org.groupId }],
    overrides: [],
    publishAt: null,
  });
  await publishSession(org.owner.userId, org.organizationId, session.id);
  return session.id;
};

describe("accords donnés en rejoignant (G15)", () => {
  it("un membre n'existe jamais sans ses accords : un accord qui échoue annule l'arrivée", async () => {
    const org = await makeOrg("Accords");
    const user = await makeUser("Sans");
    const { link } = await groupInvitationLink(org.owner.userId, org.organizationId, org.groupId);
    // L'écriture de l'accord santé de ce compte échoue, comme une panne en plein milieu.
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION tartan_test_refuse_consent() RETURNS trigger AS $$
      BEGIN
        IF NEW.athlete_id IN (SELECT id FROM athletes WHERE user_id = '${user.userId}'::uuid) THEN
          RAISE EXCEPTION 'accord refusé pour le test';
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER tartan_test_refuse_consent BEFORE INSERT ON athlete_consents FOR EACH ROW EXECUTE FUNCTION tartan_test_refuse_consent()`,
    );
    try {
      await expect(acceptInvitation(user, tokenOf(link), join({ health: true, video: false }))).rejects.toThrow();
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER tartan_test_refuse_consent ON athlete_consents`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION tartan_test_refuse_consent()`);
    }
    // Rien n'est resté à moitié : ni membre, ni fiche, ni lien consommé.
    const where = { organizationId_userId: { organizationId: org.organizationId, userId: user.userId } };
    expect(await prisma.organizationMember.findUnique({ where })).toBeNull();
    expect(await prisma.athlete.findUnique({ where })).toBeNull();
    expect(await prisma.consent.count({ where: { userId: user.userId } })).toBe(0);
    const invitation = await prisma.invitation.findFirstOrThrow({ where: { organizationId: org.organizationId } });
    expect(invitation.useCount).toBe(0);
  });

  it("les accords cochés sont tracés avec l'arrivée, et seulement eux", async () => {
    const org = await makeOrg("Tracés");
    const user = await makeUser("Avec");
    const { link } = await groupInvitationLink(org.owner.userId, org.organizationId, org.groupId);
    const { athleteId } = await acceptInvitation(user, tokenOf(link), join({ health: true, video: false }));
    const rows = await prisma.athleteConsent.findMany({ where: { athleteId: athleteId! } });
    expect(rows.map((row) => [row.kind, Boolean(row.grantedAt)])).toEqual([["health", true]]);
    const account = await prisma.consent.findMany({ where: { userId: user.userId }, orderBy: { kind: "asc" } });
    expect(account.map((row) => row.kind).sort()).toEqual(["health", "terms"]);
    const audits = await prisma.auditLog.count({ where: { actorId: user.userId, action: "consent_granted" } });
    expect(audits).toBeGreaterThanOrEqual(2);
  });
});

describe("premiers pas du coach", () => {
  it("un espace neuf guide son coach : tour dû, carte visible, étapes déduites des faits", async () => {
    const org = await makeOrg("Neuf");
    const memory = await getOnboardingMemory(org.owner.userId, org.organizationId);
    expect(memory).toEqual({ staff: true, guided: true, tourDue: true, seenScreens: [] });
    const state = await getOnboarding(org.owner.userId, org.organizationId);
    expect(state.guideVisible).toBe(true);
    expect(state.steps.map((step) => [step.key, step.done])).toEqual([
      ["profile", false],
      ["invite", false],
      ["create", false],
      ["publish", false],
      ["validate", false],
    ]);
    expect(state.progress).toEqual({ done: 0, total: 5 });
    // Le matériel choisi à la création n'est pas déclaré ici : l'étape facultative reste à faire.
    expect(state.optionalSteps.find((step) => step.key === "equipment")?.done).toBe(false);
  });

  it("l'état survit d'un appel à l'autre : tour vu, carte refermée puis rouverte, étapes écartées, repères", async () => {
    const org = await makeOrg("Gardé");
    const { userId } = org.owner;
    let state = await updateOnboarding(userId, org.organizationId, { tourSeen: true, seenScreen: "suivi" });
    expect(state.tourDue).toBe(false);
    expect(state.seenScreens).toEqual(["suivi"]);
    state = await updateOnboarding(userId, org.organizationId, { seenScreen: "suivi" });
    expect(state.seenScreens).toEqual(["suivi"]);
    state = await updateOnboarding(userId, org.organizationId, { dismissed: true, skip: "phase" });
    expect(state.guideVisible).toBe(false);
    expect(state.optionalSteps.find((step) => step.key === "phase")?.skipped).toBe(true);
    state = await updateOnboarding(userId, org.organizationId, { dismissed: false, unskip: "phase" });
    expect(state.guideVisible).toBe(true);
    expect(state.skipped).toEqual([]);
    // Revoir le tour ne le rend pas dû à nouveau.
    expect((await getOnboardingMemory(userId, org.organizationId)).tourDue).toBe(false);
  });

  it("inviter quelques adresses fait l'étape, la première validation la suivante, puis la fête une fois", async () => {
    const org = await makeOrg("Fête");
    const { userId } = org.owner;
    await inviteByEmails(userId, org.organizationId, org.groupId, [
      `a-${randomUUID()}@test.tartan.coach`,
      `b-${randomUUID()}@test.tartan.coach`,
    ]);
    expect(
      await prisma.invitation.count({ where: { organizationId: org.organizationId, kind: "personal_email" } }),
    ).toBe(2);
    const athlete = await makeUser("Valide");
    const { link } = await groupInvitationLink(userId, org.organizationId, org.groupId);
    await acceptInvitation(athlete, tokenOf(link), join({ health: false, video: false }));
    const sessionId = await publishToday(org);
    await logSession(athlete.userId, org.organizationId, sessionId, {
      clientId: `onboarding-${randomUUID()}`,
      status: "done",
      variantDone: "club",
    });
    let state = await getOnboarding(userId, org.organizationId);
    expect(state.steps.filter((step) => !step.done).map((step) => step.key)).toEqual(["profile"]);
    expect(state.celebrationDue).toBe(false);
    await prisma.profile.update({ where: { id: userId }, data: { avatarUrl: "https://exemple.test/photo.png" } });
    state = await getOnboarding(userId, org.organizationId);
    expect(state.celebrationDue).toBe(true);
    expect(state.guideVisible).toBe(false);
    state = await updateOnboarding(userId, org.organizationId, { celebrated: true });
    expect(state.celebrationDue).toBe(false);
  });

  it("un membre arrivé avant ce suivi n'est pas guidé, même après avoir refermé quelque chose", async () => {
    const org = await makeOrg("Ancien");
    const { userId } = org.owner;
    await prisma.onboardingState.deleteMany({ where: { organizationId: org.organizationId } });
    expect(await getOnboardingMemory(userId, org.organizationId)).toMatchObject({ guided: false, tourDue: false });
    const state = await updateOnboarding(userId, org.organizationId, { seenScreen: "exercices" });
    expect(state.guided).toBe(false);
    expect(state.tourDue).toBe(false);
  });

  it("chacun n'écrit que ses premiers pas, dans un espace dont il est membre", async () => {
    const org = await makeOrg("Seul");
    const other = await makeOrg("Autre");
    await expect(updateOnboarding(other.owner.userId, org.organizationId, { tourSeen: true })).rejects.toThrow();
    await updateOnboarding(org.owner.userId, org.organizationId, { tourSeen: true });
    expect((await getOnboardingMemory(other.owner.userId, other.organizationId)).tourDue).toBe(true);
  });
});

describe("accueil de l'athlète", () => {
  it("naît avec l'arrivée ; la carte facultative attend la première validation", async () => {
    const org = await makeOrg("Accueil");
    const user = await makeUser("Arrive");
    const { link } = await groupInvitationLink(org.owner.userId, org.organizationId, org.groupId);
    await acceptInvitation(user, tokenOf(link), join({ health: false, video: false }));
    let state = await getOnboarding(user.userId, org.organizationId);
    expect(state).toMatchObject({ guided: true, staff: false, welcomeSeenAt: null, extrasVisible: false, steps: [] });
    state = await updateOnboarding(user.userId, org.organizationId, { welcomeSeen: true });
    expect(state.welcomeSeenAt).not.toBeNull();

    const sessionId = await publishToday(org);
    await logSession(user.userId, org.organizationId, sessionId, {
      clientId: `extras-${randomUUID()}`,
      status: "done",
      variantDone: "club",
    });
    expect((await getOnboarding(user.userId, org.organizationId)).extrasVisible).toBe(true);
    state = await updateOnboarding(user.userId, org.organizationId, { dismissed: true });
    expect(state.extrasVisible).toBe(false);
  });
});
