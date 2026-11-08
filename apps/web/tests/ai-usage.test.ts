import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  completePlannerOperation,
  expirePlannerOperations,
  failPlannerOperation,
  reservePlannerOperation,
} from "@/server/ai/usage.service";
import { addStaff, makeOrg } from "./helpers";
const settings = vi.hoisted(() => ({ AI_PLANNER_ENABLED: "true" }));
vi.mock("@/lib/env", async (original) => {
  const actual = await original<typeof import("@/lib/env")>();
  return { ...actual, env: () => ({ ...actual.env(), ...settings }) };
});
const now = new Date("2030-06-15T12:00:00Z");
const proposal = (id = randomUUID()) => ({ id, kind: "proposal" as const, fingerprint: "a".repeat(64) });
const result = { proposalId: randomUUID(), version: 1 };
const later = new Date(now.getTime() + 6 * 60000);
const qwhere = (organizationId: string, month = "2030-06") => ({ organizationId_month: { organizationId, month } });
beforeEach(() => {
  settings.AI_PLANNER_ENABLED = "true";
});
async function setup() {
  const a = await makeOrg("QuotaIA");
  await prisma.organization.update({
    where: { id: a.organizationId },
    data: { aiPlannerEnabled: true, plan: "coach" },
  });
  const reserve = (input = proposal(), at = now) =>
    reservePlannerOperation(a.owner.userId, a.organizationId, input, at);
  return { ...a, reserve };
}
it("réserve une fois sous concurrence, retrouve la réponse perdue et enregistre le résultat une seule fois", async () => {
  const a = await setup(),
    input = proposal();
  const claims = await Promise.all([a.reserve(input), a.reserve(input)]);
  expect(claims.map((c) => c.state).sort()).toEqual(["claimed", "pending"]);
  const claimed = claims.find((c) => c.state === "claimed")!;
  if (claimed.state !== "claimed") throw new Error("claim missing");
  const save = vi.fn(async (tx: Parameters<Parameters<typeof completePlannerOperation>[4]>[0]) => {
    await tx.organization.update({ where: { id: a.organizationId }, data: { name: "Résultat enregistré" } });
    return result;
  });
  const complete = () =>
    completePlannerOperation(a.owner.userId, a.organizationId, input.id, claimed.leaseToken, save, now);
  const completed = await Promise.all([complete(), complete()]);
  expect(completed).toEqual([
    { state: "succeeded", result },
    { state: "succeeded", result },
  ]);
  expect(save).toHaveBeenCalledTimes(1);
  expect(await a.reserve(input)).toEqual({ state: "succeeded", result });
  expect(await prisma.aiPlannerQuota.findUniqueOrThrow({ where: qwhere(a.organizationId) })).toMatchObject({
    reservedProposals: 0,
    usedProposals: 1,
  });
  await expect(a.reserve({ ...input, fingerprint: "b".repeat(64) })).rejects.toMatchObject({ status: 409 });
});
it("n’accorde qu’une seule dernière proposition disponible à deux requêtes distinctes", async () => {
  const a = await setup();
  await prisma.aiPlannerQuota.create({
    data: { organizationId: a.organizationId, month: "2030-06", usedProposals: 29 },
  });
  const attempts = await Promise.allSettled([a.reserve(), a.reserve()]);
  expect(attempts.filter((v) => v.status === "fulfilled")).toHaveLength(1);
  expect(attempts.find((v) => v.status === "rejected")).toMatchObject({ reason: { status: 429 } });
  expect(await prisma.aiPlannerQuota.findUniqueOrThrow({ where: qwhere(a.organizationId) })).toMatchObject({
    reservedProposals: 1,
    usedProposals: 29,
  });
});
it("réserve les secondes audio séparément et refuse de changer la durée au rejeu", async () => {
  const a = await setup();
  await prisma.aiPlannerQuota.create({
    data: { organizationId: a.organizationId, month: "2030-06", usedAudioSeconds: 3599 },
  });
  const input = { id: randomUUID(), kind: "transcription" as const, fingerprint: "a".repeat(64), audioSeconds: 1 };
  const reserve = (value = input) => reservePlannerOperation(a.owner.userId, a.organizationId, value, now);
  expect((await reserve()).state).toBe("claimed");
  await expect(reserve({ ...input, id: randomUUID() })).rejects.toMatchObject({ status: 429 });
  await expect(reserve({ ...input, audioSeconds: 2 })).rejects.toMatchObject({ status: 409 });
  expect(await prisma.aiPlannerQuota.findUniqueOrThrow({ where: qwhere(a.organizationId) })).toMatchObject({
    usedProposals: 0,
    reservedAudioSeconds: 1,
  });
});
it("rembourse une seule fois après échec et interdit un résultat tardif", async () => {
  const a = await setup(),
    input = proposal(),
    claim = await a.reserve(input);
  if (claim.state !== "claimed") throw new Error("claim missing");
  const fail = () => failPlannerOperation(a.owner.userId, a.organizationId, input.id, claim.leaseToken);
  await Promise.all([fail(), fail()]);
  const save = vi.fn(async () => result);
  expect(
    await completePlannerOperation(a.owner.userId, a.organizationId, input.id, claim.leaseToken, save, now),
  ).toEqual({ state: "refunded" });
  expect(save).not.toHaveBeenCalled();
  expect(await a.reserve(input)).toEqual({ state: "refunded" });
  expect(await prisma.aiPlannerQuota.findUniqueOrThrow({ where: qwhere(a.organizationId) })).toMatchObject({
    reservedProposals: 0,
    usedProposals: 0,
  });
});
it("restitue une réservation perdue après panne, même IA désactivée, sans retraitement fournisseur", async () => {
  const a = await setup(),
    input = proposal();
  await a.reserve(input);
  settings.AI_PLANNER_ENABLED = "false";
  const counts = await Promise.all([expirePlannerOperations(later), expirePlannerOperations(later)]);
  expect(counts.reduce((sum, c) => sum + c.refunded, 0)).toBeGreaterThanOrEqual(1);
  expect(await prisma.aiPlannerQuota.findUniqueOrThrow({ where: qwhere(a.organizationId) })).toMatchObject({
    reservedProposals: 0,
    usedProposals: 0,
  });
  settings.AI_PLANNER_ENABLED = "true";
  expect(await a.reserve(input, later)).toEqual({ state: "refunded" });
});
it("un échec SQL du résultat annule aussi sa consommation", async () => {
  const a = await setup(),
    input = proposal(),
    claim = await a.reserve(input);
  if (claim.state !== "claimed") throw new Error("claim missing");
  await expect(
    completePlannerOperation(
      a.owner.userId,
      a.organizationId,
      input.id,
      claim.leaseToken,
      async (tx) => {
        await tx.organization.update({ where: { id: a.organizationId }, data: { name: "Ne doit pas persister" } });
        throw new Error("write_failed");
      },
      now,
    ),
  ).rejects.toThrow("write_failed");
  expect((await prisma.organization.findUniqueOrThrow({ where: { id: a.organizationId } })).name).not.toBe(
    "Ne doit pas persister",
  );
  expect(await prisma.aiPlannerQuota.findUniqueOrThrow({ where: qwhere(a.organizationId) })).toMatchObject({
    reservedProposals: 1,
    usedProposals: 0,
  });
  await failPlannerOperation(a.owner.userId, a.organizationId, input.id, claim.leaseToken);
});
it("recontrôle espace, auteur, révocation et drapeaux avant la réservation ou l’enregistrement", async () => {
  const a = await setup(),
    input = proposal(),
    claim = await a.reserve(input);
  if (claim.state !== "claimed") throw new Error("claim missing");
  const coach = await addStaff(a.organizationId, "AutreCoach", "coach", [a.groupId]);
  await expect(reservePlannerOperation(coach.userId, a.organizationId, input, now)).rejects.toMatchObject({
    status: 403,
  });
  const save = vi.fn(async () => result);
  await expect(
    completePlannerOperation(coach.userId, a.organizationId, input.id, claim.leaseToken, save, now),
  ).rejects.toMatchObject({ status: 403 });
  settings.AI_PLANNER_ENABLED = "false";
  expect(
    await completePlannerOperation(a.owner.userId, a.organizationId, input.id, claim.leaseToken, save, now),
  ).toEqual({ state: "refunded" });
  expect(save).not.toHaveBeenCalled();
  await expect(a.reserve()).rejects.toMatchObject({ code: "planner_disabled" });
  settings.AI_PLANNER_ENABLED = "true";
  await prisma.organization.update({ where: { id: a.organizationId }, data: { aiPlannerEnabled: false } });
  await expect(a.reserve()).rejects.toMatchObject({ code: "planner_disabled" });
  await prisma.organization.update({ where: { id: a.organizationId }, data: { aiPlannerEnabled: true } });
  await prisma.organizationMember.update({
    where: { organizationId_userId: { organizationId: a.organizationId, userId: a.owner.userId } },
    data: { status: "suspended" },
  });
  await expect(a.reserve()).rejects.toMatchObject({ status: 403 });
});
it("utilise le mois civil de l’espace et ne déplace pas la consommation au mois de réponse", async () => {
  const a = await setup(),
    input = proposal();
  const boundary = new Date("2030-06-30T22:30:00Z");
  const claim = await a.reserve(input, boundary);
  if (claim.state !== "claimed") throw new Error("claim missing");
  expect(await prisma.aiPlannerQuota.findUniqueOrThrow({ where: qwhere(a.organizationId, "2030-07") })).toMatchObject({
    reservedProposals: 1,
  });
  await completePlannerOperation(
    a.owner.userId,
    a.organizationId,
    input.id,
    claim.leaseToken,
    async () => result,
    boundary,
  );
  expect(await prisma.aiPlannerQuota.findUniqueOrThrow({ where: qwhere(a.organizationId, "2030-07") })).toMatchObject({
    reservedProposals: 0,
    usedProposals: 1,
  });
});

