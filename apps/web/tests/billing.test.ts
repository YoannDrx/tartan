import { PLANS } from "@tartan/domain";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { addCoachNote, saveAthlete, saveInjury } from "@/server/athlete.service";
import { logSession } from "@/server/athlete-view.service";
import { todayIso } from "@/lib/dates";
import { exportMyData } from "@/server/export.service";
import { icalFeed, icalLink } from "@/server/ical.service";
import { leaveOrganization, listMembers, removeAthlete, removeCoach, updateMember } from "@/server/members.service";
import { publishSession, saveScheduledSession } from "@/server/session.service";
import { athleteWeeklyStats, exportTrackingCsv } from "@/server/stats.service";
import {
  applySubscription,
  getBillingOverview,
  handleRevenueCatEvent,
  limitsOf,
  processReferrals,
  purgeExpiredVideos,
  syncEntitlements,
} from "@/server/billing.service";
import { acceptInvitation, createInvitation } from "@/server/invitation.service";
import { createOrganization, ensureReferralCode, saveGroup } from "@/server/org.service";
import { listExercises, saveExercise } from "@/server/exercise.service";
import { usageOf } from "@/server/billing.service";
import * as mail from "@/lib/mail";
import { addAthlete, addStaff, makeOrg, makeUser } from "./helpers";

const discoveryOrg = async (name: string) => {
  const org = await makeOrg(name);
  await applySubscription({
    organizationId: org.organizationId,
    plan: "discovery",
    status: "active",
    provider: "manual",
    providerRef: null,
    currentPeriodEnd: null,
    cancelAt: null,
  });
  return org;
};

describe("offres et limites", () => {
  it("un nouvel espace démarre en Découverte avec la bibliothèque de départ", async () => {
    const coach = await makeUser("Nouveau");
    const org = await createOrganization(coach.userId, {
      name: "Neuf",
      type: "independent",
      disciplines: [],
      firstGroupName: "Groupe",
    });
    expect(org.plan).toBe("discovery");
    expect(await limitsOf(org.id)).toEqual(PLANS.discovery.limits);
    expect((await listExercises(coach.userId, org.id)).length).toBeGreaterThanOrEqual(30);
  });

  it("bloque le 6e athlète en Découverte, sans toucher aux 5 premiers", async () => {
    const org = await discoveryOrg("Petit");
    for (const name of ["A", "B", "C", "D", "E"]) await addAthlete(org.organizationId, org.groupId, `Ath${name}`);
    await expect(
      saveAthlete(org.owner.userId, org.organizationId, {
        firstName: "Six",
        lastName: "T",
        birthDate: "2000-01-01",
        groupIds: [],
      }),
    ).rejects.toMatchObject({ code: "plan_limit", status: 402 });
    const { link } = await createInvitation(org.owner.userId, org.organizationId, {
      kind: "group_link",
      groupIds: [org.groupId],
    });
    const late = await makeUser("Tard");
    await expect(
      acceptInvitation(late, link.split("/i/")[1] as string, {
        firstName: "Tard",
        lastName: "T",
        birthDate: "2000-01-01",
        consents: { terms: true, health: false, video: false },
      }),
    ).rejects.toMatchObject({ code: "plan_limit" });
    expect(await prisma.athlete.count({ where: { organizationId: org.organizationId } })).toBe(5);
    const overview = await getBillingOverview(org.owner.userId, org.organizationId);
    expect(overview.usage.maxAthletes).toBe(5);
  });

  it("bloque un 2e groupe et un 2e coach en Découverte", async () => {
    const org = await discoveryOrg("Solo");
    await expect(saveGroup(org.owner.userId, org.organizationId, { name: "Cadets" })).rejects.toMatchObject({
      code: "plan_limit",
    });
    await expect(
      createInvitation(org.owner.userId, org.organizationId, {
        kind: "personal_email",
        role: "coach",
        email: "c@test.tartan.coach",
      }),
    ).rejects.toMatchObject({ code: "plan_limit" });
  });

  it("seul le propriétaire gère l'abonnement", async () => {
    const org = await makeOrg("Chef");
    const coach = await addStaff(org.organizationId, "Second", "coach", [org.groupId]);
    const overview = await getBillingOverview(coach.userId, org.organizationId);
    expect(overview.canManage).toBe(false);
    const ath = await addAthlete(org.organizationId, org.groupId, "Ana");
    await expect(getBillingOverview(ath.userId, org.organizationId)).rejects.toMatchObject({ status: 403 });
  });
});

