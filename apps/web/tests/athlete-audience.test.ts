import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { saveAthlete } from "@/server/athlete.service";
import { getAthleteCalendar, logSession } from "@/server/athlete-view.service";
import { removeAthlete, leaveOrganization } from "@/server/members.service";
import { closeOverdueSessions } from "@/server/cron.service";
import { deleteGroup } from "@/server/org.service";
import { audienceAthleteIds, publishRow, saveScheduledSession } from "@/server/session.service";
import { getTrackingGrid, getAlerts } from "@/server/tracking.service";
import { icalFeed, icalLink } from "@/server/ical.service";
import { makeOrg, addAthlete, addStaff } from "./helpers";

const NOW = new Date("2030-06-12T10:00:00Z");
const prepare = async () => {
  const org = await makeOrg("Audience");
  const athlete = await addAthlete(org.organizationId, org.groupId, "Présent", {
    joinedAt: new Date("2030-06-01T10:00:00Z"),
  });
  const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: org.organizationId } });
  const schedule = async (date: string, direct = false) => {
    const s = await saveScheduledSession(org.owner.userId, org.organizationId, {
      date,
      startTime: "18:00",
      location: "Stade",
      publishAt: null,
      draft: {
        title: `Audience ${date}`,
        type: "strength",
        durationMin: 60,
        coachNote: null,
        blocks: [
          { name: "Corps", variant: "club", items: [{ exerciseId: exercise.id, prescription: { sets: 3, reps: 5 } }] },
        ],
      },
      assignments: [{ targetType: direct ? "athlete" : "group", targetId: direct ? athlete.athleteId : org.groupId }],
      overrides: [],
    });
    await publishRow(s.id, org.owner.userId, new Date("2030-06-01T10:00:00Z"), { silent: true });
    return s;
  };
  return { ...org, athlete, schedule };
};

