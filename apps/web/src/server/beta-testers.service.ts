import type { CheckInInput } from "@tartan/contracts";
import { currentApk } from "./beta-apk.service";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createElement } from "react";
import { w } from "@tartan/i18n/web";
import { BetaEmail } from "@email/beta";
import type { BetaTester, Prisma } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/session";
import { deriveToken, idFromToken, sha256, tokenMatches } from "@/lib/tokens";
import { requireStepUp, STEP_UP_READ_MS } from "./admin-step-up.service";
import { syncAppleBeta } from "./beta-apple";

const PURPOSE = "beta-install-v1";
const days = (n: number) => n * 86400000;
const live = (row: BetaTester, now: Date) => !row.revokedAt && row.expiresAt > now;
const payload = z.object({
  id: z.uuid(),
  version: z.number().int(),
  channel: z.enum(["ios", "android", "play", "invite"]),
  build: z.number().int().positive().optional(),
  tokenId: z.uuid().optional(),
});
type Channel = z.infer<typeof payload>["channel"];
const ready = (r: BetaTester, c: Exclude<Channel, "invite">, apk: boolean) =>
  c === "ios"
    ? r.ios && r.iosAuthorized
    : c === "play"
      ? r.android && r.playAuthorized && Boolean(env().BETA_PLAY_URL)
      : r.android && apk;
const inviteUrl = (row: BetaTester) => env().NEXT_PUBLIC_APP_URL + "/installation#" + deriveToken(PURPOSE, row.tokenId);
const key = (r: BetaTester, c: Channel) => `beta:${r.id}:${r.version}:${c}`;
const txOptions = { timeout: 25000 };
const lock = (tx: Prisma.TransactionClient, id: string) =>
  tx.$queryRaw`SELECT id FROM beta_testers WHERE id = ${id}::uuid FOR UPDATE`;