describe("webhooks", () => {
  let org: Awaited<ReturnType<typeof makeOrg>>;
  beforeAll(async () => {
    process.env.STRIPE_PRICE_COACH_MONTH = "price_coach_m";
    org = await discoveryOrg("Payeur");
  });

  it("un impayé garde l'accès", async () => {
    await applySubscription({
      organizationId: org.organizationId,
      plan: "coach",
      status: "past_due",
      provider: "stripe",
      providerRef: "sub_1",
      currentPeriodEnd: null,
      cancelAt: null,
    });
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } })).plan).toBe("coach");
  });

  it("RevenueCat active puis expire l'offre de l'espace, et ignore un identifiant inconnu", async () => {
    const other = await discoveryOrg("Mobile");
    const user = `org_${other.organizationId}`;
    await handleRevenueCatEvent({
      id: randomUUID(),
      type: "INITIAL_PURCHASE",
      app_user_id: user,
      product_id: "tartan_club_monthly",
    });
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: other.organizationId } })).plan).toBe("club");
    await handleRevenueCatEvent({
      id: randomUUID(),
      type: "EXPIRATION",
      app_user_id: user,
      product_id: "tartan_club_monthly",
    });
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: other.organizationId } })).plan).toBe(
      "discovery",
    );
    await expect(
      handleRevenueCatEvent({ id: randomUUID(), type: "INITIAL_PURCHASE", app_user_id: "inconnu" }),
    ).resolves.toBeUndefined();
  });
});

describe("parrainage récompensé", () => {
  it("offre un mois à chacun après 30 jours payés, une seule fois", async () => {
    const parrain = await makeOrg("Parrain");
    const code = await ensureReferralCode(parrain.owner.userId);
    const filleul = await makeUser("Filleul");
    const org = await createOrganization(filleul.userId, {
      name: "Fille",
      type: "independent",
      disciplines: [],
      firstGroupName: "G",
      referralCode: code,
    });
    const start = new Date("2026-01-01");
    await applySubscription({
      organizationId: org.id,
      plan: "coach",
      status: "active",
      provider: "stripe",
      providerRef: "sub_f",
      currentPeriodEnd: null,
      cancelAt: null,
      now: start,
    });

    await processReferrals(new Date("2026-01-20"));
    expect(await prisma.referralReward.count({ where: { referral: { referredUserId: filleul.userId } } })).toBe(0);

    await processReferrals(new Date("2026-02-15"));
    const rewards = await prisma.referralReward.findMany({ where: { referral: { referredUserId: filleul.userId } } });
    expect(rewards.map((r) => r.beneficiaryId).sort()).toEqual([parrain.owner.userId, filleul.userId].sort());

    await processReferrals(new Date("2026-03-15"));
    expect(await prisma.referralReward.count({ where: { referral: { referredUserId: filleul.userId } } })).toBe(2);
  });

  it("un filleul seulement en essai ne qualifie rien", async () => {
    const parrain = await makeOrg("Essai");
    const code = await ensureReferralCode(parrain.owner.userId);
    const filleul = await makeUser("Testeur");
    const org = await createOrganization(filleul.userId, {
      name: "T",
      type: "independent",
      disciplines: [],
      firstGroupName: "G",
      referralCode: code,
    });
    await applySubscription({
      organizationId: org.id,
      plan: "coach",
      status: "trialing",
      provider: "stripe",
      providerRef: "sub_t",
      currentPeriodEnd: null,
      cancelAt: null,
      now: new Date("2026-01-01"),
    });
    await processReferrals(new Date("2026-06-01"));
    expect(await prisma.referralReward.count({ where: { referral: { referredUserId: filleul.userId } } })).toBe(0);
  });
});

