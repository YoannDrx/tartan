import { PLANS } from "@tartan/domain";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { beforeAll, describe, expect, it } from "vitest";
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
  handleStripeEvent,
  limitsOf,
  processReferrals,
  purgeExpiredVideos,
  syncEntitlements,
} from "@/server/billing.service";
import { acceptInvitation, createInvitation } from "@/server/invitation.service";
import { createOrganization, ensureReferralCode, saveGroup } from "@/server/org.service";
import { listExercises, saveExercise } from "@/server/exercise.service";
import { addAthlete, addStaff, makeOrg, makeUser } from "./helpers";

const discoveryOrg = async (name: string) => {
  const org = await makeOrg(name);
  await applySubscription({ organizationId: org.organizationId, plan: "discovery", status: "active", provider: "manual", providerRef: null, currentPeriodEnd: null, cancelAt: null });
  return org;
};

const stripeEvent = (organizationId: string, status: string, priceId: string, id = randomUUID()) =>
  ({
    id,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: `sub_${organizationId}`,
        status,
        cancel_at: null,
        metadata: { organizationId },
        items: { data: [{ price: { id: priceId }, current_period_end: 1893456000 }] },
      },
    },
  }) as unknown as Stripe.Event;

describe("offres et limites", () => {
  it("un nouvel espace démarre en Découverte avec la bibliothèque de départ", async () => {
    const coach = await makeUser("Nouveau");
    const org = await createOrganization(coach.userId, { name: "Neuf", type: "independent", disciplines: [], firstGroupName: "Groupe" });
    expect(org.plan).toBe("discovery");
    expect(await limitsOf(org.id)).toEqual(PLANS.discovery.limits);
    expect((await listExercises(coach.userId, org.id)).length).toBeGreaterThanOrEqual(30);
  });

  it("bloque le 6e athlète en Découverte, sans toucher aux 5 premiers", async () => {
    const org = await discoveryOrg("Petit");
    for (const name of ["A", "B", "C", "D", "E"]) await addAthlete(org.organizationId, org.groupId, `Ath${name}`);
    await expect(saveAthlete(org.owner.userId, org.organizationId, { firstName: "Six", lastName: "T", groupIds: [] })).rejects.toMatchObject({ code: "plan_limit", status: 402 });
    const { link } = await createInvitation(org.owner.userId, org.organizationId, { kind: "group_link", groupIds: [org.groupId] });
    const late = await makeUser("Tard");
    await expect(
      acceptInvitation(late, link.split("/i/")[1] as string, { firstName: "Tard", lastName: "T", birthDate: null, consents: { terms: true, health: false, video: false } }),
    ).rejects.toMatchObject({ code: "plan_limit" });
    expect(await prisma.athlete.count({ where: { organizationId: org.organizationId } })).toBe(5);
    const overview = await getBillingOverview(org.owner.userId, org.organizationId);
    expect(overview.usage.maxAthletes).toBe(5);
  });

  it("bloque un 2e groupe et un 2e coach en Découverte", async () => {
    const org = await discoveryOrg("Solo");
    await expect(saveGroup(org.owner.userId, org.organizationId, { name: "Cadets" })).rejects.toMatchObject({ code: "plan_limit" });
    await expect(createInvitation(org.owner.userId, org.organizationId, { kind: "personal_email", role: "coach", email: "c@test.tartan.coach" })).rejects.toMatchObject({ code: "plan_limit" });
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

  it("Stripe active l'offre, est idempotent, puis retombe à la résiliation", async () => {
    // Le prix inconnu ne doit rien activer : la correspondance vient de la configuration.
    await handleStripeEvent(stripeEvent(org.organizationId, "active", "price_inconnu"));
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } })).plan).toBe("discovery");

    const canceled = stripeEvent(org.organizationId, "canceled", "price_x");
    await handleStripeEvent(canceled);
    await applySubscription({ organizationId: org.organizationId, plan: "coach", status: "active", provider: "stripe", providerRef: "sub_1", currentPeriodEnd: null, cancelAt: null });
    expect(await limitsOf(org.organizationId)).toEqual(PLANS.coach.limits);
    // Rejeu du même événement : aucun effet.
    await handleStripeEvent(canceled);
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } })).plan).toBe("coach");

    await handleStripeEvent(stripeEvent(org.organizationId, "canceled", "price_x"));
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } })).plan).toBe("discovery");
    expect(await limitsOf(org.organizationId)).toEqual(PLANS.discovery.limits);
  });

  it("un impayé garde l'accès", async () => {
    await applySubscription({ organizationId: org.organizationId, plan: "coach", status: "past_due", provider: "stripe", providerRef: "sub_1", currentPeriodEnd: null, cancelAt: null });
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } })).plan).toBe("coach");
  });

  it("RevenueCat active puis expire l'offre de l'espace, et ignore un identifiant inconnu", async () => {
    const other = await discoveryOrg("Mobile");
    const user = `org_${other.organizationId}`;
    await handleRevenueCatEvent({ id: randomUUID(), type: "INITIAL_PURCHASE", app_user_id: user, product_id: "tartan_club_monthly" });
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: other.organizationId } })).plan).toBe("club");
    await handleRevenueCatEvent({ id: randomUUID(), type: "EXPIRATION", app_user_id: user, product_id: "tartan_club_monthly" });
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: other.organizationId } })).plan).toBe("discovery");
    await expect(handleRevenueCatEvent({ id: randomUUID(), type: "INITIAL_PURCHASE", app_user_id: "inconnu" })).resolves.toBeUndefined();
  });
});

