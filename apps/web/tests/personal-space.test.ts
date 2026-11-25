import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, startOfWeek } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { todayIso } from "@/lib/dates";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { deriveToken, sha256 } from "@/lib/tokens";
import { requireOrgMember } from "@/server/access";
import { usageOverview } from "@/server/admin-console.service";
import { getPlannerUsage } from "@/server/ai/usage.service";
import { addCoachNote } from "@/server/athlete.service";
import { getAthleteCalendar, getAthleteToday, logSession } from "@/server/athlete-view.service";
import { createCheckout, queuePlanLimitNotices } from "@/server/billing.service";
import { publishAnnouncement } from "@/server/comm.service";
import { sendEveQuestions } from "@/server/cron.service";
import { sendWeeklyDigests } from "@/server/digest.service";
import { saveExercise } from "@/server/exercise.service";
import { INVITATION_PURPOSE } from "@/server/invitation-email";
import { acceptInvitation, createInvitation } from "@/server/invitation.service";
import { queueActivationEmails } from "@/server/lifecycle-email.service";
import { listSpaces } from "@/server/me.service";
import { saveGroup, updateOrganization } from "@/server/org.service";
import { createPersonalSpace, signupOptions } from "@/server/personal-space.service";
import { updatePlatformSettings } from "@/server/platform-settings.service";
import { listPlanning, listTemplates, publishSession, saveScheduledSession } from "@/server/session.service";
import { addStrengthTest } from "@/server/strength.service";
import { saveTrainingPhase } from "@/server/training-phases.service";
import { addAthlete, makeOrg, makeUser } from "./helpers";

// Le planificateur est allumé côté serveur : l'espace personnel y a droit, à ses petits quotas.
const settings = vi.hoisted(() => ({ AI_PLANNER_ENABLED: "true" }));
vi.mock("@/lib/env", async (original) => {
  const actual = await original<typeof import("@/lib/env")>();
  return { ...actual, env: () => ({ ...actual.env(), ...settings }) };
});

const DAY = 86_400_000;
const signup = {
  firstName: "Inès",
  lastName: "Seule",
  disciplines: ["sprint"],
  trainingObjectives: ["speed" as const],
  termsAccepted: true as const,
};

// Un athlète qui s'entraîne seul, avec son espace personnel.
const solo = async (name = "Solo") => {
  const user = await makeUser(name);
  const space = await createPersonalSpace(user.userId, signup);
  return { ...user, ...space };
};

const sessionFor = (
  exerciseId: string,
  date: string,
  assignments: { targetType: "group" | "athlete"; targetId: string }[],
) => ({
  date,
  publishAt: null,
  startTime: null,
  location: null,
  assignments,
  overrides: [],
  draft: {
    title: "Ma séance",
    type: "strength" as const,
    durationMin: 30,
    coachNote: null,
    blocks: [{ name: "Force", variant: "club" as const, items: [{ exerciseId, prescription: { sets: 3, reps: 5 } }] }],
  },
});

beforeEach(() => {
  outbox.length = 0;
});