it("une nouvelle requête récupère le quota d’un bail expiré sans attendre le cron", async () => {
  const a = await setup(),
    input = proposal(),
    claim = await a.reserve(input);
  if (claim.state !== "claimed") throw new Error("claim missing");
  await prisma.aiPlannerQuota.update({ where: qwhere(a.organizationId), data: { usedProposals: 29 } });
  expect((await a.reserve(proposal(), later)).state).toBe("claimed");
  const save = vi.fn(async () => result);
  expect(
    await completePlannerOperation(a.owner.userId, a.organizationId, input.id, claim.leaseToken, save, later),
  ).toEqual({ state: "refunded" });
  expect(save).not.toHaveBeenCalled();
  expect(await prisma.aiPlannerQuota.findUniqueOrThrow({ where: qwhere(a.organizationId) })).toMatchObject({
    reservedProposals: 1,
    usedProposals: 29,
  });
});

it("une réponse après expiration ou désactivation ne consomme rien, et un autre bail ne peut pas confirmer", async () => {
  const a = await setup(),
    input = proposal(),
    claim = await a.reserve(input);
  if (claim.state !== "claimed") throw new Error("claim missing");
  const save = vi.fn(async () => result);
  await expect(
    completePlannerOperation(a.owner.userId, a.organizationId, input.id, randomUUID(), save, now),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    await completePlannerOperation(a.owner.userId, a.organizationId, input.id, claim.leaseToken, save, later),
  ).toEqual({ state: "refunded" });
  expect(save).not.toHaveBeenCalled();
  expect(await prisma.aiPlannerQuota.findUniqueOrThrow({ where: qwhere(a.organizationId) })).toMatchObject({
    reservedProposals: 0,
    usedProposals: 0,
  });
});