describe("groupes et audience", () => {
  it("retire les groupes décochés, puis permet de retirer tous les groupes", async () => {
    const a = await prepare();
    const other = await prisma.group.create({ data: { organizationId: a.organizationId, name: "Autre" } });
    await saveAthlete(a.owner.userId, a.organizationId, {
      id: a.athlete.athleteId,
      firstName: "Présent",
      lastName: "Test",
      groupIds: [other.id],
    });
    expect(
      (await prisma.groupMember.findMany({ where: { athleteId: a.athlete.athleteId } })).map((g) => g.groupId),
    ).toEqual([other.id]);
    await saveAthlete(a.owner.userId, a.organizationId, {
      id: a.athlete.athleteId,
      firstName: "Présent",
      lastName: "Test",
      groupIds: [],
    });
    expect(await prisma.groupMember.count({ where: { athleteId: a.athlete.athleteId } })).toBe(0);
  });
  it("un coach retire son groupe sans modifier celui d'un collègue ni en ajouter hors de son périmètre", async () => {
    const a = await prepare();
    const other = await prisma.group.create({ data: { organizationId: a.organizationId, name: "Collègue" } });
    await prisma.groupMember.create({ data: { athleteId: a.athlete.athleteId, groupId: other.id } });
    const coach = await addStaff(a.organizationId, "Coach", "coach", [a.groupId]);
    const forbidden = await prisma.group.create({ data: { organizationId: a.organizationId, name: "Interdit" } });
    const data = { id: a.athlete.athleteId, firstName: "Présent", lastName: "Test" };
    await expect(
      saveAthlete(coach.userId, a.organizationId, { ...data, groupIds: [forbidden.id] }),
    ).rejects.toMatchObject({ status: 403 });
    await saveAthlete(coach.userId, a.organizationId, { ...data, groupIds: [] });
    expect(
      (await prisma.groupMember.findMany({ where: { athleteId: a.athlete.athleteId } })).map((g) => g.groupId),
    ).toEqual([other.id]);
  });
  it("retirer un destinataire individuel nettoie l'attribution et n'arrête plus les autres séances", async () => {
    const a = await prepare();
    const direct = await a.schedule("2030-06-09", true);
    await removeAthlete(a.owner.userId, a.organizationId, a.athlete.athleteId);
    expect(await prisma.assignment.count({ where: { scheduledSessionId: direct.id } })).toBe(0);
    // Résidu ancien, et même une référence à un athlète d'un autre espace : aucun ne devient une audience.
    const b = await prepare();
    await prisma.assignment.createMany({
      data: [randomUUID(), b.athlete.athleteId].map((targetId) => ({
        scheduledSessionId: direct.id,
        targetType: "athlete",
        targetId,
      })),
    });
    expect(await audienceAthleteIds(direct.id)).toEqual([]);
    const good = await b.schedule("2030-06-10");
    await closeOverdueSessions(NOW);
    expect(
      await prisma.sessionLog.findUnique({
        where: { scheduledSessionId_athleteId: { scheduledSessionId: good.id, athleteId: b.athlete.athleteId } },
      }),
    ).toMatchObject({ status: "missed" });
  });
  it("quitter un espace et supprimer un groupe nettoient aussi les attributions", async () => {
    const a = await prepare();
    const direct = await a.schedule("2030-06-10", true);
    await leaveOrganization(a.athlete.userId, a.organizationId);
    expect(await prisma.assignment.count({ where: { scheduledSessionId: direct.id } })).toBe(0);
    const grouped = await a.schedule("2030-06-11");
    await deleteGroup(a.owner.userId, a.organizationId, a.groupId);
    expect(await prisma.assignment.count({ where: { scheduledSessionId: grouped.id } })).toBe(0);
  });
  it("un nouvel arrivant ne reçoit ni séances passées, ni manqués, ni alertes fantômes", async () => {
    const a = await prepare();
    const past = await a.schedule("2030-06-10");
    const current = await a.schedule("2030-06-12");
    const late = await addAthlete(a.organizationId, a.groupId, "Nouveau", { joinedAt: NOW });
    expect(await audienceAthleteIds(past.id)).not.toContain(late.athleteId);
    expect(await audienceAthleteIds(current.id)).toContain(late.athleteId);
    await closeOverdueSessions(NOW);
    expect(await prisma.sessionLog.count({ where: { athleteId: late.athleteId } })).toBe(0);
    const calendar = await getAthleteCalendar(
      late.userId,
      a.organizationId,
      { from: "2030-06-10", to: "2030-06-16" },
      NOW,
    );
    expect(calendar.sessions.map((s) => s.id)).toEqual([current.id]);
    const grid = await getTrackingGrid(a.owner.userId, a.organizationId, { week: "2030-06-10" }, NOW);
    expect(
      grid.rows.find((row) => row.athleteId === late.athleteId)?.cells.find((cell) => cell.sessionId === past.id)
        ?.status,
    ).toBeNull();
    expect(
      (await getAlerts(a.owner.userId, a.organizationId, NOW)).filter((alert) => alert.athleteId === late.athleteId),
    ).toEqual([]);
    const link = await icalLink(late.userId, a.organizationId);
    const feed = await icalFeed(late.athleteId, link.split("/").at(-1)!, NOW);
    expect(feed).not.toContain("Audience 2030-06-10");
    expect(feed).toContain("Audience 2030-06-12");
  });
  it("les validations restent consultables après le retrait du groupe", async () => {
    const a = await prepare();
    const session = await a.schedule("2030-06-10");
    await logSession(a.athlete.userId, a.organizationId, session.id, {
      clientId: randomUUID(),
      status: "done",
      variantDone: "club",
    });
    await saveAthlete(a.owner.userId, a.organizationId, {
      id: a.athlete.athleteId,
      firstName: "Présent",
      lastName: "Test",
      groupIds: [],
    });
    expect(await audienceAthleteIds(session.id)).toContain(a.athlete.athleteId);
    const calendar = await getAthleteCalendar(
      a.athlete.userId,
      a.organizationId,
      { from: "2030-06-10", to: "2030-06-16" },
      NOW,
    );
    expect(calendar.sessions.map((s) => s.id)).toContain(session.id);
    const grid = await getTrackingGrid(a.owner.userId, a.organizationId, { week: "2030-06-10" }, NOW);
    expect(
      grid.rows.find((r) => r.athleteId === a.athlete.athleteId)?.cells.find((c) => c.sessionId === session.id)?.status,
    ).toBe("done");
  });

  it("une panne sur une séance ne bloque pas le traitement des suivantes", async () => {
    const a = await prepare();
    await a.schedule("2030-06-08");
    const following = await a.schedule("2030-06-09");
    const spy = vi.spyOn(prisma.sessionLog, "createMany").mockRejectedValueOnce(new Error("panne locale"));
    try {
      await expect(closeOverdueSessions(NOW)).rejects.toThrow("cron_sessions_close_failed");
    } finally {
      spy.mockRestore();
    }
    expect(
      await prisma.sessionLog.findUnique({
        where: {
          scheduledSessionId_athleteId: {
            scheduledSessionId: following.id,
            athleteId: a.athlete.athleteId,
          },
        },
      }),
    ).toMatchObject({ status: "missed" });
  });

  it("le jour d'arrivée suit Paris, et modifier la fiche ne réinitialise pas cette date", async () => {
    const a = await prepare();
    const previous = await a.schedule("2030-06-11");
    const today = await a.schedule("2030-06-12");
    const joinedAt = new Date("2030-06-11T22:30:00Z"); // 12 juin à Paris.
    const late = await addAthlete(a.organizationId, a.groupId, "Minuit", { joinedAt });
    await saveAthlete(a.owner.userId, a.organizationId, {
      id: late.athleteId,
      firstName: "Minuit",
      lastName: "Test",
      groupIds: [a.groupId],
    });
    expect(
      (
        await prisma.groupMember.findUniqueOrThrow({
          where: { groupId_athleteId: { groupId: a.groupId, athleteId: late.athleteId } },
        })
      ).createdAt,
    ).toEqual(joinedAt);
    expect(await audienceAthleteIds(previous.id)).not.toContain(late.athleteId);
    expect(await audienceAthleteIds(today.id)).toContain(late.athleteId);
    await expect(
      logSession(late.userId, a.organizationId, previous.id, {
        clientId: randomUUID(),
        status: "done",
        variantDone: "club",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
