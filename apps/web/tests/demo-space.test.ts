import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, DEMO_ATHLETES, DEMO_CONSENT_VERSION, DEMO_SPACE_TTL_DAYS, startOfWeek } from "@tartan/domain";
import { todayIso } from "@/lib/dates";
import { outbox } from "@/lib/mail";
import { deriveToken, sha256 } from "@/lib/tokens";
import { INVITATION_PURPOSE } from "@/server/invitation-email";
import { prisma } from "@/lib/prisma";
import { scrubAnalyticsEvent } from "@/lib/analytics";
import { requireOrgMember } from "@/server/access";
import { deleteAccount } from "@/server/account.service";
import { snapshotPlatformDay, listSpaces as adminListSpaces, usageOverview } from "@/server/admin-console.service";
import { reservePlannerOperation } from "@/server/ai/usage.service";
import { queueInvitationReminders } from "@/server/athlete-email";
import { createCheckout, createPortal, getBillingOverview } from "@/server/billing.service";
import { reportContent } from "@/server/comm.service";
import { closeOverdueSessions, publishScheduledSessions, sendEveQuestions } from "@/server/cron.service";
import { deleteDemoSpace, getDemoSpace, openDemoSpace, purgeExpiredDemoSpaces } from "@/server/demo-space.service";
import { sendWeeklyDigests } from "@/server/digest.service";
import { flushEmailOutbox, queueTrialReminders } from "@/server/email-outbox.service";
import { createExerciseVideoUpload } from "@/server/exercise.service";
import { acceptInvitation, createInvitation, groupInvitationLink } from "@/server/invitation.service";
import { queueActivationEmails } from "@/server/lifecycle-email.service";
import { listSpaces } from "@/server/me.service";
import { notify } from "@/server/notify.service";
import { RETENTION_DAYS, runRetention } from "@/server/retention.service";
import { answerSatisfaction } from "@/server/satisfaction.service";
import { createVideoUpload } from "@/server/video.service";
import { addAthlete, makeOrg } from "./helpers";

// Le planificateur est allumé côté serveur : seule la démonstration doit le couper.
const settings = vi.hoisted(() => ({ AI_PLANNER_ENABLED: "true" }));
vi.mock("@/lib/env", async (original) => {
  const actual = await original<typeof import("@/lib/env")>();
  return { ...actual, env: () => ({ ...actual.env(), ...settings }) };
});

const DAY = 86_400_000;
const demoRefusal = { code: "demo_space", status: 403 };

// Un coach neuf, son espace réel, et sa démonstration ouverte.
const setup = async (name = "Demo") => {
  const real = await makeOrg(name);
  const demo = await openDemoSpace(real.owner.userId, real.organizationId);
  return { real, demo, coach: real.owner };
};