describe("création de l'espace personnel", () => {
  it("deux appareils ouvrent le même carnet avec le matériel personnel choisi", async () => {
    const user = await makeUser("Piste");
    const input = { ...signup, availableEquipment: ["kettlebells" as const] };
    const first = await Promise.all([createPersonalSpace(user.userId, input), createPersonalSpace(user.userId, input)]);
    expect(first[0]).toEqual(first[1]);
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: first[0]!.organizationId } });
    expect(org.availableEquipment).toEqual(input.availableEquipment);
  });

  it("un espace à part dont il est l'unique membre, athlète de sa propre fiche, en offre personnelle", async () => {
    const me = await solo("Création");
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: me.organizationId } });
    expect(org).toMatchObject({
      kind: "personal",
      personalOwnerId: me.userId,
      ownerId: me.userId,
      plan: "personal",
      isDemo: false,
      name: m.personalSpace.name,
    });
    expect(await prisma.organizationMember.findMany({ where: { organizationId: me.organizationId } })).toEqual([
      expect.objectContaining({ userId: me.userId, role: "athlete", status: "active" }),
    ]);
    expect(await prisma.athlete.findUniqueOrThrow({ where: { id: me.athleteId } })).toMatchObject({
      organizationId: me.organizationId,
      userId: me.userId,
      firstName: "Inès",
    });
    // Ni groupe, ni abonnement : rien à facturer, rien à gérer.
    expect(await prisma.group.count({ where: { organizationId: me.organizationId } })).toBe(0);
    expect(await prisma.subscription.count({ where: { organizationId: me.organizationId } })).toBe(0);
    // La bibliothèque et les modèles de départ, comme l'espace d'un coach.
    expect(await prisma.exercise.count({ where: { organizationId: me.organizationId } })).toBeGreaterThan(10);
    expect(await prisma.sessionTemplate.count({ where: { organizationId: me.organizationId } })).toBeGreaterThan(0);
    // Ses premiers pas, et les conditions acceptées.
    expect(
      await prisma.onboardingState.count({ where: { organizationId: me.organizationId, userId: me.userId } }),
    ).toBe(1);
    expect(await prisma.consent.findFirst({ where: { userId: me.userId, kind: "terms" } })).toBeTruthy();
    // Aucune bienvenue de coach.
    expect(outbox.some((mail) => mail.subject === m.email.welcome.subject(org.name))).toBe(false);
  });

  it("un seul par compte : le redemander ramène au même", async () => {
    const me = await solo("Unique");
    expect(await createPersonalSpace(me.userId, signup)).toEqual({
      organizationId: me.organizationId,
      athleteId: me.athleteId,
    });
    expect(await prisma.organization.count({ where: { personalOwnerId: me.userId } })).toBe(1);
  });

  it("adultes seulement, avec les mêmes règles de date que l'espace d'un coach", async () => {
    const sans = await makeUser("SansDate", { birthDate: null });
    await expect(
      createPersonalSpace(sans.userId, { ...signup, birthDate: `${new Date().getFullYear() - 15}-01-01` }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await prisma.organization.count({ where: { personalOwnerId: sans.userId } })).toBe(0);
    const adulte = await makeUser("Adulte", { birthDate: null });
    await createPersonalSpace(adulte.userId, { ...signup, birthDate: "1995-05-05" });
    expect(await prisma.profile.findUniqueOrThrow({ where: { id: adulte.userId } })).toMatchObject({
      birthDate: new Date("1995-05-05T00:00:00Z"),
    });
  });

  it("le réglage de la console ferme les inscriptions des athlètes autonomes, et la route publique le dit", async () => {
    expect(await signupOptions()).toMatchObject({ athlete: true });
    const admin = { email: `admin-perso-${randomUUID().slice(0, 8)}@test.tartan.coach`, userId: randomUUID() };
    await prisma.platformAdmin.create({ data: { email: admin.email } });
    await prisma.user.create({ data: { id: admin.userId, email: admin.email, name: "Admin", emailVerified: true } });
    await updatePlatformSettings(admin, {
      signupMode: "public",
      athleteSignupMode: "closed",
      checkoutEnabled: false,
      muxVideoLimit: null,
    });
    try {
      expect(await signupOptions()).toEqual({ coach: true, athlete: false });
      const user = await makeUser("Fermée");
      await expect(createPersonalSpace(user.userId, signup)).rejects.toMatchObject({ code: "signup_closed" });
    } finally {
      await prisma.platformSetting.deleteMany();
    }
  });

  it("le sélecteur le nomme « Mon entraînement » ; l'app native y voit un espace d'athlète", async () => {
    const me = await solo("Sélecteur");
    expect(await listSpaces(me.userId)).toEqual([
      expect.objectContaining({
        organizationId: me.organizationId,
        organizationName: m.personalSpace.name,
        role: "athlete",
        athleteId: me.athleteId,
        kind: "personal",
        aiPlannerEnabled: true,
      }),
    ]);
  });
});