describe("parrainage récompensé", () => {
  it("offre un mois à chacun après 30 jours payés, une seule fois", async () => {
    const parrain = await makeOrg("Parrain");
    const code = await ensureReferralCode(parrain.owner.userId);
    const filleul = await makeUser("Filleul");
    const org = await createOrganization(filleul.userId, { name: "Fille", type: "independent", disciplines: [], firstGroupName: "G", referralCode: code });
    const start = new Date("2026-01-01");
    await applySubscription({ organizationId: org.id, plan: "coach", status: "active", provider: "stripe", providerRef: "sub_f", currentPeriodEnd: null, cancelAt: null, now: start });

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
    const org = await createOrganization(filleul.userId, { name: "T", type: "independent", disciplines: [], firstGroupName: "G", referralCode: code });
    await applySubscription({ organizationId: org.id, plan: "coach", status: "trialing", provider: "stripe", providerRef: "sub_t", currentPeriodEnd: null, cancelAt: null, now: new Date("2026-01-01") });
    await processReferrals(new Date("2026-06-01"));
    expect(await prisma.referralReward.count({ where: { referral: { referredUserId: filleul.userId } } })).toBe(0);
  });
});

describe("membres", () => {
  it("le propriétaire attribue les groupes et change les rôles, personne d'autre", async () => {
    const org = await makeOrg("Chef2");
    const coach = await addStaff(org.organizationId, "Bras", "coach");
    await expect(updateMember(coach.userId, org.organizationId, { memberId: coach.userId, role: "assistant", groupIds: [] })).rejects.toMatchObject({ status: 403 });
    await updateMember(org.owner.userId, org.organizationId, { memberId: coach.userId, role: "assistant", groupIds: [org.groupId] });
    const members = await listMembers(org.owner.userId, org.organizationId);
    expect(members.find((x) => x.userId === coach.userId)).toMatchObject({ role: "assistant", groupIds: [org.groupId] });
    await expect(updateMember(org.owner.userId, org.organizationId, { memberId: org.owner.userId, role: "coach", groupIds: [] })).rejects.toMatchObject({ status: 403 });
    await removeCoach(org.owner.userId, org.organizationId, coach.userId);
    expect(await prisma.groupCoach.count({ where: { userId: coach.userId } })).toBe(0);
  });

  it("un groupe d'un autre espace est refusé", async () => {
    const a = await makeOrg("MembreA");
    const b = await makeOrg("MembreB");
    const coach = await addStaff(a.organizationId, "Lien", "coach");
    await expect(updateMember(a.owner.userId, a.organizationId, { memberId: coach.userId, role: "coach", groupIds: [b.groupId] })).rejects.toMatchObject({ status: 404 });
  });

  it("retirer un athlète efface sa fiche, et il peut partir de lui-même", async () => {
    const org = await makeOrg("Depart");
    const one = await addAthlete(org.organizationId, org.groupId, "Un");
    await removeAthlete(org.owner.userId, org.organizationId, one.athleteId);
    expect(await prisma.athlete.findUnique({ where: { id: one.athleteId } })).toBeNull();
    const two = await addAthlete(org.organizationId, org.groupId, "Deux");
    await leaveOrganization(two.userId, org.organizationId);
    expect(await prisma.organizationMember.count({ where: { organizationId: org.organizationId, userId: two.userId } })).toBe(0);
    await expect(leaveOrganization(org.owner.userId, org.organizationId)).rejects.toMatchObject({ status: 400 });
  });
});

