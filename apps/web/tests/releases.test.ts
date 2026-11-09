import { createVerify, generateKeyPairSync, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  dispatchPending,
  listNotifications,
  markNotificationsRead,
  notify,
  registerDevice,
} from "@/server/notify.service";
import {
  checkAndroidAvailability,
  checkIosAvailability,
  clientCheckIn,
  markReleaseSeen,
  releaseStatus,
  rolloutAppUpdates,
  setMinimumVersion,
  unseenRelease,
} from "@/server/releases.service";
import { updatePreferences } from "@/server/me.service";
import * as transport from "@/lib/notification-transport";
import { makeUser } from "./helpers";

const NOON = new Date("2030-06-12T10:00:00Z");
const NIGHT = new Date("2030-06-12T23:00:00Z");

const makeTarget = (state: string, version = "1.2.0", platform = "ios") =>
  prisma.appReleaseTarget.create({
    data: {
      releaseId: `test-${randomUUID()}`,
      platform,
      version,
      versionCode: Number(version.split(".")[0]) * 1_000_000 + Number(version.split(".")[1]) * 1_000,
      delivery: "store",
      state,
      availableAt: state === "available" ? NOON : null,
    },
  });

const clean = async () => {
  await prisma.appReleaseTarget.deleteMany();
  await prisma.appPlatformConfig.deleteMany();
  await prisma.device.deleteMany();
};