describe("droits dans l'espace personnel", () => {
  it("personne d'autre n'y entre, même ajouté à la main", async () => {
    const me = await solo("Seul");
    const intrus = await makeUser("Intrus");
    await prisma.organizationMember.create({
      data: { organizationId: me.organizationId, userId: intrus.userId, role: "owner", status: "active" },
    });
    await expect(requireOrgMember(intrus.userId, me.organizationId)).rejects.toMatchObject({ status: 403 });
    const access = await requireOrgMember(me.userId, me.organizationId);
    expect(access).toMatchObject({ role: "athlete", athleteId: me.athleteId, personal: true });
  });

  it("aucune invitation : ni création, ni lien forgé", async () => {
    const me = await solo("Fermé");
    await expect(
      createInvitation(me.userId, me.organizationId, { kind: "group_link", groupIds: [] }),
    ).rejects.toMatchObject({ status: 403 });
    const id = randomUUID();
    const token = deriveToken(INVITATION_PURPOSE, id);
    await prisma.invitation.create({
      data: {
        id,
        organizationId: me.organizationId,
        kind: "group_link",
        role: "athlete",
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 10 * DAY),
        maxUses: 50,
        invitedBy: me.userId,
      },
    });
    const stranger = await makeUser("Étranger");
    await expect(
      acceptInvitation(stranger, token, {
        firstName: "Vraie",
        lastName: "Personne",
        birthDate: null,
        consents: { terms: true, health: false, video: false },
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await prisma.organizationMember.count({ where: { organizationId: me.organizationId } })).toBe(1);
  });

  it("rien d'un coach : groupes, notes privées, annonces, abonnement, réglages de l'espace", async () => {
    const me = await solo("PasCoach");
    const refused = { status: 403 };
    await expect(saveGroup(me.userId, me.organizationId, { name: "Groupe" })).rejects.toMatchObject(refused);
    await expect(addCoachNote(me.userId, me.organizationId, me.athleteId, "note")).rejects.toMatchObject(refused);
    await expect(
      publishAnnouncement(me.userId, me.organizationId, { body: "Annonce", groupId: randomUUID() }),
    ).rejects.toMatchObject(refused);
    await expect(
      createCheckout(me.userId, me.organizationId, { plan: "coach", interval: "month" }),
    ).rejects.toMatchObject(refused);
    await expect(
      updateOrganization(me.userId, me.organizationId, { name: "Renommé", overdueReminders: true }),
    ).rejects.toMatchObject(refused);
  });

  it("il planifie pour lui seul : un public envoyé par le client est remplacé par sa fiche", async () => {
    const me = await solo("Planifie");
    const other = await makeOrg("Autre");
    const stranger = await addAthlete(other.organizationId, other.groupId, "Ailleurs");
    const [exercise] = await prisma.exercise.findMany({ where: { organizationId: me.organizationId }, take: 1 });
    const today = todayIso();
    const saved = await saveScheduledSession(
      me.userId,
      me.organizationId,
      sessionFor(exercise!.id, today, [
        { targetType: "athlete", targetId: stranger.athleteId },
        { targetType: "group", targetId: other.groupId },
      ]),
    );
    expect(await prisma.assignment.findMany({ where: { scheduledSessionId: saved.id } })).toEqual([
      expect.objectContaining({ targetType: "athlete", targetId: me.athleteId }),
    ]);
    // Son brouillon se voit dans son calendrier de planification, et nulle part ailleurs.
    const planning = await listPlanning(me.userId, me.organizationId, { from: today, to: today });
    expect(planning.sessions.map((s) => s.id)).toContain(saved.id);
    expect(planning.readOnly).not.toContain(saved.id);
    await publishSession(me.userId, me.organizationId, saved.id);
    // Publiée, elle est sa séance du jour : il la valide comme tout athlète, sans se notifier lui-même.
    const todayView = await getAthleteToday(me.userId, me.organizationId);
    expect(JSON.stringify(todayView)).toContain(saved.id);
    expect(await prisma.notification.count({ where: { userId: me.userId } })).toBe(0);
    await logSession(me.userId, me.organizationId, saved.id, {
      clientId: `solo-${randomUUID()}`,
      status: "done",
      variantDone: "club",
    } as never);
    expect(await prisma.sessionLog.count({ where: { scheduledSessionId: saved.id, athleteId: me.athleteId } })).toBe(1);
    const calendar = await getAthleteCalendar(me.userId, me.organizationId, { from: today, to: today });
    expect(calendar.sessions.map((s) => s.id)).toEqual([saved.id]);
  });

  it("sa bibliothèque, ses modèles, ses mesures et ses phases, pour sa seule fiche", async () => {
    const me = await solo("Mesure");
    await updateOrganizationPhases(me.organizationId);
    const other = await makeOrg("Voisin");
    const stranger = await addAthlete(other.organizationId, other.groupId, "Voisin");
    expect((await listTemplates(me.userId, me.organizationId)).length).toBeGreaterThan(0);
    const exercise = await saveExercise(me.userId, me.organizationId, {
      name: "Montées de genoux",
      category: "running_drill",
    });
    expect(exercise).toBeTruthy();
    const test = { exerciseKey: "squat", value: 100, kind: "one_rm" as const, date: todayIso() };
    await addStrengthTest(me.userId, me.organizationId, { ...test, athleteId: me.athleteId });
    expect(await prisma.strengthTest.count({ where: { athleteId: me.athleteId } })).toBe(1);
    await expect(
      addStrengthTest(me.userId, me.organizationId, { ...test, athleteId: stranger.athleteId }),
    ).rejects.toMatchObject({ status: 404 });
    const monday = startOfWeek(todayIso());
    const phase = {
      expectedVersion: 0,
      name: "Préparation",
      kind: "general" as const,
      startDate: monday,
      endDate: addDays(monday, 27),
      objective: "",
      description: "",
      privateNote: "",
    };
    await saveTrainingPhase(me.userId, me.organizationId, {
      ...phase,
      id: randomUUID(),
      target: { type: "athlete", id: me.athleteId },
    });
    expect(await prisma.trainingPhase.count({ where: { organizationId: me.organizationId } })).toBe(1);
    // Une phase pour la fiche d'un autre espace n'existe pas ici.
    await expect(
      saveTrainingPhase(me.userId, me.organizationId, {
        ...phase,
        id: randomUUID(),
        target: { type: "athlete", id: stranger.athleteId },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("le planificateur s'ouvre à ses petits quotas : 5 propositions et 10 minutes de dictée par mois", async () => {
    const me = await solo("Quota");
    const usage = await getPlannerUsage(me.userId, me.organizationId);
    expect(usage.limit).toEqual({ proposals: 5, audioSeconds: 600 });
  });
});

describe("exclusions de l'espace personnel", () => {
  it("aucun e-mail de coach : conseils d'activation, résumé du dimanche, plafond presque atteint", async () => {
    const me = await solo("Courriel");
    await prisma.organization.update({
      where: { id: me.organizationId },
      data: { createdAt: new Date(Date.now() - 1.5 * DAY) },
    });
    await queueActivationEmails(new Date());
    const sunday = addDays(startOfWeek(todayIso()), 6);
    await sendWeeklyDigests(new Date(`${sunday}T17:30:00Z`));
    await queuePlanLimitNotices(new Date());
    const kinds = (
      await prisma.emailOutbox.findMany({ where: { organizationId: me.organizationId }, select: { kind: true } })
    ).map((row) => row.kind);
    expect(kinds.filter((kind) => ["activation", "weekly_digest", "plan_near_limit"].includes(kind))).toEqual([]);
    // Seule sa propre bienvenue lui est parvenue.
    expect(outbox.filter((mail) => mail.to === me.email).map((mail) => mail.subject)).toEqual([
      w.personal.emails.welcome.subject,
    ]);
  });

  it("ni question de la veille, ni chiffre d'espace ou de revenus dans la console", async () => {
    const admin = { email: `admin-stats-${randomUUID().slice(0, 8)}@test.tartan.coach`, userId: randomUUID() };
    await prisma.platformAdmin.create({ data: { email: admin.email } });
    const before = await usageOverview(admin);
    const me = await solo("Chiffres");
    const [exercise] = await prisma.exercise.findMany({ where: { organizationId: me.organizationId }, take: 1 });
    const saved = await saveScheduledSession(
      me.userId,
      me.organizationId,
      sessionFor(exercise!.id, addDays(todayIso(), 1), []),
    );
    await publishSession(me.userId, me.organizationId, saved.id);
    await sendEveQuestions(new Date());
    expect(await prisma.notification.count({ where: { userId: me.userId } })).toBe(0);
    const after = await usageOverview(admin);
    expect(after.spaces).toBe(before.spaces);
    expect(after.paidSpaces).toBe(before.paidSpaces);
    expect(after.funnel).toEqual(before.funnel);
  });
});

const updateOrganizationPhases = (organizationId: string) =>
  prisma.organization.update({ where: { id: organizationId }, data: { phasesEnabled: true } });