it.each([
  ["pilot", 30],
  ["club", 150],
] as const)("respecte le plafond %s partagé entre coachs", async (plan, limit) => {
  const a = await setup();
  await prisma.organization.update({ where: { id: a.organizationId }, data: { plan } });
  await prisma.aiPlannerQuota.create({
    data: { organizationId: a.organizationId, month: "2030-06", usedProposals: limit - 1 },
  });
  await a.reserve();
  const coach = await addStaff(a.organizationId, "CoachLimite", "coach", [a.groupId]);
  await expect(reservePlannerOperation(coach.userId, a.organizationId, proposal(), now)).rejects.toMatchObject({
    status: 429,
  });
});

it("Découverte ne réserve rien et le départ d’un coach n’empêche pas le remboursement de son bail", async () => {
  const a = await setup();
  await prisma.organization.update({ where: { id: a.organizationId }, data: { plan: "discovery" } });
  await expect(a.reserve()).rejects.toMatchObject({ code: "planner_disabled" });
  expect(await prisma.aiPlannerQuota.count({ where: { organizationId: a.organizationId } })).toBe(0);
  await prisma.organization.update({ where: { id: a.organizationId }, data: { plan: "coach" } });
  const coach = await addStaff(a.organizationId, "CoachPartant", "coach", [a.groupId]);
  const input = proposal();
  await reservePlannerOperation(coach.userId, a.organizationId, input, now);
  await prisma.user.delete({ where: { id: coach.userId } });
  expect(
    await prisma.aiPlannerOperation.findUniqueOrThrow({
      where: { organizationId_id: { organizationId: a.organizationId, id: input.id } },
    }),
  ).toMatchObject({ actorId: null });
  await expirePlannerOperations(later);
  expect(await prisma.aiPlannerQuota.findUniqueOrThrow({ where: qwhere(a.organizationId) })).toMatchObject({
    reservedProposals: 0,
    usedProposals: 0,
  });
});

