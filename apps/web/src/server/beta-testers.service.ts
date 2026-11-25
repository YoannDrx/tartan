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
const apkReady = () => Boolean(env().BETA_APK_PATH && env().BETA_APK_READ_WRITE_TOKEN && env().BETA_APK_VERSION);
const payload = z.object({ id: z.uuid(), version: z.number().int(), channel: z.enum(["ios", "android", "play"]) });
type Channel = z.infer<typeof payload>["channel"];
const ready = (r: BetaTester, c: Channel) =>
  c === "ios"
    ? r.ios && r.iosAuthorized
    : c === "play"
      ? r.android && r.playAuthorized && Boolean(env().BETA_PLAY_URL)
      : r.android && apkReady();
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
    };
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
  return { ios: ready(row, "ios"), android: ready(row, "android"), play: ready(row, "play") };
}
export async function isBetaMailRelevant(raw: unknown, email: string, now = new Date()) {
  const p = payload.parse(raw),
    r = await prisma.betaTester.findUnique({ where: { id: p.id } });
  return Boolean(
    env().BETA_INVITES_ENABLED === "true" &&
    r &&
    r.email === email &&
    live(r, now) &&
    r.version === p.version &&
    ready(r, p.channel),
  );
}
export async function renderBetaMail(raw: unknown) {
  const p = payload.parse(raw),
    r = await prisma.betaTester.findUniqueOrThrow({ where: { id: p.id } });
  if (r.version !== p.version) throw notFound();
  const url = env().NEXT_PUBLIC_APP_URL + "/installation#" + deriveToken(PURPOSE, r.tokenId);
  return { subject: w.admin.testers.subject, react: createElement(BetaEmail, { url }) };
}
export async function dispatchBeta(now = new Date()) {
  const rows = await prisma.betaTester.findMany({
    where: { nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: 8,
    select: { id: true },
  });
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
          for (const channel of ["ios", "android", "play"] as const) {
            if (ready(r, channel))
              await tx.emailOutbox.createMany({
                data: [
                  {
                    toEmail: r.email,
                    retryUntil: r.expiresAt,
                    kind: "beta_install",
                    dedupeKey: key(r, channel),
                    payload: { id, channel, version: r.version },
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
  const rows = await prisma.betaTester.findMany({ orderBy: { createdAt: "desc" } });
  const mail = await prisma.emailOutbox.findMany({
    where: {
      kind: "beta_install",
      dedupeKey: { in: rows.flatMap((r) => (["ios", "android", "play"] as const).map((c) => key(r, c))) },
    },
    select: { dedupeKey: true, sentAt: true, failedAt: true },
  });
  const messages = new Map(mail.map((r) => [r.dedupeKey, r]));
  const t = w.admin.testers;
  return rows.map((r) => {
    const status = (c: Channel) => {
      if (r.revokedAt) return t.revoked;
      if (r.expiresAt <= now) return t.expired;
      const message = messages.get(key(r, c));
      if (message?.failedAt || (c === "ios" && r.providerFailed)) return t.failed;
      if (message?.sentAt) return t.sent;
      return ready(r, c) ? t.authorized : t.pending;
    };
    return {
      id: r.id,
      version: r.version,
      email: r.email,
      ios: r.ios ? status("ios") : null,
      android: r.android ? status(r.playAuthorized ? "play" : "android") : null,
      active: live(r, now),
      playAuthorized: r.playAuthorized,
      playConfig: Boolean(env().BETA_PLAY_URL),
    };
  });
}
