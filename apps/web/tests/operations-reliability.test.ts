import { afterEach, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { adminCorrectBirthDate, adminRetryEmail } from "@/server/admin.service";
import { confirmBirthDate } from "@/server/age.service";
import { flushEmailOutbox } from "@/server/email-outbox.service";
import { runRetention } from "@/server/retention.service";
import { makeOrg, makeUser } from "./helpers";

afterEach(() => {
  vi.unstubAllEnvs();
  env().ADMIN_EMAILS = "";
});
const admin = async () => {
  const actor = await makeUser("Support");
  env().ADMIN_EMAILS = actor.email;
  return actor;
};

it("la rectification est réservée au support, propagée et auditée sans la date", async () => {
  const target = await makeUser("Erreur", { birthDate: "2015-01-01" });
  const outsider = await makeUser("Intrus");
  const actor = await admin();
  const input = { userId: target.userId, birthDate: "1990-01-01", reason: "verified_support_request" };
  await expect(adminCorrectBirthDate(outsider, input)).rejects.toMatchObject({ status: 403 });
  await adminCorrectBirthDate(actor, input);
  expect((await prisma.profile.findUniqueOrThrow({ where: { id: target.userId } })).birthDate?.toISOString()).toContain(
    "1990-01-01",
  );
  const audit = await prisma.auditLog.findFirstOrThrow({ where: { actorId: actor.userId, entityId: target.userId } });
  expect(audit.action).toBe("birth_date_corrected:verified_support_request");
  expect(JSON.stringify(audit)).not.toContain("1990-01-01");
});

it("deux dates concurrentes ne peuvent pas contourner la première déclaration", async () => {
  const target = await makeUser("Concurrent", { birthDate: null });
  const results = await Promise.allSettled([
    confirmBirthDate(target.userId, "1990-01-01"),
    confirmBirthDate(target.userId, "1980-01-01"),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "age_already_set" } });
});

it("un e-mail vieux de 24 h reste visible, et seule une reprise encore pertinente est acceptée", async () => {
  const a = await makeOrg("Envoi");
  const actor = await admin();
  const sub = await prisma.subscription.create({
    data: {
      organizationId: a.organizationId,
      provider: "stripe",
      providerRef: `sub_${a.organizationId}`,
      planKey: "coach",
      status: "active",
    },
  });
  const row = await prisma.emailOutbox.create({
    data: {
      organizationId: a.organizationId,
      toEmail: a.owner.email,
      kind: "started",
      dedupeKey: `${sub.providerRef}:started`,
      payload: { space: "Envoi", plan: "coach", interval: "month", trialEnd: null, cancelAt: null, unpaid: false },
      createdAt: new Date(Date.now() - 25 * 3600_000),
    },
  });
  await flushEmailOutbox();
  expect((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } })).failureCode).toBe(
    "delivery_window_expired",
  );
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: "canceled" } });
  await expect(adminRetryEmail(actor, row.id)).rejects.toMatchObject({ status: 400 });
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: "active" } });
  await adminRetryEmail(actor, row.id);
  await flushEmailOutbox();
  expect((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } })).sentAt).not.toBeNull();
});

it("la conservation protège un espace actif sans repreneur, mais ne prolonge pas l'activité via le cron", async () => {
  const a = await makeOrg("Club actif");
  const now = new Date();
  const past = new Date(now.getTime() - 800 * 86400_000);
  await prisma.profile.update({
    where: { id: a.owner.userId },
    data: { lastActiveAt: past, inactivityNoticeAt: new Date(now.getTime() - 31 * 86400_000) },
  });
  const session = await prisma.scheduledSession.create({
    data: {
      organizationId: a.organizationId,
      createdBy: a.owner.userId,
      date: now,
      title: "Force",
      type: "strength",
      draft: {},
    },
  });
  await runRetention(now);
  const protectedOrg = await prisma.organization.findUniqueOrThrow({ where: { id: a.organizationId } });
  expect(protectedOrg.retentionReviewAt).not.toBeNull();
  expect(await prisma.user.count({ where: { id: a.owner.userId } })).toBe(1);
  await prisma.organization.update({ where: { id: a.organizationId }, data: { lastBusinessActivityAt: past } });
  await prisma.scheduledSession.update({ where: { id: session.id }, data: { publishedAt: now, updatedAt: now } });
  expect(
    (await prisma.organization.findUniqueOrThrow({ where: { id: a.organizationId } })).lastBusinessActivityAt,
  ).toEqual(past);
  await runRetention(now);
  expect(await prisma.organization.count({ where: { id: a.organizationId } })).toBe(0);
});