export async function inviteBeta(actor: Actor, email: string, platform: "ios" | "android" | "both", now = new Date()) {
  await requireStepUp(actor, STEP_UP_READ_MS);
  const address = z.email().max(254).parse(email.trim().toLowerCase());
  const ios = platform !== "android",
    android = platform !== "ios";
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${address})::bigint)::text`;
    const previous = await tx.betaTester.findUnique({ where: { email: address } });
    if (previous && live(previous, now))
      return tx.betaTester.update({
        where: { id: previous.id },
        data: {
          ios: previous.ios || ios,
          android: previous.android || android,
          nextAttemptAt: now,
        },
      });
    // Réactivation seulement après le retrait effectif des autorisations précédentes.
    if (previous?.iosNeedsCleanup || previous?.playAuthorized) return previous;
    const tokenId = randomUUID();
    const data = {
      ios,
      android,
      tokenId,
      tokenHash: sha256(deriveToken(PURPOSE, tokenId)),
      expiresAt: new Date(+now + days(30)),
      nextAttemptAt: now,
      revokedAt: null,
      providerFailed: false,
      openedAt: null,
      apkAt: null,
      appleAt: null,
    };
    if (previous) await tx.betaInstallation.deleteMany({ where: { testerId: previous.id } });
    return tx.betaTester.upsert({
      where: { email: address },
      create: { email: address, ...data },
      update: { ...data, version: { increment: 1 } },
    });
  });
}
export async function changeBeta(
  actor: Actor,
  id: string,
  version: number,
  action: "resend" | "revoke" | "play" | "removed",
  now = new Date(),
) {
  await requireStepUp(actor, STEP_UP_READ_MS);
  return prisma.$transaction(async (tx) => {
    await lock(tx, id);
    const r = await tx.betaTester.findUniqueOrThrow({ where: { id } });
    if (r.version !== version) return;
    if (action === "removed" && (!r.playAuthorized || live(r, now))) return;
    if (action !== "removed" && !live(r, now)) return;
    if (action === "play" && (!r.android || r.playAuthorized || !env().BETA_PLAY_URL)) return;
    await tx.betaTester.update({
      where: { id },
      data: {
        version: { increment: 1 },
        nextAttemptAt: now,
        providerFailed: false,
        ...(action === "revoke"
          ? { revokedAt: now }
          : action === "play"
            ? { playAuthorized: true }
            : action === "removed"
              ? { playAuthorized: false }
              : {}),
      },
    });
  });
}
export async function betaAccess(token: string, now = new Date()) {
  if (token.length > 100 || !tokenMatches(PURPOSE, token)) return null;
  const row = await prisma.betaTester.findUnique({ where: { tokenId: idFromToken(token)! } });
  if (!row || !live(row, now) || row.tokenHash !== sha256(token)) return null;
  const apk = await currentApk();
  return {
    ios: ready(row, "ios", Boolean(apk)),
    android: ready(row, "android", Boolean(apk)),
    play: ready(row, "play", Boolean(apk)),
    apk,
  };
}
export async function recordBetaEvent(token: string, event: "openedAt" | "apkAt" | "appleAt", now = new Date()) {
  if (!tokenMatches(PURPOSE, token)) return false;
  const result = await prisma.betaTester.updateMany({
    where: {
      tokenId: idFromToken(token)!,
      tokenHash: sha256(token),
      revokedAt: null,
      expiresAt: { gt: now },
      ...(event === "apkAt" ? { android: true } : event === "appleAt" ? { ios: true, iosAuthorized: true } : {}),
    },
    data: { [event]: now },
  });
  return result.count === 1;
}
export async function recordBetaUse(userId: string, input: CheckInInput, now: Date) {
  if (!input.beta || input.platform === "web") return;
  const { platform, beta } = input;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } });
  if (!user?.emailVerified) return;
  const tester = await prisma.$transaction(async (tx) => {
    const address = user.email.toLowerCase();
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM beta_testers WHERE email = ${address} FOR UPDATE`;
    if (!rows.length) return null;
    const row = await tx.betaTester.findUniqueOrThrow({ where: { id: rows[0]!.id } });
    if (!live(row, now) || !row[platform]) return null;
    const device = {
      platform,
      model: beta.model ?? null,
      os: beta.os,
      appVersion: input.appVersion,
      build: beta.build,
      lastSeenAt: now,
    };
    await tx.betaInstallation.upsert({
      where: { testerId_installationId: { testerId: row.id, installationId: input.installationId } },
      create: { testerId: row.id, installationId: input.installationId, firstSeenAt: now, ...device },
      update: device,
    });
    return row;
  });
  if (!tester) return;
  if (platform !== "android") return;
  const apk = await currentApk();
  if (apk && /^\d+$/.test(beta.build) && Number(beta.build) < apk.build)
    return { url: inviteUrl(tester), build: apk.build, version: apk.version };
}
export async function isBetaMailRelevant(raw: unknown, email: string, now = new Date()) {
  const p = payload.parse(raw),
    r = await prisma.betaTester.findUnique({ where: { id: p.id } });
  const apk = await currentApk();
  const available =
    r &&
    (p.channel === "invite"
      ? (["ios", "android", "play"] as const).some((c) => ready(r, c, Boolean(apk)))
      : ready(r, p.channel, Boolean(apk)));
  return Boolean(
    env().BETA_INVITES_ENABLED === "true" &&
    r &&
    r.email === email &&
    live(r, now) &&
    (p.build ? p.tokenId === r.tokenId && p.build === apk?.build : r.version === p.version) &&
    available,
  );
}
export async function renderBetaMail(raw: unknown) {
  const p = payload.parse(raw),
    r = await prisma.betaTester.findUniqueOrThrow({ where: { id: p.id } });
  if (p.build ? p.tokenId !== r.tokenId : r.version !== p.version) throw notFound();
  const url = inviteUrl(r);
  const update = p.build ? (await currentApk())?.version : undefined;
  return {
    subject: update ? w.admin.testers.update(update) : w.admin.testers.subject,
    react: createElement(BetaEmail, { url, update }),
  };
}
export async function dispatchBeta(now = new Date()) {
  const rows = await prisma.betaTester.findMany({
    where: { nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: 8,
    select: { id: true },
  });
  const apk = Boolean(await currentApk());
  for (const { id } of rows) {
    try {
      if (env().BETA_INVITES_ENABLED === "true") {
        // Écrit avant le réseau : un arrêt après acceptation par Apple laisse le retrait possible.
        await prisma.betaTester.updateMany({
          where: {
            id,
            ios: true,
            iosAuthorized: false,
            iosNeedsCleanup: false,
            expiresAt: { gt: now },
            revokedAt: null,
          },
          data: { iosNeedsCleanup: true },
        });
      }
      await prisma.$transaction(async (tx) => {
        await lock(tx, id);
        let r = await tx.betaTester.findUniqueOrThrow({ where: { id } });
        if (r.nextAttemptAt > now) return;
        const enabled = env().BETA_INVITES_ENABLED === "true",
          active = live(r, now);
        const wantsIOS = active && r.ios;
        let appleFailed = false;
        if (r.ios && ((enabled && wantsIOS && !r.iosAuthorized) || (!active && r.iosNeedsCleanup))) {
          const synced = await syncAppleBeta(r.email, wantsIOS).catch(() => {
            appleFailed = true;
            return false;
          });
          if (synced)
            r = await tx.betaTester.update({
              where: { id },
              data: { iosAuthorized: wantsIOS, iosNeedsCleanup: wantsIOS },
            });
        }
        if (active && enabled) {
          if ((["ios", "android", "play"] as const).some((c) => ready(r, c, apk))) {
            // Une invitation déjà livrée par l’ancien système continue à ouvrir les deux plateformes.
            const legacy = await tx.emailOutbox.count({
              where: { dedupeKey: { in: (["ios", "android", "play"] as const).map((c) => key(r, c)) }, failedAt: null },
            });
            if (!legacy)
              await tx.emailOutbox.createMany({
                data: [
                  {
                    toEmail: r.email,
                    retryUntil: r.expiresAt,
                    kind: "beta_install",
                    dedupeKey: key(r, "invite"),
                    payload: { id, channel: "invite", version: r.version },
                  },
                ],
                skipDuplicates: true,
              });
          }
        }
        await tx.betaTester.update({
          where: { id },
          data: {
            providerFailed: appleFailed,
            nextAttemptAt: new Date(+now + (appleFailed ? 300000 : active ? 3600000 : days(1))),
          },
        });
      }, txOptions);
    } catch {
      await prisma.betaTester.updateMany({
        where: { id, nextAttemptAt: { lte: now } },
        data: { providerFailed: true, nextAttemptAt: new Date(+now + 300000) },
      });
    }
  }
}
export async function listBeta(actor: Actor, now = new Date()) {
  await requireStepUp(actor, STEP_UP_READ_MS);
  const rows = await prisma.betaTester.findMany({
    orderBy: { createdAt: "desc" },
    include: { installations: { orderBy: { lastSeenAt: "desc" } } },
  });
  const apk = Boolean(await currentApk());
  const mail = await prisma.emailOutbox.findMany({
    where: {
      kind: "beta_install",
      dedupeKey: { in: rows.flatMap((r) => (["ios", "android", "play", "invite"] as const).map((c) => key(r, c))) },
    },
    select: { dedupeKey: true, sentAt: true, failedAt: true },
  });
  const messages = new Map(mail.map((r) => [r.dedupeKey, r]));
  const t = w.admin.testers;
  return rows.map((r) => {
    const status = (c: Exclude<Channel, "invite">) => {
      if (r.revokedAt) return t.revoked;
      if (r.expiresAt <= now) return t.expired;
      const message = messages.get(key(r, "invite")) ?? messages.get(key(r, c));
      if (message?.failedAt || (c === "ios" && r.providerFailed)) return t.failed;
      if (!ready(r, c, apk)) return t.pending;
      return message?.sentAt ? t.sent : t.authorized;
    };
    return {
      id: r.id,
      version: r.version,
      email: r.email,
      url: live(r, now) ? inviteUrl(r) : null,
      openedAt: r.openedAt,
      apkAt: r.apkAt,
      appleAt: r.appleAt,
      installations: r.installations,
      ios: r.ios ? status("ios") : null,
      android: r.android ? status(r.playAuthorized ? "play" : "android") : null,
      active: live(r, now),
      playAuthorized: r.playAuthorized,
      playConfig: Boolean(env().BETA_PLAY_URL),
    };
  });
}
