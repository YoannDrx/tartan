import { describe, expect, it } from "vitest";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { addDays } from "@tartan/domain";
import { listReports, reportContent, resolveReport } from "@/server/comm.service";
import { closeOverdueSessions, publishScheduledSessions } from "@/server/cron.service";
import { offlineUrls } from "@/server/offline.service";
import { dispatchPending, notify, webLink } from "@/server/notify.service";
import { saveExercise } from "@/server/exercise.service";
import { publishSession, saveScheduledSession } from "@/server/session.service";
import { addAthlete, addStaff, makeOrg } from "./helpers";

const NOON = new Date("2026-06-10T10:00:00Z");
const draftWith = (exerciseId: string, title: string) => ({
  title,
  type: "strength" as const,
  durationMin: 60,
  coachNote: null,
  blocks: [{ name: "Corps", variant: "club" as const, items: [{ exerciseId, prescription: { sets: 3, reps: 5 } }] }],
});

const prepare = async () => {
  const org = await makeOrg("Thomas");
  const lea = await addAthlete(org.organizationId, org.groupId, "Léa");
  const exercise = await saveExercise(org.owner.userId, org.organizationId, {
    name: "Squat",
    category: "strength",
    cues: ["Dos droit"],
  });
  const schedule = (date: string, title: string, publishAt: string | null) =>
    saveScheduledSession(org.owner.userId, org.organizationId, {
      date,
      startTime: "18:00",
      location: "Stade",
      draft: draftWith(exercise.id, title),
      assignments: [{ targetType: "group", targetId: org.groupId }],
      overrides: [],
      publishAt,
    });
  return { ...org, lea, schedule };
};

describe("notifications", () => {
  it("une semaine programmée d'un coup ne donne qu'une notification par athlète", async () => {
    const a = await prepare();
    for (const day of ["2026-06-15", "2026-06-16", "2026-06-17"]) {
      await a.schedule(day, `Séance ${day}`, "2026-06-10T09:00:00.000Z");
    }
    await publishScheduledSessions(NOON);
    const sent = await prisma.notification.findMany({ where: { userId: a.lea.userId } });
    expect(sent.map((n) => n.type)).toEqual(["session_batch_published"]);
    expect(sent[0]?.payload).toMatchObject({ count: 3, link: "/accueil" });
  });

  it("un brouillon sans destinataire ne bloque pas les autres séances programmées", async () => {
    const a = await prepare();
    const lone = await a.schedule("2026-06-15", "Seule", "2026-06-10T09:00:00.000Z");
    const empty = await a.schedule("2026-06-16", "Vide", "2026-06-10T09:00:00.000Z");
    await prisma.assignment.deleteMany({ where: { scheduledSessionId: empty.id } });
    expect(await publishScheduledSessions(NOON)).toBe(1);
    expect((await prisma.scheduledSession.findUniqueOrThrow({ where: { id: lone.id } })).publishedAt).toBeTruthy();
  });

  it("prévient par e-mail qui n'a aucun appareil, jamais qui en a un", async () => {
    const a = await prepare();
    const withDevice = await addAthlete(a.organizationId, a.groupId, "Hugo");
    await prisma.device.create({
      data: { userId: withDevice.userId, pushToken: `{"endpoint":"${withDevice.userId}"}`, platform: "web" },
    });
    const lea = await prisma.user.findUniqueOrThrow({ where: { id: a.lea.userId } });
    const hugo = await prisma.user.findUniqueOrThrow({ where: { id: withDevice.userId } });
    await notify(
      [lea.id, hugo.id],
      "announcement",
      { coach: "Thomas", organizationId: a.organizationId, link: "/annonces" },
      NOON,
    );
    await dispatchPending(NOON);
    const mail = outbox.find((m) => m.to === lea.email);
    expect(mail?.html).toContain(`espace=${a.organizationId}`);
    expect(outbox.some((m) => m.to === hugo.email)).toBe(false);
  });

  it("garde l'espace dans le lien", () => {
    expect(webLink("/annonces", "org")).toBe("/annonces?espace=org");
    expect(webLink("/a?b=1", "org")).toBe("/a?b=1&espace=org");
    expect(webLink(undefined, "org")).toBeUndefined();
  });

  it("alerte le coach une seule fois à la 2e séance manquée", async () => {
    const a = await prepare();
    await prisma.groupCoach.createMany({
      data: [{ groupId: a.groupId, userId: a.owner.userId, role: "lead" }],
      skipDuplicates: true,
    });
    const dates = ["2026-06-01", "2026-06-02", "2026-06-03"];
    for (const date of dates) {
      const session = await a.schedule(date, `Séance ${date}`, null);
      await prisma.scheduledSession.update({
        where: { id: session.id },
        data: { publishedAt: new Date(`${addDays(date, -1)}T10:00:00Z`) },
      });
    }
    await closeOverdueSessions(NOON);
    const alerts = await prisma.notification.findMany({ where: { userId: a.owner.userId, type: "missed_streak" } });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.payload).toMatchObject({ athlete: "Léa" });
  });
});

describe("signalements", () => {
  it("prévient le responsable, qui garde ou supprime ; un autre rôle n'y a pas accès", async () => {
    const a = await prepare();
    const video = await prisma.video.create({
      data: {
        organizationId: a.organizationId,
        athleteId: a.lea.athleteId,
        uploadedBy: a.owner.userId,
        status: "ready",
      },
    });
    await reportContent(a.lea.userId, a.organizationId, {
      entityType: "video",
      entityId: video.id,
      reason: "inappropriate",
    });
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: a.owner.userId } });
    expect(outbox.some((m) => m.to === owner.email && m.subject.includes("signalé"))).toBe(true);
    const coach = await addStaff(a.organizationId, "Adjoint", "coach");
    await expect(listReports(coach.userId, a.organizationId)).rejects.toMatchObject({ status: 403 });
    const [report] = await listReports(a.owner.userId, a.organizationId);
    expect(report).toMatchObject({ entityType: "video", excerpt: "Léa Test" });
    await resolveReport(a.owner.userId, a.organizationId, { id: report?.id as string, removeContent: true });
    expect(await prisma.video.findUnique({ where: { id: video.id } })).toBeNull();
    expect(await listReports(a.owner.userId, a.organizationId)).toEqual([]);
  });
});

describe("hors ligne", () => {
  it("garde les séances attribuées à l'athlète, sans celles du reste de l'espace", async () => {
    const a = await prepare();
    const today = new Date().toISOString().slice(0, 10);
    const mine = await a.schedule(addDays(today, 2), "Pour Léa", null);
    await publishSession(a.owner.userId, a.organizationId, mine.id);
    const hugo = await addAthlete(a.organizationId, null, "Hugo");
    const other = await a.schedule(addDays(today, 3), "Pour Hugo", null);
    await prisma.assignment.updateMany({
      where: { scheduledSessionId: other.id },
      data: { targetType: "athlete", targetId: hugo.athleteId },
    });
    await publishSession(a.owner.userId, a.organizationId, other.id);
    const { urls } = await offlineUrls(a.lea.userId, a.organizationId);
    expect(urls).toContain(`/seance/${mine.id}`);
    expect(urls).not.toContain(`/seance/${other.id}`);
  });
});