beforeEach(() => {
  outbox.length = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ouverture de l'espace de démonstration", () => {
  it("crée un espace à part, dont le coach est le seul membre, rempli d'athlètes fictifs sans compte", async () => {
    const real = await makeOrg("Demo");
    const coach = real.owner;
    const users = await prisma.user.count();
    const notifications = await prisma.notification.count();
    const mails = await prisma.emailOutbox.count();
    outbox.length = 0;
    const demo = await openDemoSpace(coach.userId, real.organizationId);
    expect(demo.organizationId).not.toBe(real.organizationId);
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: demo.organizationId } });
    expect(org).toMatchObject({
      isDemo: true,
      demoOwnerId: coach.userId,
      ownerId: coach.userId,
      aiPlannerEnabled: false,
    });
    expect(org.demoExpiresAt!.getTime() - Date.now()).toBeGreaterThan((DEMO_SPACE_TTL_DAYS - 1) * DAY);
    expect(org.demoExpiresAt!.getTime() - Date.now()).toBeLessThanOrEqual(DEMO_SPACE_TTL_DAYS * DAY);
    // Aucun compte créé, aucune adresse, aucun abonnement, aucun message.
    expect(await prisma.user.count()).toBe(users);
    expect(await prisma.organizationMember.findMany({ where: { organizationId: demo.organizationId } })).toEqual([
      expect.objectContaining({ userId: coach.userId, role: "owner" }),
    ]);
    const athletes = await prisma.athlete.findMany({ where: { organizationId: demo.organizationId } });
    expect(athletes).toHaveLength(DEMO_ATHLETES.length);
    expect(athletes.every((athlete) => athlete.userId === null)).toBe(true);
    expect(await prisma.subscription.count({ where: { organizationId: demo.organizationId } })).toBe(0);
    expect(await prisma.notification.count()).toBe(notifications);
    expect(await prisma.emailOutbox.count()).toBe(mails);
    expect(outbox).toHaveLength(0);
    // Les accords de santé fictifs sont marqués comme tels.
    const consents = await prisma.athleteConsent.findMany({
      where: { athlete: { organizationId: demo.organizationId } },
    });
    expect(consents.length).toBeGreaterThan(0);
    expect(consents.every((consent) => consent.version === DEMO_CONSENT_VERSION)).toBe(true);
  });

  it("porte des séances passées et à venir, des validations, des ressentis et des phases", async () => {
    const { demo } = await setup("Contenu");
    // Le jour de Paris, comme le service : entre minuit et une heure du matin, le jour UTC est encore la veille.
    const today = new Date(todayIso());
    const sessions = await prisma.scheduledSession.findMany({ where: { organizationId: demo.organizationId } });
    expect(sessions.every((session) => session.publishedAt)).toBe(true);
    expect(sessions.some((session) => session.date < today)).toBe(true);
    expect(sessions.some((session) => session.date > today)).toBe(true);
    const logs = await prisma.sessionLog.findMany({ where: { session: { organizationId: demo.organizationId } } });
    expect(new Set(logs.map((log) => log.status))).toEqual(new Set(["done", "partial", "missed"]));
    expect(logs.some((log) => log.rpe !== null)).toBe(true);
    expect(logs.filter((log) => log.status === "missed").every((log) => log.rpe === null)).toBe(true);
    // Le jour même, une partie du groupe a déjà validé, le reste est à venir.
    const todayIds = sessions.filter((s) => s.date.getTime() === today.getTime()).map((s) => s.id);
    const todayLogs = logs.filter((log) => todayIds.includes(log.scheduledSessionId));
    expect(todayLogs.length).toBeGreaterThan(0);
    expect(todayLogs.every((log) => log.status === "done")).toBe(true);
    expect(
      await prisma.setLog.count({ where: { log: { session: { organizationId: demo.organizationId } } } }),
    ).toBeGreaterThan(0);
    expect(await prisma.trainingPhase.count({ where: { organizationId: demo.organizationId } })).toBe(2);
    expect(await prisma.strengthTest.count({ where: { organizationId: demo.organizationId } })).toBe(
      DEMO_ATHLETES.length * 3,
    );
    expect(await prisma.announcement.count({ where: { organizationId: demo.organizationId } })).toBe(3);
  });

  it("un seul par coach : l'ouvrir à nouveau le remet à zéro", async () => {
    const { real, demo, coach } = await setup("Zero");
    await prisma.announcement.deleteMany({ where: { organizationId: demo.organizationId } });
    const again = await openDemoSpace(coach.userId, real.organizationId);
    expect(again.organizationId).not.toBe(demo.organizationId);
    expect(await prisma.organization.count({ where: { id: demo.organizationId } })).toBe(0);
    expect(await prisma.organization.count({ where: { demoOwnerId: coach.userId } })).toBe(1);
    expect(await prisma.announcement.count({ where: { organizationId: again.organizationId } })).toBe(3);
    // Depuis la démonstration elle-même aussi.
    const third = await openDemoSpace(coach.userId, again.organizationId);
    expect(await prisma.organization.count({ where: { demoOwnerId: coach.userId } })).toBe(1);
    expect(await getDemoSpace(coach.userId, real.organizationId)).toEqual(third);
  });

  it("un athlète n'en ouvre pas, et personne d'autre que le coach n'y entre", async () => {
    const { real, demo } = await setup("Seul");
    const athlete = await addAthlete(real.organizationId, real.groupId, "Reelle");
    await expect(openDemoSpace(athlete.userId, real.organizationId)).rejects.toMatchObject({ status: 403 });
    // Même inscrit à la main, un athlète réel ne lit rien de la démonstration.
    await prisma.organizationMember.create({
      data: { organizationId: demo.organizationId, userId: athlete.userId, role: "athlete", status: "active" },
    });
    await expect(requireOrgMember(athlete.userId, demo.organizationId)).rejects.toMatchObject({ status: 403 });
    const other = await makeOrg("Autre");
    await expect(requireOrgMember(other.owner.userId, demo.organizationId)).rejects.toMatchObject({ status: 403 });
  });

  it("se liste dans la web app après l'espace réel, jamais dans l'API du mobile", async () => {
    const { real, demo, coach } = await setup("Liste");
    const mobile = await listSpaces(coach.userId);
    expect(mobile.map((space) => space.organizationId)).toEqual([real.organizationId]);
    const web = await listSpaces(coach.userId, { includeDemo: true });
    expect(web.map((space) => space.organizationId)).toEqual([real.organizationId, demo.organizationId]);
    expect(web[1]).toMatchObject({ isDemo: true, aiPlannerEnabled: false, aiPlannerUpgrade: false });
    expect(web[1]!.demoExpiresAt).toBe(demo.expiresAt);
  });

  it("se supprime tout de suite, depuis elle ou depuis l'espace réel", async () => {
    const { real, demo, coach } = await setup("Supprime");
    expect(await deleteDemoSpace(coach.userId, demo.organizationId)).toBe(true);
    expect(await prisma.organization.count({ where: { id: demo.organizationId } })).toBe(0);
    expect(await prisma.athlete.count({ where: { organizationId: demo.organizationId } })).toBe(0);
    expect(await deleteDemoSpace(coach.userId, real.organizationId)).toBe(false);
    const again = await openDemoSpace(coach.userId, real.organizationId);
    expect(await deleteDemoSpace(coach.userId, real.organizationId)).toBe(true);
    expect(await prisma.organization.count({ where: { id: again.organizationId } })).toBe(0);
    // L'espace réel ne bouge pas.
    expect(await prisma.organization.count({ where: { id: real.organizationId } })).toBe(1);
  });

  it("part avec le compte du coach", async () => {
    const { demo, coach } = await setup("Compte");
    await deleteAccount(coach.userId);
    expect(await prisma.organization.count({ where: { id: demo.organizationId } })).toBe(0);
  });
});