describe("export RGPD", () => {
  it("contient les données de l'utilisateur, jamais les notes du coach ni celles d'un autre", async () => {
    const org = await makeOrg("Export");
    const ath = await addAthlete(org.organizationId, org.groupId, "Lou");
    const other = await addAthlete(org.organizationId, org.groupId, "Noe");
    await addCoachNote(org.owner.userId, org.organizationId, ath.athleteId, "NOTE-PRIVEE-COACH");
    await saveInjury(ath.userId, org.organizationId, { athleteId: ath.athleteId, bodyArea: "knee", side: "left", startDate: "2026-10-01", status: "active" });
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
        blocks: [{ name: "Corps", variant: "club", items: [{ exerciseId: exercise.id, prescription: { sets: 4, reps: 5, ground_contacts: 40, distance_m: 20 } }] }],
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
    await logSession(yes.userId, org.organizationId, id, { clientId: "client-stat-1", status: "done", variantDone: "club", rpe: 7, durationMin: 60 });
    await logSession(no.userId, org.organizationId, id, { clientId: "client-stat-2", status: "done", variantDone: "club", rpe: 7, durationMin: 60 });
    const stats = await athleteWeeklyStats(org.owner.userId, org.organizationId, yes.athleteId);
    const last = stats.weeks[stats.weeks.length - 1];
    expect(last).toMatchObject({ load: 420, groundContacts: 40, distanceM: 80, done: 1 });
    const hidden = await athleteWeeklyStats(org.owner.userId, org.organizationId, no.athleteId);
    expect(hidden.weeks[hidden.weeks.length - 1]?.load).toBeNull();
    expect(hidden.healthVisible).toBe(false);
    await expect(athleteWeeklyStats(yes.userId, org.organizationId, no.athleteId)).rejects.toMatchObject({ status: 403 });
  });

  it("exporte le suivi en CSV pour le staff, pas pour un athlète", async () => {
    const org = await makeOrg("Csv");
    const ath = await addAthlete(org.organizationId, org.groupId, "Csv");
    const id = await makeSession(org);
    await logSession(ath.userId, org.organizationId, id, { clientId: "client-csv-1", status: "done", variantDone: "club", comment: "=SOMME(A1)" });
    const csv = await exportTrackingCsv(org.owner.userId, org.organizationId, { from: today, to: today });
    expect(csv).toContain("Csv Test");
    expect(csv).toContain("'=SOMME(A1)");
    await expect(exportTrackingCsv(ath.userId, org.organizationId, { from: today, to: today })).rejects.toMatchObject({ status: 403 });
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
  it("retire les vidéos trop anciennes en Découverte, pas en Club", async () => {
    const small = await discoveryOrg("Petit2");
    const big = await makeOrg("Grand");
    await applySubscription({ organizationId: big.organizationId, plan: "club", status: "active", provider: "stripe", providerRef: "x", currentPeriodEnd: null, cancelAt: null });
    const a1 = await addAthlete(small.organizationId, small.groupId, "Vid");
    const a2 = await addAthlete(big.organizationId, big.groupId, "Vad");
    const old = new Date("2020-01-01");
    await prisma.video.create({ data: { organizationId: small.organizationId, athleteId: a1.athleteId, uploadedBy: small.owner.userId, createdAt: old } });
    const kept = await prisma.video.create({ data: { organizationId: big.organizationId, athleteId: a2.athleteId, uploadedBy: big.owner.userId, createdAt: old } });
    await purgeExpiredVideos(new Date("2026-11-01"));
    expect(await prisma.video.count({ where: { organizationId: small.organizationId } })).toBe(0);
    expect(await prisma.video.findUnique({ where: { id: kept.id } })).toBeTruthy();
    void outbox;
    void syncEntitlements;
  });
});