describe("membres", () => {
  it("le propriétaire attribue les groupes et change les rôles, personne d'autre", async () => {
    const org = await makeOrg("Chef2");
    const coach = await addStaff(org.organizationId, "Bras", "coach");
    await expect(
      updateMember(coach.userId, org.organizationId, { memberId: coach.userId, role: "assistant", groupIds: [] }),
    ).rejects.toMatchObject({ status: 403 });
    await updateMember(org.owner.userId, org.organizationId, {
      memberId: coach.userId,
      role: "assistant",
      groupIds: [org.groupId],
    });
    const members = await listMembers(org.owner.userId, org.organizationId);
    expect(members.find((x) => x.userId === coach.userId)).toMatchObject({
      role: "assistant",
      groupIds: [org.groupId],
    });
    await expect(
      updateMember(org.owner.userId, org.organizationId, { memberId: org.owner.userId, role: "coach", groupIds: [] }),
    ).rejects.toMatchObject({ status: 403 });
    await removeCoach(org.owner.userId, org.organizationId, coach.userId);
    expect(await prisma.groupCoach.count({ where: { userId: coach.userId } })).toBe(0);
  });

  it("un groupe d'un autre espace est refusé", async () => {
    const a = await makeOrg("MembreA");
    const b = await makeOrg("MembreB");
    const coach = await addStaff(a.organizationId, "Lien", "coach");
    await expect(
      updateMember(a.owner.userId, a.organizationId, { memberId: coach.userId, role: "coach", groupIds: [b.groupId] }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("retirer un athlète efface sa fiche, et il peut partir de lui-même", async () => {
    const org = await makeOrg("Depart");
    const one = await addAthlete(org.organizationId, org.groupId, "Un");
    await removeAthlete(org.owner.userId, org.organizationId, one.athleteId);
    expect(await prisma.athlete.findUnique({ where: { id: one.athleteId } })).toBeNull();
    const two = await addAthlete(org.organizationId, org.groupId, "Deux");
    await leaveOrganization(two.userId, org.organizationId);
    expect(
      await prisma.organizationMember.count({ where: { organizationId: org.organizationId, userId: two.userId } }),
    ).toBe(0);
    await expect(leaveOrganization(org.owner.userId, org.organizationId)).rejects.toMatchObject({ status: 400 });
  });
});

describe("export RGPD", () => {
  it("contient les données de l'utilisateur, jamais les notes du coach ni celles d'un autre", async () => {
    const org = await makeOrg("Export");
    const ath = await addAthlete(org.organizationId, org.groupId, "Lou");
    const other = await addAthlete(org.organizationId, org.groupId, "Noe");
    await addCoachNote(org.owner.userId, org.organizationId, ath.athleteId, "NOTE-PRIVEE-COACH");
    await saveInjury(ath.userId, org.organizationId, {
      athleteId: ath.athleteId,
      bodyArea: "knee",
      side: "left",
      startDate: "2026-10-01",
      status: "active",
    });
    const data = await exportMyData(ath.userId);
    const text = JSON.stringify(data);
    expect(text).toContain(ath.email);
    expect(text).toContain("knee");
    expect(text).not.toContain("NOTE-PRIVEE-COACH");
    expect(text).not.toContain(other.email);
    expect(await prisma.auditLog.count({ where: { actorId: ath.userId, action: "data_exported" } })).toBe(1);
  });
});

describe("statistiques et agenda", () => {
  const today = todayIso();
  const makeSession = async (org: Awaited<ReturnType<typeof makeOrg>>) => {
    const exercise = await saveExercise(org.owner.userId, org.organizationId, { name: "Bonds", category: "plyo" });
    const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
      date: today,
      startTime: "18:00",
      location: "Stade, piste 1",
      draft: {
        title: "Plio",
        type: "plyo",
        durationMin: 60,
        coachNote: null,
        blocks: [
          {
            name: "Corps",
            variant: "club",
            items: [
              { exerciseId: exercise.id, prescription: { sets: 4, reps: 5, ground_contacts: 40, distance_m: 20 } },
            ],
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

  it("calcule charge et volumes de la semaine, et masque la charge sans accord santé", async () => {
    const org = await makeOrg("Stats");
    const yes = await addAthlete(org.organizationId, org.groupId, "Oui");
    const no = await addAthlete(org.organizationId, org.groupId, "Non", { health: false });
    const id = await makeSession(org);
    await logSession(yes.userId, org.organizationId, id, {
      clientId: "client-stat-1",
      status: "done",
      variantDone: "club",
      rpe: 7,
      durationMin: 60,
    });
    await logSession(no.userId, org.organizationId, id, {
      clientId: "client-stat-2",
      status: "done",
      variantDone: "club",
      rpe: 7,
      durationMin: 60,
    });
    const stats = await athleteWeeklyStats(org.owner.userId, org.organizationId, yes.athleteId);
    const last = stats.weeks[stats.weeks.length - 1];
    expect(last).toMatchObject({ load: 420, groundContacts: 40, distanceM: 80, done: 1 });
    const hidden = await athleteWeeklyStats(org.owner.userId, org.organizationId, no.athleteId);
    expect(hidden.weeks[hidden.weeks.length - 1]?.load).toBeNull();
    expect(hidden.healthVisible).toBe(false);
    await expect(athleteWeeklyStats(yes.userId, org.organizationId, no.athleteId)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("exporte le suivi en CSV pour le staff, pas pour un athlète", async () => {
    const org = await makeOrg("Csv");
    const ath = await addAthlete(org.organizationId, org.groupId, "Csv");
    const id = await makeSession(org);
    await logSession(ath.userId, org.organizationId, id, {
      clientId: "client-csv-1",
      status: "done",
      variantDone: "club",
      comment: "=SOMME(A1)",
    });
    const csv = await exportTrackingCsv(org.owner.userId, org.organizationId, { from: today, to: today });
    expect(csv).toContain("Csv Test");
    expect(csv).toContain("'=SOMME(A1)");
    await expect(exportTrackingCsv(ath.userId, org.organizationId, { from: today, to: today })).rejects.toMatchObject({
      status: 403,
    });
  });

  it("sert l'agenda avec un lien signé, et refuse un lien forgé", async () => {
    const org = await makeOrg("Ical");
    const ath = await addAthlete(org.organizationId, org.groupId, "Cal");
    await makeSession(org);
    const link = await icalLink(ath.userId, org.organizationId);
    const token = link.split("/").pop() as string;
    const feed = await icalFeed(ath.athleteId, token);
    expect(feed).toContain("SUMMARY:Plio");
    expect(feed).toContain("LOCATION:Stade\\, piste 1");
    await expect(icalFeed(ath.athleteId, "faux")).rejects.toMatchObject({ status: 404 });
  });
});

describe("conservation vidéo", () => {
  it("retire les vidéos trop anciennes après un préavis, selon la durée de l'offre", async () => {
    const small = await discoveryOrg("Petit2");
    const big = await makeOrg("Grand");
    await applySubscription({
      organizationId: big.organizationId,
      plan: "club",
      status: "active",
      provider: "stripe",
      providerRef: "x",
      currentPeriodEnd: null,
      cancelAt: null,
    });
    const a1 = await addAthlete(small.organizationId, small.groupId, "Vid");
    const a2 = await addAthlete(big.organizationId, big.groupId, "Vad");
    const old = new Date("2020-01-01");
    const recent = new Date("2026-01-01");
    await prisma.video.create({
      data: {
        organizationId: small.organizationId,
        athleteId: a1.athleteId,
        uploadedBy: small.owner.userId,
        createdAt: old,
      },
    });
    const kept = await prisma.video.create({
      data: {
        organizationId: big.organizationId,
        athleteId: a2.athleteId,
        uploadedBy: big.owner.userId,
        createdAt: recent,
      },
    });
    // Premier passage : le préavis part, rien n'est retiré.
    await purgeExpiredVideos(new Date("2026-11-01"));
    expect(await prisma.video.count({ where: { organizationId: small.organizationId } })).toBe(1);
    expect(outbox.some((mail) => mail.subject.includes("bientôt supprimée"))).toBe(true);
    // Préavis écoulé : la vidéo part, celle de l'offre Club, encore dans sa durée, reste.
    await purgeExpiredVideos(new Date("2026-11-16"));
    expect(await prisma.video.count({ where: { organizationId: small.organizationId } })).toBe(0);
    expect(await prisma.video.findUnique({ where: { id: kept.id } })).toBeTruthy();
    void syncEntitlements;
  });
});

describe("quotas vidéo", () => {
  const NOW = new Date("2030-06-15T12:00:00Z");
  const prepare = async () => {
    const org = await makeOrg("Quota");
    const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: org.organizationId } });
    const athlete = await addAthlete(org.organizationId, org.groupId, "Léa");
    return { org, exercise, athlete };
  };
  const uploaded = (exerciseId: string, createdAt: Date, muxAssetId: string | null) =>
    prisma.exerciseMedia.create({ data: { exerciseId, kind: "upload", createdAt, muxAssetId } });

  it("une démonstration d'exercice compte dans le quota du mois", async () => {
    const { org, exercise } = await prepare();
    await uploaded(exercise.id, new Date("2030-06-14T12:00:00Z"), "asset-1");
    expect((await usageOf(org.organizationId, NOW)).maxVideosPerMonth).toBe(1);
  });
  it("un envoi abandonné depuis plus de 24 h ne compte plus", async () => {
    const { org, exercise, athlete } = await prepare();
    await uploaded(exercise.id, new Date("2030-06-14T11:00:00Z"), null);
    await uploaded(exercise.id, new Date("2030-06-15T11:00:00Z"), null);
    await prisma.video.create({
      data: {
        organizationId: org.organizationId,
        athleteId: athlete.athleteId,
        uploadedBy: org.owner.userId,
        createdAt: new Date("2030-06-13T11:00:00Z"),
      },
    });
    expect((await usageOf(org.organizationId, NOW)).maxVideosPerMonth).toBe(1);
  });
});

describe("préavis de purge", () => {
  const DAY = 86_400_000;
  const NOW = new Date("2030-06-15T12:00:00Z");
  const ago = (days: number, from = NOW) => new Date(from.getTime() - days * DAY);
  const prepare = async () => {
    const org = await makeOrg("Purge");
    await prisma.organization.update({ where: { id: org.organizationId }, data: { plan: "discovery" } });
    const athlete = await addAthlete(org.organizationId, org.groupId, "Léa");
    const video = (createdAt: Date) =>
      prisma.video.create({
        data: {
          organizationId: org.organizationId,
          athleteId: athlete.athleteId,
          uploadedBy: org.owner.userId,
          createdAt,
        },
      });
    const mails = () => outbox.filter((entry) => entry.to === org.owner.email && entry.subject.includes("supprimée"));
    return { ...org, video, mails };
  };
  it("un envoi échoué n'écrit rien, et rien n'est supprimé 30 jours plus tard", async () => {
    const a = await prepare();
    const v = await a.video(ago(40));
    const send = vi.spyOn(mail, "sendEmail").mockRejectedValue(new Error("email_failed"));
    await purgeExpiredVideos(NOW);
    expect((await prisma.video.findUniqueOrThrow({ where: { id: v.id } })).purgeNoticeAt).toBeNull();
    await purgeExpiredVideos(new Date(NOW.getTime() + 30 * DAY));
    expect(await prisma.video.count({ where: { id: v.id } })).toBe(1);
    send.mockRestore();
  });
  it("une vidéo entrée dans la fenêtre après un préavis reçoit le sien avant d'être supprimée", async () => {
    const a = await prepare();
    const first = await a.video(ago(40));
    await purgeExpiredVideos(NOW);
    expect(a.mails()).toHaveLength(1);
    const later = await a.video(ago(35));
    await prisma.video.update({ where: { id: later.id }, data: { createdAt: ago(35) } });
    // Une semaine plus tard : second mail, pour elle seule.
    const week = new Date(NOW.getTime() + 8 * DAY);
    await purgeExpiredVideos(week);
    expect(a.mails()).toHaveLength(2);
    // 14 jours après le premier préavis : la première part, la seconde attend son propre délai.
    const after = new Date(NOW.getTime() + 15 * DAY);
    await purgeExpiredVideos(after);
    expect(await prisma.video.count({ where: { id: first.id } })).toBe(0);
    expect(await prisma.video.count({ where: { id: later.id } })).toBe(1);
  });
  it("deux ajouts à un jour d'écart donnent un seul mail", async () => {
    const a = await prepare();
    await a.video(ago(40));
    await purgeExpiredVideos(NOW);
    await a.video(ago(39));
    await purgeExpiredVideos(new Date(NOW.getTime() + DAY));
    expect(a.mails()).toHaveLength(1);
  });
  it("le mail donne le nombre et les dates", async () => {
    const a = await prepare();
    await a.video(ago(40));
    await a.video(ago(39));
    await purgeExpiredVideos(NOW);
    const [sent] = a.mails();
    expect(sent!.subject).toContain("2 vidéos");
    expect(sent!.html).toContain("29 juin 2030");
  });
  it("un retour en Découverte remet le préavis à zéro", async () => {
    const a = await prepare();
    const v = await a.video(ago(40));
    await purgeExpiredVideos(NOW);
    expect((await prisma.video.findUniqueOrThrow({ where: { id: v.id } })).purgeNoticeAt).not.toBeNull();
    await applySubscription({
      organizationId: a.organizationId,
      plan: "coach",
      status: "active",
      provider: "stripe",
      providerRef: "sub_purge",
      currentPeriodEnd: null,
      cancelAt: null,
    });
    expect((await prisma.video.findUniqueOrThrow({ where: { id: v.id } })).purgeNoticeAt).toBeNull();
  });
  it("une offre sans limite ne reçoit rien et ne perd rien", async () => {
    const a = await prepare();
    await prisma.organization.update({ where: { id: a.organizationId }, data: { plan: "pilot" } });
    const v = await a.video(ago(4000));
    await purgeExpiredVideos(NOW);
    expect(a.mails()).toHaveLength(0);
    expect(await prisma.video.count({ where: { id: v.id } })).toBe(1);
  });
});