describe("versions et mises à jour", () => {
  let sent: string[] = [];
  beforeEach(async () => {
    await clean();
    sent = [];
    vi.spyOn(transport, "sendExpoNotification").mockImplementation(async (message) => {
      sent.push(String((message as { to: string }).to));
      return { state: "accepted" };
    });
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await clean();
  });

  it("ne vise que les appareils en retard, sur la bonne plateforme", async () => {
    await makeTarget("available");
    const behind = await makeUser("Retard");
    const uptodate = await makeUser("Ajour");
    const unknown = await makeUser("Ancien");
    const android = await makeUser("Android");
    await registerDevice(behind.userId, `ExponentPushToken[${randomUUID()}]`, "ios", { appVersion: "1.1.0" });
    const lateToken = (await prisma.device.findFirstOrThrow({ where: { userId: behind.userId } })).pushToken;
    await registerDevice(uptodate.userId, `ExponentPushToken[${randomUUID()}]`, "ios", { appVersion: "1.2.0" });
    await registerDevice(unknown.userId, `ExponentPushToken[${randomUUID()}]`, "ios");
    await registerDevice(android.userId, `ExponentPushToken[${randomUUID()}]`, "android", { appVersion: "1.0.0" });

    await rolloutAppUpdates(NOON);

    expect(sent).toContain(lateToken);
    expect(sent).toHaveLength(2);
    expect(await prisma.notification.count({ where: { userId: uptodate.userId, type: "app_update" } })).toBe(0);
    expect(await prisma.notification.count({ where: { userId: android.userId, type: "app_update" } })).toBe(0);
  });

  it("n'envoie rien pendant les heures calmes, ni deux fois la même version", async () => {
    await makeTarget("available");
    const user = await makeUser("Calme");
    await registerDevice(user.userId, `ExponentPushToken[${randomUUID()}]`, "ios", { appVersion: "1.0.0" });
    expect(await rolloutAppUpdates(NIGHT)).toBe(0);
    expect(await rolloutAppUpdates(NOON)).toBe(1);
    await prisma.appReleaseTarget.updateMany({ data: { rolloutCursor: null, state: "rolling_out" } });
    expect(await rolloutAppUpdates(NOON)).toBe(0);
    expect(await prisma.notification.count({ where: { userId: user.userId, type: "app_update" } })).toBe(1);
  });

  it("respecte la catégorie coupée, sans repli par e-mail", async () => {
    await makeTarget("available");
    const user = await makeUser("Sobre");
    await registerDevice(user.userId, `ExponentPushToken[${randomUUID()}]`, "ios", { appVersion: "1.0.0" });
    await updatePreferences(user.userId, { notifications: { product: false } });
    await rolloutAppUpdates(NOON);
    expect(sent).toHaveLength(0);
    expect(await prisma.notificationDelivery.count({ where: { notification: { userId: user.userId } } })).toBe(0);
  });

  it("garde le message dans le centre quand une catégorie est coupée", async () => {
    const user = await makeUser("Coupe");
    await registerDevice(user.userId, `ExponentPushToken[${randomUUID()}]`, "ios", { appVersion: "1.0.0" });
    await updatePreferences(user.userId, { notifications: { sessions: false } });
    await notify([user.userId], "session_cancelled", { date: "2030-06-13" }, NOON);
    expect(sent).toHaveLength(0);
    const page = await listNotifications(user.userId);
    expect(page.unread).toBe(1);
    await markNotificationsRead(user.userId, { ids: [page.items[0]!.id] }, NOON);
    expect((await listNotifications(user.userId)).unread).toBe(0);
  });

  it("n'annonce pas une version encore absente du store, et tolère une panne de lecture", async () => {
    const target = await makeTarget("awaiting_store");
    await checkIosAvailability(NOON, (async () => new Response("", { status: 503 })) as typeof fetch);
    expect(await prisma.appReleaseTarget.findUnique({ where: { id: target.id } })).toMatchObject({
      state: "awaiting_store",
      lastErrorCode: "lookup_503",
    });
    const older = (async () => Response.json({ results: [{ version: "1.1.0" }] })) as typeof fetch;
    await checkIosAvailability(NOON, older);
    expect((await prisma.appReleaseTarget.findUnique({ where: { id: target.id } }))?.state).toBe("awaiting_store");
    const live = (async () => Response.json({ results: [{ version: "1.2.0" }] })) as typeof fetch;
    await checkIosAvailability(NOON, live);
    expect((await prisma.appReleaseTarget.findUnique({ where: { id: target.id } }))?.state).toBe("available");
  });

  describe("disponibilité Google Play", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const credentials = JSON.stringify({ client_email: "lecture@tartan.iam.test", private_key: privateKey });
    const app = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/coach.tartan.app";
    const published = "RELEASE_LIFECYCLE_STATE_PUBLISHED";

    type Answers = {
      token?: Response;
      lifecycle?: { releaseName: string; releaseLifecycleState: string }[];
      track?: { name: string; status: string }[];
      trackStatus?: number;
    };

    const google = (answers: Answers) => {
      const calls: { method: string; url: string; body: string }[] = [];
      const fetcher = (async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        calls.push({ method, url, body: String(init?.body ?? "") });
        if (url === "https://oauth2.googleapis.com/token") {
          return answers.token ?? Response.json({ access_token: "jeton-de-test" });
        }
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer jeton-de-test");
        if (method === "GET" && url === `${app}/tracks/production/releases`) {
          return Response.json({ releases: answers.lifecycle ?? [] });
        }
        if (method === "POST" && url === `${app}/edits`) return Response.json({ id: "edit-1" });
        if (method === "GET" && url === `${app}/edits/edit-1/tracks/production`) {
          if (answers.trackStatus) return new Response("", { status: answers.trackStatus });
          return Response.json({ track: "production", releases: answers.track ?? [] });
        }
        if (method === "DELETE" && url === `${app}/edits/edit-1`) return Response.json({});
        throw new Error(`Appel inattendu : ${method} ${url}`);
      }) as typeof fetch;
      return { calls, fetcher };
    };

    const stateOf = (id: string) => prisma.appReleaseTarget.findUniqueOrThrow({ where: { id } });

    it("marque disponible une version publiée et servie à tous, avec un JWT signé", async () => {
      const target = await makeTarget("awaiting_store", "1.2.0", "android");
      const { calls, fetcher } = google({
        lifecycle: [{ releaseName: "12 (1.2.0)", releaseLifecycleState: published }],
        track: [{ name: "12 (1.2.0)", status: "completed" }],
      });
      expect(await checkAndroidAvailability(NOON, fetcher, credentials)).toBe(1);
      expect(await stateOf(target.id)).toMatchObject({ state: "available", lastErrorCode: null, availableAt: NOON });

      const form = new URLSearchParams(calls[0]!.body);
      expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
      const [header, claims, signature] = form.get("assertion")!.split(".") as [string, string, string];
      expect(createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, signature, "base64url")).toBe(
        true,
      );
      const decoded = JSON.parse(Buffer.from(claims, "base64url").toString()) as Record<string, unknown>;
      expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
      expect(decoded).toMatchObject({
        iss: "lecture@tartan.iam.test",
        scope: "https://www.googleapis.com/auth/androidpublisher",
        aud: "https://oauth2.googleapis.com/token",
        iat: NOON.getTime() / 1000,
        exp: NOON.getTime() / 1000 + 3600,
      });
      expect(calls.map((call) => call.method)).toEqual(["POST", "GET", "POST", "GET", "DELETE"]);
    });

    it("sans identifiants, n'appelle rien et n'écrit rien", async () => {
      const target = await makeTarget("awaiting_store", "1.2.0", "android");
      const { calls, fetcher } = google({});
      expect(await checkAndroidAvailability(NOON, fetcher, undefined)).toBe(0);
      expect(calls).toHaveLength(0);
      expect(await stateOf(target.id)).toMatchObject({
        state: "awaiting_store",
        storeCheckedAt: null,
        lastErrorCode: null,
      });
    });

    it("n'annonce pas une version encore en revue, même si la piste la dit completed", async () => {
      const target = await makeTarget("awaiting_store", "1.2.0", "android");
      const { calls, fetcher } = google({
        lifecycle: [{ releaseName: "12 (1.2.0)", releaseLifecycleState: "RELEASE_LIFECYCLE_STATE_IN_REVIEW" }],
        track: [{ name: "12 (1.2.0)", status: "completed" }],
      });
      expect(await checkAndroidAvailability(NOON, fetcher, credentials)).toBe(0);
      expect(await stateOf(target.id)).toMatchObject({ state: "awaiting_store", lastErrorCode: null });
      // Aucune édition n'est ouverte tant que rien de publié n'atteint la version attendue.
      expect(calls.some((call) => call.url.includes("/edits"))).toBe(false);
    });

    it("n'annonce pas un déploiement progressif ni un arrêt", async () => {
      const target = await makeTarget("awaiting_store", "1.2.0", "android");
      for (const status of ["inProgress", "halted"]) {
        const { calls, fetcher } = google({
          lifecycle: [{ releaseName: "12 (1.2.0)", releaseLifecycleState: published }],
          track: [{ name: "12 (1.2.0)", status }],
        });
        expect(await checkAndroidAvailability(NOON, fetcher, credentials)).toBe(0);
        expect(calls.at(-1)?.method).toBe("DELETE");
      }
      expect((await stateOf(target.id)).state).toBe("awaiting_store");
    });

    it("sur échec de lecture, garde la cible en attente, sans notification, et abandonne l'édition", async () => {
      const target = await makeTarget("awaiting_store", "1.2.0", "android");
      const user = await makeUser("Android");
      await registerDevice(user.userId, `ExponentPushToken[${randomUUID()}]`, "android", { appVersion: "1.0.0" });
      const refused = google({ token: new Response("", { status: 401 }) });
      expect(await checkAndroidAvailability(NOON, refused.fetcher, credentials)).toBe(0);
      expect(await stateOf(target.id)).toMatchObject({ state: "awaiting_store", lastErrorCode: "play_token_401" });

      const trackDown = google({
        lifecycle: [{ releaseName: "1.2.0", releaseLifecycleState: published }],
        trackStatus: 503,
      });
      expect(await checkAndroidAvailability(NOON, trackDown.fetcher, credentials)).toBe(0);
      expect(await stateOf(target.id)).toMatchObject({ state: "awaiting_store", lastErrorCode: "play_track_503" });
      expect(trackDown.calls.at(-1)?.method).toBe("DELETE");

      const broken = (async () => {
        throw new Error("réseau");
      }) as typeof fetch;
      expect(await checkAndroidAvailability(NOON, broken, credentials)).toBe(0);
      expect((await stateOf(target.id)).lastErrorCode).toBe("play_lookup_failed");

      expect(await rolloutAppUpdates(NOON)).toBe(0);
      expect(sent).toHaveLength(0);
    });

    it("signale des identifiants illisibles sans appeler Google ni exposer le contenu", async () => {
      const target = await makeTarget("awaiting_store", "1.2.0", "android");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      for (const bad of ["pas du json", JSON.stringify({ client_email: "a@b", private_key: "pas-une-cle-secrete" })]) {
        const { calls, fetcher } = google({});
        expect(await checkAndroidAvailability(NOON, fetcher, bad)).toBe(0);
        expect(calls).toHaveLength(0);
        expect((await stateOf(target.id)).lastErrorCode).toBe("play_credentials_invalid");
      }
      expect(JSON.stringify(warn.mock.calls)).not.toContain("pas-une-cle-secrete");
    });

    it("signale une sortie publiée dont le nom ne dit pas la version", async () => {
      const target = await makeTarget("awaiting_store", "1.2.0", "android");
      const { calls, fetcher } = google({ lifecycle: [{ releaseName: "Hiver", releaseLifecycleState: published }] });
      expect(await checkAndroidAvailability(NOON, fetcher, credentials)).toBe(0);
      expect(await stateOf(target.id)).toMatchObject({
        state: "awaiting_store",
        lastErrorCode: "play_version_unreadable",
      });
      expect(calls.some((call) => call.url.includes("/edits"))).toBe(false);
    });

    it("n'ouvre rien quand aucune version n'attend", async () => {
      const { calls, fetcher } = google({});
      expect(await checkAndroidAvailability(NOON, fetcher, credentials)).toBe(0);
      expect(calls).toHaveLength(0);
    });
  });

  it("refuse un minimum supérieur à la version publiée", async () => {
    await makeTarget("available");
    const admin = await makeUser("Editeur");
    expect(await setMinimumVersion("ios", "1.3.0", null, admin.userId)).toBe(false);
    expect(await setMinimumVersion("ios", "1.2.0", "incompatibilité API", admin.userId)).toBe(true);
    expect(await releaseStatus("ios", "1.1.0")).toMatchObject({ state: "required", latestVersion: "1.2.0" });
    expect(await releaseStatus("ios", "1.2.0")).toMatchObject({ state: "current" });
  });

  it("garde la version connue quand un ancien client se réenregistre", async () => {
    const user = await makeUser("Stable");
    const token = `ExponentPushToken[${randomUUID()}]`;
    await registerDevice(user.userId, token, "ios", { appVersion: "1.2.0" });
    await registerDevice(user.userId, token, "ios");
    expect(await prisma.device.findUnique({ where: { pushToken: token } })).toMatchObject({ appVersion: "1.2.0" });
  });

  it("enregistre une installation même sans autorisation de notification", async () => {
    const user = await makeUser("Install");
    const id = randomUUID();
    await clientCheckIn(user.userId, { installationId: id, platform: "ios", appVersion: "1.1.0" }, NOON);
    expect(await prisma.clientInstallation.findUnique({ where: { id } })).toMatchObject({ appVersionCode: 1001000 });
  });

  it("ne présente pas les nouveautés à un compte créé après la version", async () => {
    const user = await makeUser("Recent");
    await prisma.user.update({ where: { id: user.userId }, data: { createdAt: new Date("2031-01-01T10:00:00Z") } });
    expect(await unseenRelease(user.userId, "web", "coach")).toBeNull();
    await prisma.user.update({ where: { id: user.userId }, data: { createdAt: new Date("2026-01-01T10:00:00Z") } });
    const notice = await unseenRelease(user.userId, "web", "coach");
    expect(notice).not.toBeNull();
    await markReleaseSeen(user.userId, notice!.id);
    expect(await unseenRelease(user.userId, "web", "coach")).toBeNull();
  });

  it("garde une notification d'un type inconnu lisible après un retour arrière", async () => {
    const user = await makeUser("Retour");
    await prisma.notification.create({ data: { userId: user.userId, type: "futur_type", readAt: NOON } });
    expect((await listNotifications(user.userId)).items[0]?.text).toBe("Nouvelle notification");
    expect(await dispatchPending(NOON, [randomUUID()])).toBe(0);
  });
});
