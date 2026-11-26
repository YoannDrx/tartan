import { createHash } from "node:crypto";
import { get } from "@vercel/blob";
import { z } from "zod";
import { w } from "@tartan/i18n/web";
import { env } from "@/lib/env";
import { invalid } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/session";
import { requireStepUp, STEP_UP_READ_MS } from "./admin-step-up.service";

const manifest = z.object({
  build: z.number().int().positive().max(2100000000),
  version: z.string().min(1).max(40),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  cert: z.string().regex(/^[a-f0-9]{64}$/),
});
const artifact = (digest: string) => `beta/verified/${digest}.apk`;
const t = w.admin.testers;
export async function currentApk() {
  if (!env().BETA_APK_READ_WRITE_TOKEN) return null;
  const current = await prisma.betaApkRelease.findFirst({ orderBy: { build: "desc" } });
  if (current) return { ...current, path: artifact(current.digest) };
  const { BETA_APK_PATH: path, BETA_APK_VERSION: version } = env();
  return path && version ? { path, version, build: Number(env().BETA_APK_BASE_BUILD) || 0 } : null;
}
export async function stagedApk(actor: Actor) {
  await requireStepUp(actor, STEP_UP_READ_MS);
  const token = env().BETA_APK_READ_WRITE_TOKEN;
  if (!token || !env().BETA_APK_CERT_SHA256) return null;
  const candidate = await get("beta/staged.json", { token, access: "private", useCache: false });
  if (candidate?.statusCode !== 200 || candidate.blob.size > 1024) return null;
  const parsed = manifest.safeParse(await new Response(candidate.stream).json().catch(() => null));
  if (!parsed.success || parsed.data.cert !== env().BETA_APK_CERT_SHA256?.toLowerCase()) throw invalid(t.badApk);
  return parsed.data;
}
export async function publishApk(actor: Actor, digest: string, now = new Date()) {
  const candidate = await stagedApk(actor);
  if (!candidate || candidate.digest !== digest) throw invalid(t.changedApk);
  const bytes = await get(artifact(digest), {
    token: env().BETA_APK_READ_WRITE_TOKEN,
    access: "private",
    useCache: false,
  });
  if (bytes?.statusCode !== 200) throw invalid(t.badApk);
  const hash = createHash("sha256");
  const reader = bytes.stream.getReader();
  for (let packet = await reader.read(); !packet.done; packet = await reader.read()) hash.update(packet.value);
  if (hash.digest("hex") !== digest) throw invalid(t.badApk);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('beta-apk-release')::bigint)::text`;
    const last = await tx.betaApkRelease.findFirst({ orderBy: { build: "desc" } });
    if (last?.digest === digest) return;
    const baseline = Number(env().BETA_APK_BASE_BUILD);
    if (!last && env().BETA_APK_PATH && (!Number.isInteger(baseline) || baseline <= 0)) throw invalid(t.badApk);
    if (candidate.build <= (last?.build ?? (baseline || 0))) throw invalid(t.badApk);
    await tx.betaApkRelease.create({ data: { build: candidate.build, version: candidate.version, digest } });
    const testers = await tx.betaTester.findMany({ where: { android: true, revokedAt: null, expiresAt: { gt: now } } });
    if (testers.length)
      await tx.emailOutbox.createMany({
        data: testers.map((r) => ({
          toEmail: r.email,
          retryUntil: r.expiresAt,
          kind: "beta_install",
          dedupeKey: `beta-apk:${r.id}:${candidate.build}`,
          payload: { id: r.id, tokenId: r.tokenId, version: r.version, channel: "android", build: candidate.build },
        })),
        skipDuplicates: true,
      });
  });
}