describe("purge à 14 jours", () => {
  it("la tâche horaire efface les démonstrations échues, pas les autres", async () => {
    const old = await setup("Echue");
    const fresh = await setup("Fraiche");
    await prisma.organization.update({
      where: { id: old.demo.organizationId },
      data: { demoExpiresAt: new Date(Date.now() - 1000) },
    });
    expect(await purgeExpiredDemoSpaces(new Date())).toBeGreaterThanOrEqual(1);
    expect(await prisma.organization.count({ where: { id: old.demo.organizationId } })).toBe(0);
    expect(await prisma.organization.count({ where: { id: fresh.demo.organizationId } })).toBe(1);
    // Quatorze jours plus tard, la seconde part aussi ; les espaces réels restent.
    await purgeExpiredDemoSpaces(new Date(Date.now() + (DEMO_SPACE_TTL_DAYS + 1) * DAY));
    expect(await prisma.organization.count({ where: { id: fresh.demo.organizationId } })).toBe(0);
    expect(await prisma.organization.count({ where: { id: fresh.real.organizationId } })).toBe(1);
  });
});

describe("coupé dans l'espace de démonstration, service par service", () => {
  it("planificateur : refusé, et ni onglet ni invitation à payer", async () => {
    const { real, demo, coach } = await setup("Planif");
    await prisma.organization.update({
      where: { id: real.organizationId },
      data: { aiPlannerEnabled: true, plan: "club" },
    });
    const [mine, demonstration] = await listSpaces(coach.userId, { includeDemo: true });
    expect(mine!.aiPlannerEnabled).toBe(true);
    expect(demonstration).toMatchObject({ aiPlannerEnabled: false, aiPlannerUpgrade: false });
    await expect(
      reservePlannerOperation(coach.userId, demo.organizationId, {
        id: randomUUID(),
        kind: "proposal",
        fingerprint: "a".repeat(64),
      }),
    ).rejects.toThrow(/planificateur/i);
  });

  it("envoi de vidéo : ni vidéo d'athlète ni vidéo d'exercice", async () => {
    const { demo, coach } = await setup("Video");
    const athlete = await prisma.athlete.findFirstOrThrow({ where: { organizationId: demo.organizationId } });
    await expect(createVideoUpload(coach.userId, demo.organizationId, { athleteId: athlete.id })).rejects.toMatchObject(
      demoRefusal,
    );
    const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: demo.organizationId } });
    await expect(createExerciseVideoUpload(coach.userId, demo.organizationId, exercise.id)).rejects.toMatchObject(
      demoRefusal,
    );
  });

  it("invitations : ni lien, ni e-mail, ni rappel, et une invitation forgée n'ouvre rien", async () => {
    const { demo, coach } = await setup("Invit");
    const group = await prisma.group.findFirstOrThrow({ where: { organizationId: demo.organizationId } });
    await expect(groupInvitationLink(coach.userId, demo.organizationId, group.id)).rejects.toMatchObject(demoRefusal);
    await expect(
      createInvitation(coach.userId, demo.organizationId, {
        kind: "personal_email",
        role: "athlete",
        email: "fictif@test.tartan.coach",
        groupIds: [group.id],
      }),
    ).rejects.toMatchObject(demoRefusal);
    // Une invitation nominative restée sans réponse : aucun rappel ne part.
    await prisma.invitation.create({
      data: {
        organizationId: demo.organizationId,
        kind: "personal_email",
        role: "athlete",
        email: "forge@test.tartan.coach",
        groupIds: [group.id],
        tokenHash: randomUUID(),
        status: "sent",
        expiresAt: new Date(Date.now() + 10 * DAY),
        invitedBy: coach.userId,
        updatedAt: new Date(Date.now() - 4 * DAY),
      },
    });
    await queueInvitationReminders();
    expect(await prisma.emailOutbox.count({ where: { organizationId: demo.organizationId } })).toBe(0);
    // Un lien de groupe valide, écrit à la main : un athlète réel ne rejoint pas pour autant.
    const id = randomUUID();
    const token = deriveToken(INVITATION_PURPOSE, id);
    await prisma.invitation.create({
      data: {
        id,
        organizationId: demo.organizationId,
        kind: "group_link",
        role: "athlete",
        groupIds: [group.id],
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 10 * DAY),
        maxUses: 50,
        invitedBy: coach.userId,
      },
    });
    const stranger = await makeOrg("Etranger");
    await expect(
      acceptInvitation({ userId: stranger.owner.userId, email: stranger.owner.email }, token, {
        firstName: "Vraie",
        lastName: "Personne",
        birthDate: null,
        consents: { terms: true, health: false, video: false },
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await prisma.organizationMember.count({ where: { organizationId: demo.organizationId } })).toBe(1);
  });

  it("notifications et push : rien ne s'écrit au nom de la démonstration", async () => {
    const { real, demo, coach } = await setup("Notif");
    await notify([coach.userId], "comment", { athlete: "Léa", organizationId: demo.organizationId, link: "/suivi" });
    expect(await prisma.notification.count({ where: { userId: coach.userId } })).toBe(0);
    await notify([coach.userId], "comment", { athlete: "Léa", organizationId: real.organizationId, link: "/suivi" });
    expect(await prisma.notification.count({ where: { userId: coach.userId } })).toBe(1);
  });

  it("e-mails : la file n'envoie rien pour la démonstration, quel que soit le genre", async () => {
    const { demo, coach } = await setup("Mail");
    outbox.length = 0;
    const row = await prisma.emailOutbox.create({
      data: {
        organizationId: demo.organizationId,
        toEmail: coach.email,
        kind: "plan_near_limit",
        dedupeKey: `demo:${randomUUID()}`,
        payload: { space: "Démo", key: "maxAthletes", used: 4, limit: 5 },
      },
    });
    await flushEmailOutbox(new Date(), { dedupeKey: row.dedupeKey });
    expect(await prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({
      sentAt: null,
      failureCode: "demo_space",
    });
    expect(outbox.filter((mail) => mail.to === coach.email)).toHaveLength(0);
  });

  it("e-mails du cycle de vie : ni conseils d'activation, ni récapitulatif du dimanche", async () => {
    const { demo, coach } = await setup("Cycle");
    await prisma.organization.update({
      where: { id: demo.organizationId },
      data: { createdAt: new Date(Date.now() - 3 * DAY) },
    });
    await queueActivationEmails(new Date());
    expect(await prisma.emailOutbox.count({ where: { organizationId: demo.organizationId } })).toBe(0);
    // Le dimanche de cette semaine, 19 h à Paris : la démonstration y a des séances, le récapitulatif n'en dit rien.
    const sunday = addDays(startOfWeek(todayIso()), 6);
    await sendWeeklyDigests(new Date(`${sunday}T17:30:00Z`));
    expect(
      await prisma.auditLog.count({ where: { organizationId: demo.organizationId, action: "weekly_digest_sent" } }),
    ).toBe(0);
    expect(outbox.filter((mail) => mail.to === coach.email && mail.html.includes(demo.organizationId))).toHaveLength(0);
  });

  it("tâches des séances : ni publication programmée, ni séance manquée, ni question de la veille", async () => {
    const { demo, coach } = await setup("Cron");
    const draft = await prisma.scheduledSession.create({
      data: {
        organizationId: demo.organizationId,
        createdBy: coach.userId,
        date: new Date(Date.now() + DAY),
        title: "Programmée",
        type: "strength",
        draft: {},
        publishAt: new Date(Date.now() - 1000),
      },
    });
    await publishScheduledSessions(new Date());
    expect((await prisma.scheduledSession.findUniqueOrThrow({ where: { id: draft.id } })).publishedAt).toBeNull();
    const logs = await prisma.sessionLog.count({ where: { session: { organizationId: demo.organizationId } } });
    await closeOverdueSessions(new Date());
    await sendEveQuestions(new Date());
    expect(await prisma.sessionLog.count({ where: { session: { organizationId: demo.organizationId } } })).toBe(logs);
    expect(await prisma.notification.count({ where: { userId: coach.userId } })).toBe(0);
  });

  it("facturation : ni offre, ni paiement, ni portail, ni rappel d'essai", async () => {
    const { demo, coach } = await setup("Facture");
    await expect(getBillingOverview(coach.userId, demo.organizationId)).rejects.toMatchObject(demoRefusal);
    await expect(
      createCheckout(coach.userId, demo.organizationId, { plan: "coach", interval: "month" }),
    ).rejects.toMatchObject(demoRefusal);
    await expect(createPortal(coach.userId, demo.organizationId)).rejects.toMatchObject(demoRefusal);
    // Un abonnement ne devrait jamais exister ici ; s'il existait, aucun rappel ne partirait.
    await prisma.subscription.create({
      data: {
        organizationId: demo.organizationId,
        planKey: "coach",
        status: "trialing",
        provider: "stripe",
        providerRef: `sub_demo_${randomUUID()}`,
        trialEndsAt: new Date(Date.now() + 2 * DAY),
      },
    });
    await queueTrialReminders(new Date());
    expect(await prisma.emailOutbox.count({ where: { organizationId: demo.organizationId } })).toBe(0);
  });

  it("statistiques de la plateforme et console : la démonstration n'y entre pas", async () => {
    const { demo } = await setup("Stats");
    await prisma.subscription.create({
      data: {
        organizationId: demo.organizationId,
        planKey: "club",
        status: "active",
        provider: "stripe",
        providerRef: `sub_demo_${randomUUID()}`,
        listMrrCents: 5900,
        discountedMrrCents: 5900,
      },
    });
    const day = new Date();
    const before = await prisma.subscription.count({
      where: {
        provider: { in: ["stripe", "revenuecat"] },
        status: { not: "canceled" },
        organization: { isDemo: false },
      },
    });
    await snapshotPlatformDay(day);
    const stat = await prisma.platformDailyStat.findFirstOrThrow({ orderBy: { day: "desc" } });
    expect(stat.payingOrgs).toBeLessThanOrEqual(before);
    const admin = { email: `admin-demo-${randomUUID().slice(0, 8)}@test.tartan.coach`, userId: randomUUID() };
    await prisma.platformAdmin.create({ data: { email: admin.email } });
    const usage = await usageOverview(admin);
    expect(usage.spaces).toBe(await prisma.organization.count({ where: { isDemo: false, kind: "coach" } }));
    const listed = await adminListSpaces(admin, { q: "Démonstration" });
    expect(JSON.stringify(listed)).not.toContain(demo.organizationId);
  });

  it("analyses d'usage : ni réponse de satisfaction, ni mesure d'audience, ni signalement", async () => {
    const { demo, coach } = await setup("Usage");
    await expect(answerSatisfaction(coach.userId, demo.organizationId, { recommend: true })).rejects.toMatchObject(
      demoRefusal,
    );
    const announcement = await prisma.announcement.findFirstOrThrow({ where: { organizationId: demo.organizationId } });
    await expect(
      reportContent(coach.userId, demo.organizationId, {
        entityType: "announcement",
        entityId: announcement.id,
        reason: "other",
      }),
    ).rejects.toMatchObject(demoRefusal);
    const event = { type: "pageview" as const, url: "https://app.tartan.coach/suivi" };
    expect(scrubAnalyticsEvent(event)).not.toBeNull();
    vi.stubGlobal("document", { querySelector: (selector: string) => (selector === "[data-demo-space]" ? {} : null) });
    expect(scrubAnalyticsEvent(event)).toBeNull();
  });

  it("conservation : ses fiches sans compte suivent la démonstration, pas la purge des fiches réelles", async () => {
    const { real, demo } = await setup("Garde");
    const sheet = await prisma.athlete.create({
      data: { organizationId: real.organizationId, firstName: "Ancienne", lastName: "Fiche" },
    });
    const old = new Date(Date.now() - (RETENTION_DAYS.sheetWithoutAccount + 5) * DAY);
    const ids = (await prisma.athlete.findMany({ where: { organizationId: demo.organizationId } })).map((a) => a.id);
    await prisma.athlete.updateMany({ where: { id: { in: [...ids, sheet.id] } }, data: { updatedAt: old } });
    for (const table of ["session_logs", "attendance", "strength_tests", "coach_notes"]) {
      await prisma.$executeRawUnsafe(
        `UPDATE ${table} SET updated_at = $1 WHERE athlete_id = ANY($2::uuid[])`,
        old,
        ids,
      );
    }
    await runRetention(new Date());
    expect(await prisma.athlete.count({ where: { id: sheet.id } })).toBe(0);
    expect(await prisma.athlete.count({ where: { organizationId: demo.organizationId } })).toBe(DEMO_ATHLETES.length);
  });
});
