import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { dispatchPending } from "@/server/notify.service";
import { makeUser } from "./helpers";

const mocks = vi.hoisted(() => ({ web: vi.fn(), email: vi.fn(), fetch: vi.fn() }));
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: mocks.web } }));
vi.mock("@/lib/mail", () => ({ sendEmail: mocks.email }));
vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...actual,
    env: () => ({ ...actual.env(), NEXT_PUBLIC_VAPID_PUBLIC_KEY: "test", VAPID_PRIVATE_KEY: "test" }),
  };
});

const NOW = new Date("2030-06-10T10:00:00Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const setup = async (platform: "web" | "ios" | null = "web") => {
  const user = await makeUser("Livraison");
  const device = platform
    ? await prisma.device.create({
        data: {
          userId: user.userId,
          platform,
          pushToken:
            platform === "web"
              ? JSON.stringify({ endpoint: `https://test.invalid/${user.userId}` })
              : `ExponentPushToken[${user.userId}]`,
        },
      })
    : null;
  const notification = await prisma.notification.create({
    data: {
      userId: user.userId,
      type: "session_published",
      payload: { coach: "Coach", link: "/accueil" },
      createdAt: NOW,
      deliverAfter: NOW,
    },
  });
  const dispatch = (at = NOW) => dispatchPending(at, [notification.id]);
  const read = () =>
    prisma.notification.findUniqueOrThrow({ where: { id: notification.id }, include: { deliveries: true } });
  return { ...user, device, notification, dispatch, read };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.web.mockReset().mockResolvedValue({ statusCode: 201 });
  mocks.email.mockReset().mockResolvedValue(undefined);
  mocks.fetch.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("charges neutres", () => {
  const dispatchPain = async (platform: "web" | "ios" | null) => {
    const a = await setup(platform);
    await prisma.notification.update({
      where: { id: a.notification.id },
      data: { type: "pain_alert", payload: { athlete: "Léa", link: "/athletes/1" } },
    });
    mocks.fetch.mockResolvedValue(json({ data: { status: "ok", id: "reçu-1" } }));
    await a.dispatch();
    return a;
  };
  it("aucun mot de santé dans la charge Expo, le type est masqué", async () => {
    await dispatchPain("ios");
    const body = String(mocks.fetch.mock.calls[0]?.[1]?.body);
    expect(body).toContain('"type":"alert"');
    expect(body).not.toMatch(/pain|douleur/i);
  });
  it("aucun mot de santé dans la charge Web Push", async () => {
    await dispatchPain("web");
    const payload = String(mocks.web.mock.calls[0]?.[1]);
    expect(payload).toContain("Nouvelle alerte");
    expect(payload).not.toMatch(/pain|douleur/i);
  });
  it("aucun mot de santé dans l'e-mail de repli", async () => {
    await dispatchPain(null);
    const mail = mocks.email.mock.calls[0]?.[0];
    expect(mail?.subject).toContain("Nouvelle alerte");
    expect(JSON.stringify(mail)).not.toMatch(/pain|douleur/i);
  });
});

describe("acheminement persistant", () => {
  it("réessaie un push web 503 sans le marquer envoyé ni envoyer d'e-mail en parallèle", async () => {
    const a = await setup();
    mocks.web.mockRejectedValueOnce({ statusCode: 503 });
    await a.dispatch();
    let row = await a.read();
    expect(row.sentAt).toBeNull();
    expect(row.deliveries[0]).toMatchObject({ state: "pending", attempts: 1, errorCode: "web_push_failed" });
    await a.dispatch();
    expect(mocks.web).toHaveBeenCalledTimes(1);
    await a.dispatch(later(1));
    row = await a.read();
    expect(row.sentAt).not.toBeNull();
    expect(row.deliveries[0]).toMatchObject({ state: "accepted", attempts: 2 });
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("lit les erreurs des tickets Expo malgré HTTP 200", async () => {
    const a = await setup("ios");
    mocks.fetch.mockResolvedValueOnce(json({ data: [{ status: "error", details: { error: "MessageRateExceeded" } }] }));
    await a.dispatch();
    expect((await a.read()).deliveries[0]).toMatchObject({ state: "pending", errorCode: "expo_rate_limit" });
    expect((await a.read()).sentAt).toBeNull();
  });

  it("attend et consulte le receipt Expo sans réexpédier le push", async () => {
    const a = await setup("ios");
    mocks.fetch.mockResolvedValueOnce(json({ data: [{ status: "ok", id: "ticket1" }] }));
    await a.dispatch();
    expect((await a.read()).deliveries[0]).toMatchObject({ state: "receipt", receiptId: "ticket1" });
    expect((await a.read()).sentAt).toBeNull();
    await a.dispatch(later(14));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    mocks.fetch.mockResolvedValueOnce(json({ data: { ticket1: { status: "ok" } } }));
    await a.dispatch(later(15));
    expect(mocks.fetch.mock.calls[1]?.[0]).toContain("/getReceipts");
    expect((await a.read()).sentAt).not.toBeNull();
    await a.dispatch(later(60));
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it("un receipt manquant reste à consulter, sans renvoyer le message", async () => {
    const a = await setup("ios");
    mocks.fetch.mockResolvedValueOnce(json({ data: [{ status: "ok", id: "ticket2" }] }));
    await a.dispatch();
    mocks.fetch.mockResolvedValueOnce(json({ data: {} }));
    await a.dispatch(later(15));
    expect((await a.read()).deliveries[0]).toMatchObject({
      state: "receipt",
      receiptId: "ticket2",
      errorCode: "expo_receipt_pending",
    });
    expect(mocks.fetch.mock.calls.filter(([url]) => String(url).endsWith("/send"))).toHaveLength(1);
  });

  it("un appareil invalidé dans le receipt déclenche le repli e-mail", async () => {
    const a = await setup("ios");
    mocks.fetch.mockResolvedValueOnce(json({ data: [{ status: "ok", id: "ticket3" }] }));
    await a.dispatch();
    mocks.fetch.mockResolvedValueOnce(
      json({ data: { ticket3: { status: "error", details: { error: "DeviceNotRegistered" } } } }),
    );
    await a.dispatch(later(15));
    expect(await prisma.device.findUnique({ where: { id: a.device!.id } })).toBeNull();
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect((await a.read()).deliveries.map((d) => d.state).sort()).toEqual(["accepted", "failed"]);
  });

  it("réessaie un e-mail en échec avec la même clé d'idempotence", async () => {
    const a = await setup();
    mocks.web.mockRejectedValueOnce({ statusCode: 410 });
    mocks.email.mockRejectedValueOnce(new Error("resend unavailable"));
    await a.dispatch();
    expect((await a.read()).sentAt).toBeNull();
    const key = mocks.email.mock.calls[0]?.[0].idempotencyKey;
    await a.dispatch(later(1));
    expect(mocks.web).toHaveBeenCalledTimes(1);
    expect(mocks.email.mock.calls[1]?.[0].idempotencyKey).toBe(key);
    expect((await a.read()).sentAt).not.toBeNull();
  });

  it("ne renvoie pas aux appareils qui ont déjà accepté", async () => {
    const a = await setup();
    await prisma.device.create({
      data: { userId: a.userId, platform: "web", pushToken: '{"endpoint":"https://test.invalid/second"}' },
    });
    mocks.web.mockImplementation(async (subscription) => {
      if (subscription.endpoint.endsWith("second")) throw { statusCode: 503 };
      return { statusCode: 201 };
    });
    await a.dispatch();
    expect(mocks.web).toHaveBeenCalledTimes(2);
    mocks.web.mockResolvedValue({ statusCode: 201 });
    await a.dispatch(later(1));
    expect(mocks.web).toHaveBeenCalledTimes(3);
    expect(mocks.web.mock.calls[2]?.[0].endpoint).toContain("second");
  });

  it("deux déclencheurs concurrents ne créent ni deux lignes ni deux envois", async () => {
    const a = await setup();
    await Promise.all([a.dispatch(), a.dispatch()]);
    expect(mocks.web).toHaveBeenCalledTimes(1);
    expect((await a.read()).deliveries).toHaveLength(1);
  });

  it("reprend après l'expiration d'une réservation de traitement", async () => {
    const a = await setup();
    await prisma.notification.update({ where: { id: a.notification.id }, data: { deliveryInitializedAt: NOW } });
    await prisma.notificationDelivery.create({
      data: {
        notificationId: a.notification.id,
        targetKey: a.device!.id,
        deviceId: a.device!.id,
        channel: "web",
        nextAttemptAt: NOW,
        leaseUntil: later(2),
        leaseToken: "00000000-0000-4000-8000-000000000001",
      },
    });
    await a.dispatch();
    expect(mocks.web).not.toHaveBeenCalled();
    await a.dispatch(later(3));
    expect(mocks.web).toHaveBeenCalledTimes(1);
    expect((await a.read()).sentAt).not.toBeNull();
  });

  it("reprend la clôture après un arrêt survenu après acceptation", async () => {
    const a = await setup();
    await prisma.notification.update({ where: { id: a.notification.id }, data: { deliveryInitializedAt: NOW } });
    await prisma.notificationDelivery.create({
      data: {
        notificationId: a.notification.id,
        targetKey: a.device!.id,
        channel: "web",
        state: "accepted",
        acceptedAt: NOW,
      },
    });
    await a.dispatch();
    expect((await a.read()).deliveryCompletedAt).not.toBeNull();
    expect(mocks.web).not.toHaveBeenCalled();
  });

  it("un échec expiré reste un échec, jamais un faux envoyé", async () => {
    const a = await setup(null);
    mocks.email.mockRejectedValue(new Error("down"));
    await a.dispatch();
    await a.dispatch(later(24 * 60));
    const row = await a.read();
    expect(row.sentAt).toBeNull();
    expect(row.deliveryCompletedAt).not.toBeNull();
    expect(row.deliveries[0]?.state).toBe("failed");
    expect(mocks.email).toHaveBeenCalledTimes(1);
  });

  it("ne prévient jamais le nouveau propriétaire d'un appareil partagé", async () => {
    const a = await setup();
    mocks.web.mockRejectedValueOnce({ statusCode: 503 });
    await a.dispatch();
    const other = await makeUser("Autre");
    await prisma.device.update({ where: { id: a.device!.id }, data: { userId: other.userId } });
    await a.dispatch(later(1));
    expect(mocks.web).toHaveBeenCalledTimes(1);
    expect(mocks.email.mock.calls[0]?.[0].to).toBe(a.email);
  });

  it("isole une panne de réseau Expo et conserve la tentative", async () => {
    const a = await setup("ios");
    mocks.fetch.mockRejectedValue(new Error("network"));
    await a.dispatch();
    expect((await a.read()).deliveries[0]).toMatchObject({ state: "pending", errorCode: "expo_unavailable" });
  });

  it("respecte les heures calmes et commence le délai à l'heure prévue", async () => {
    const a = await setup();
    await prisma.notification.update({
      where: { id: a.notification.id },
      data: {
        createdAt: later(-720),
        deliverAfter: later(60),
      },
    });
    await a.dispatch();
    expect((await a.read()).deliveries).toHaveLength(0);
    await a.dispatch(later(60));
    expect(mocks.web).toHaveBeenCalledTimes(1);
    expect((await a.read()).sentAt).not.toBeNull();
  });

  it("ne renvoie pas les notifications déjà traitées avant la migration", async () => {
    const a = await setup();
    await prisma.notification.update({ where: { id: a.notification.id }, data: { sentAt: NOW } });
    await a.dispatch();
    expect(mocks.web).not.toHaveBeenCalled();
    expect((await a.read()).deliveries).toHaveLength(0);
  });

  it("termine un commentaire sans appareil sans prétendre l'avoir envoyé", async () => {
    const a = await setup(null);
    await prisma.notification.update({ where: { id: a.notification.id }, data: { type: "comment" } });
    await a.dispatch();
    expect((await a.read()).deliveryCompletedAt).not.toBeNull();
    expect((await a.read()).sentAt).toBeNull();
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("passe à l'e-mail après l'expiration des essais push sans renvoyer le push", async () => {
    const a = await setup();
    mocks.web.mockRejectedValue({ statusCode: 503 });
    await a.dispatch();
    await a.dispatch(later(360));
    expect(mocks.web).toHaveBeenCalledTimes(1);
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect((await a.read()).sentAt).not.toBeNull();
  });
});
