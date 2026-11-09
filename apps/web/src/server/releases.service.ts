import { compareVersions, isQuietHours, updateStateOf, versionCode } from "@tartan/domain";
import type { CheckInInput, ReleaseStatus, ReleaseView } from "@tartan/contracts";
import { latestRelease, releases, type ReleaseNote } from "@tartan/i18n";
import { hourInParis } from "@/lib/dates";
import { env } from "@/lib/env";
import { readPlayProductionVersion } from "@/lib/google-play";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { dispatchPending } from "./notification-delivery.service";

const IOS_BUNDLE_ID = "coach.tartan.app";
const ANDROID_PACKAGE = "coach.tartan.app";
export const IOS_STORE_URL = "https://apps.apple.com/fr/app/id6829712713";
export const ANDROID_STORE_URL = "https://play.google.com/store/apps/details?id=coach.tartan.app";
const ROLLOUT_BATCH = 200;
const DISPATCH_CHUNK = 100;

type StorePlatform = "ios" | "android";
const storeUrl = (platform: StorePlatform) => (platform === "ios" ? IOS_STORE_URL : ANDROID_STORE_URL);

// Lancé par la tâche planifiée : seul du code réellement en production peut déclarer une version.
export const syncReleaseManifest = async (now: Date = new Date()): Promise<number> => {
  let created = 0;
  for (const release of releases) {
    const targets: { platform: string; version: string; delivery: string; state: string }[] = [];
    if (release.targets.web)
      targets.push({ platform: "web", version: release.id, delivery: "web", state: "available" });
    if (release.targets.ota) {
      targets.push({ platform: "ota", version: release.targets.ota.version, delivery: "ota", state: "available" });
    }
    for (const platform of ["ios", "android"] as const) {
      const target = release.targets[platform];
      if (target) targets.push({ platform, version: target.version, delivery: "store", state: "awaiting_store" });
    }
    for (const target of targets) {
      const existing = await prisma.appReleaseTarget.findUnique({
        where: { releaseId_platform: { releaseId: release.id, platform: target.platform } },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.appReleaseTarget.create({
        data: {
          releaseId: release.id,
          platform: target.platform,
          version: target.version,
          versionCode: versionCode(target.version),
          delivery: target.delivery,
          state: target.state,
          availableAt: target.state === "available" ? now : null,
        },
      });
      created++;
    }
  }
  return created;
};

const recordStoreLookup = async (
  waiting: { id: string; version: string }[],
  published: string | null,
  errorCode: string | null,
  now: Date,
): Promise<number> => {
  let available = 0;
  for (const target of waiting) {
    const ready = published !== null && compareVersions(published, target.version) >= 0;
    await prisma.appReleaseTarget.update({
      where: { id: target.id },
      data: {
        storeCheckedAt: now,
        lastErrorCode: errorCode,
        ...(ready ? { state: "available", availableAt: now } : {}),
      },
    });
    if (ready) available++;
  }
  return available;
};

export const checkIosAvailability = async (now: Date = new Date(), fetcher: typeof fetch = fetch): Promise<number> => {
  const waiting = await prisma.appReleaseTarget.findMany({ where: { platform: "ios", state: "awaiting_store" } });
  if (waiting.length === 0) return 0;
  let published: string | null = null;
  let errorCode: string | null = null;
  try {
    const res = await fetcher(`https://itunes.apple.com/lookup?bundleId=${IOS_BUNDLE_ID}&country=fr`, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) errorCode = `lookup_${res.status}`;
    else published = ((await res.json()) as { results?: { version?: string }[] }).results?.[0]?.version ?? null;
  } catch {
    errorCode = "lookup_failed";
  }
  const available = await recordStoreLookup(waiting, published, errorCode, now);
  if (errorCode) log.warn("ios_store_lookup_failed", { code: errorCode });
  return available;
};

// Sans compte de service, rien n'est lu ni écrit : la confirmation depuis la console reste le chemin normal.
export const checkAndroidAvailability = async (
  now: Date = new Date(),
  fetcher: typeof fetch = fetch,
  credentialsJson: string | undefined = env().GOOGLE_PLAY_SERVICE_ACCOUNT_JSON,
): Promise<number> => {
  if (!credentialsJson) return 0;
  const waiting = await prisma.appReleaseTarget.findMany({ where: { platform: "android", state: "awaiting_store" } });
  const [wanted] = waiting.map((target) => target.version).sort(compareVersions);
  if (!wanted) return 0;
  const { version, errorCode } = await readPlayProductionVersion({
    packageName: ANDROID_PACKAGE,
    credentialsJson,
    wanted,
    now,
    fetcher,
  });
  const available = await recordStoreLookup(waiting, version, errorCode, now);
  if (errorCode) log.warn("android_store_lookup_failed", { code: errorCode });
  return available;
};

// Repli d'Android (et recours d'iOS) : la disponibilité se confirme depuis la console.
export const confirmStoreAvailability = async (targetId: string, now: Date = new Date()): Promise<void> => {
  await prisma.appReleaseTarget.updateMany({
    where: { id: targetId, state: "awaiting_store" },
    data: { state: "available", availableAt: now, storeCheckedAt: now, lastErrorCode: null },
  });
};

export const stopRollout = async (targetId: string): Promise<void> => {
  await prisma.appReleaseTarget.updateMany({
    where: { id: targetId, state: { in: ["available", "rolling_out"] } },
    data: { state: "stopped" },
  });
};

// Par lots, jamais pendant les heures calmes : une version ne doit pas retarder un rappel de séance.
export const rolloutAppUpdates = async (now: Date = new Date()): Promise<number> => {
  if (isQuietHours(hourInParis(now))) return 0;
  const targets = await prisma.appReleaseTarget.findMany({
    where: { delivery: "store", state: { in: ["available", "rolling_out"] } },
    orderBy: { availableAt: "asc" },
  });
  let queued = 0;
  for (const target of targets) {
    const code = target.versionCode;
    if (code === null) continue;
    const devices = await prisma.device.findMany({
      where: {
        platform: target.platform as StorePlatform,
        OR: [{ appVersionCode: null }, { appVersionCode: { lt: code } }],
        ...(target.rolloutCursor ? { id: { gt: target.rolloutCursor } } : {}),
        user: { profile: { is: { pushProductUpdates: true } } },
      },
      orderBy: { id: "asc" },
      take: ROLLOUT_BATCH,
      select: { id: true, userId: true },
    });
    if (devices.length === 0) {
      await prisma.appReleaseTarget.update({ where: { id: target.id }, data: { state: "done" } });
      continue;
    }
    const userIds = [...new Set(devices.map((device) => device.userId))];
    const created = await prisma.notification.createManyAndReturn({
      data: userIds.map((userId) => ({
        userId,
        type: "app_update",
        deliverAfter: now,
        dedupeKey: `app_update:${target.releaseId}:${target.platform}:${userId}`,
        payload: {
          link: "/nouveautes",
          version: target.version,
          versionCode: code,
          platform: target.platform,
          releaseId: target.releaseId,
        },
      })),
      skipDuplicates: true,
      select: { id: true },
    });
    await prisma.appReleaseTarget.update({
      where: { id: target.id },
      data: {
        state: "rolling_out",
        rolloutCursor: devices[devices.length - 1]!.id,
        notifiedCount: { increment: created.length },
      },
    });
    for (let index = 0; index < created.length; index += DISPATCH_CHUNK) {
      await dispatchPending(
        now,
        created.slice(index, index + DISPATCH_CHUNK).map((row) => row.id),
      );
    }
    queued += created.length;
  }
  return queued;
};

export const runReleaseJobs = async (now: Date = new Date()): Promise<number> => {
  await syncReleaseManifest(now);
  await checkIosAvailability(now);
  await checkAndroidAvailability(now);
  return rolloutAppUpdates(now);
};

const notesFor = (release: ReleaseNote, audience: "coach" | "athlete"): ReleaseView => ({
  id: release.id,
  date: release.date,
  title: release.title,
  items: [...release[audience]],
});

// Public : un binaire doit savoir s'il est trop ancien, même avant la connexion.
export const releaseStatus = async (platform: StorePlatform, version: string): Promise<ReleaseStatus> => {
  const [target, config] = await Promise.all([
    prisma.appReleaseTarget.findFirst({
      where: { platform, state: { in: ["available", "rolling_out", "done"] } },
      orderBy: [{ versionCode: "desc" }],
      select: { version: true },
    }),
    prisma.appPlatformConfig.findUnique({ where: { platform } }),
  ]);
  const latest = target?.version ?? null;
  const minimum = config?.minimumVersion ?? null;
  return {
    state: updateStateOf({ current: version, latest, minimum }),
    latestVersion: latest,
    minimumVersion: minimum,
    storeUrl: storeUrl(platform),
  };
};

// Un minimum supérieur à la version publiée verrouillerait tout le monde sans remède.
export const setMinimumVersion = async (
  platform: StorePlatform,
  minimumVersion: string | null,
  reason: string | null,
  updatedBy: string,
): Promise<boolean> => {
  if (minimumVersion) {
    const live = await prisma.appReleaseTarget.findFirst({
      where: { platform, state: { in: ["available", "rolling_out", "done"] } },
      orderBy: { versionCode: "desc" },
      select: { version: true },
    });
    if (!live || compareVersions(minimumVersion, live.version) > 0) return false;
  }
  await prisma.appPlatformConfig.upsert({
    where: { platform },
    create: { platform, minimumVersion, minimumVersionCode: versionCode(minimumVersion), reason, updatedBy },
    update: { minimumVersion, minimumVersionCode: versionCode(minimumVersion), reason, updatedBy },
  });
  return true;
};

export const listReleases = (audience: "coach" | "athlete"): ReleaseView[] =>
  releases.map((release) => notesFor(release, audience)).filter((release) => release.items.length > 0);

// Un compte créé après la version n'a rien à découvrir : Nouveautés ne parle qu'à ceux qui l'ont connu avant.
export const unseenRelease = async (
  userId: string,
  platform: "web" | "ios" | "android",
  audience: "coach" | "athlete",
): Promise<ReleaseView | null> => {
  const latest = latestRelease(platform);
  if (!latest || latest[audience].length === 0) return null;
  const [profile, user] = await Promise.all([
    prisma.profile.findUnique({ where: { id: userId }, select: { lastSeenReleaseId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
  ]);
  if (profile?.lastSeenReleaseId === latest.id) return null;
  if (user && user.createdAt.toISOString().slice(0, 10) >= latest.date) return null;
  return notesFor(latest, audience);
};

export const markReleaseSeen = async (userId: string, releaseId: string): Promise<void> => {
  if (!releases.some((release) => release.id === releaseId)) return;
  await prisma.profile.updateMany({ where: { id: userId }, data: { lastSeenReleaseId: releaseId } });
};

// Statistiques non biaisées : une installation existe même sans autorisation de notification.
export const clientCheckIn = async (userId: string, input: CheckInInput, now: Date = new Date()): Promise<void> => {
  const appVersionCode = versionCode(input.appVersion);
  await prisma.clientInstallation.upsert({
    where: { id: input.installationId },
    create: {
      id: input.installationId,
      userId,
      platform: input.platform,
      appVersion: input.appVersion,
      appVersionCode,
      updateId: input.updateId ?? null,
      lastSeenAt: now,
    },
    update: {
      userId,
      platform: input.platform,
      appVersion: input.appVersion,
      appVersionCode,
      updateId: input.updateId ?? null,
      lastSeenAt: now,
    },
  });
  if (input.pushToken) {
    await prisma.device.updateMany({
      where: { userId, pushToken: input.pushToken },
      data: {
        appVersion: input.appVersion,
        appVersionCode,
        updateId: input.updateId ?? null,
        installationId: input.installationId,
        lastSeenAt: now,
      },
    });
  }
};