it("borne les traitements simultanés sous verrou et laisse relire une opération existante", async () => {
  const a = await setup();
  const inputs = Array.from({ length: 5 }, () => proposal());
  const attempts = await Promise.allSettled(inputs.map((input) => a.reserve(input)));
  expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  expect(attempts.filter((r) => r.status === "rejected")).toHaveLength(2);
  for (const r of attempts.filter((r) => r.status === "rejected"))
    expect(r.reason).toMatchObject({ status: 429, code: "planner_rate_limited" });
  const index = attempts.findIndex((r) => r.status === "fulfilled");
  expect(await a.reserve(inputs[index]!)).toEqual({ state: "pending" });
  // Les expirations libèrent simultanément le quota et la limite de concurrence.
  expect(await a.reserve(proposal(), later)).toMatchObject({ state: "claimed" });
});

it("compte les échecs dans le rythme, sans les facturer ni bloquer leur rejeu", async () => {
  const a = await setup();
  const inputs = Array.from({ length: 12 }, () => proposal());
  for (const input of inputs) {
    const claim = await a.reserve(input);
    if (claim.state !== "claimed") throw new Error("claim missing");
    await failPlannerOperation(a.owner.userId, a.organizationId, input.id, claim.leaseToken);
  }
  await expect(a.reserve()).rejects.toMatchObject({ code: "planner_rate_limited" });
  expect(await a.reserve(inputs[0]!)).toEqual({ state: "refunded" });
  expect(await prisma.aiPlannerQuota.findUniqueOrThrow({ where: qwhere(a.organizationId) })).toMatchObject({
    usedProposals: 0,
    reservedProposals: 0,
  });
  expect(await a.reserve(proposal(), new Date(now.getTime() + 60000))).toMatchObject({ state: "claimed" });
});

it("expose les quotas du mois local sans texte ni bail expiré et contrôle les accès", async () => {
  const { getPlannerUsage } = await import("@/server/ai/usage.service");
  const a = await setup();
  await a.reserve();
  expect(await getPlannerUsage(a.owner.userId, a.organizationId, now)).toEqual({
    month: "2030-06",
    timeZone: "Europe/Paris",
    limit: { proposals: 30, audioSeconds: 3600 },
    used: { proposals: 0, audioSeconds: 0 },
    reserved: { proposals: 1, audioSeconds: 0 },
  });
  expect((await getPlannerUsage(a.owner.userId, a.organizationId, later)).reserved.proposals).toBe(0);
  const other = await makeOrg("AutreQuotaLecture");
  await expect(getPlannerUsage(other.owner.userId, a.organizationId, now)).rejects.toMatchObject({ status: 403 });
  settings.AI_PLANNER_ENABLED = "false";
  await expect(getPlannerUsage(a.owner.userId, a.organizationId, now)).rejects.toMatchObject({
    code: "planner_disabled",
  });
});

it("une consommation audio doit référencer une transcription, sans accepter un résultat de proposition", async () => {
  const a = await setup();
  const input = { id: randomUUID(), kind: "transcription" as const, fingerprint: "a".repeat(64), audioSeconds: 2 };
  const claim = await reservePlannerOperation(a.owner.userId, a.organizationId, input, now);
  if (claim.state !== "claimed") throw new Error("claim missing");
  await expect(
    completePlannerOperation(a.owner.userId, a.organizationId, input.id, claim.leaseToken, async () => result, now),
  ).rejects.toMatchObject({ status: 409 });
  expect(await prisma.aiPlannerQuota.findUniqueOrThrow({ where: qwhere(a.organizationId) })).toMatchObject({
    usedAudioSeconds: 0,
    reservedAudioSeconds: 2,
  });
  const audioResult = { transcriptionId: input.id, version: 2 };
  expect(
    await completePlannerOperation(
      a.owner.userId,
      a.organizationId,
      input.id,
      claim.leaseToken,
      async () => audioResult,
      now,
    ),
  ).toEqual({ state: "succeeded", result: audioResult });
});
