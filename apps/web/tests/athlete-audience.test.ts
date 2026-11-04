import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { saveAthlete } from "@/server/athlete.service";
import { getAthleteCalendar, logSession } from "@/server/athlete-view.service";
import { removeAthlete, leaveOrganization } from "@/server/members.service";
import { closeOverdueSessions } from "@/server/cron.service";
import { deleteGroup } from "@/server/org.service";
import {
  activeAudienceIds,
  audienceAthleteIds,
  deleteSession,
  duplicateSession,
  getSessionForEdit,
  listCalendar,
  publishRow,
  saveScheduledSession,
} from "@/server/session.service";
import {
  coachLogSession,
  getAlerts,
  getSessionDetailForCoach,
  getTrackingGrid,
  remindAthletes,
  takeRollCall,
} from "@/server/tracking.service";
import { icalFeed, icalLink, revokeIcalLink } from "@/server/ical.service";
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
      birthDate: "2000-01-01",
      groupIds: [other.id],
    });
    expect(
      (await prisma.groupMember.findMany({ where: { athleteId: a.athlete.athleteId } })).map((g) => g.groupId),
    ).toEqual([other.id]);
    await saveAthlete(a.owner.userId, a.organizationId, {
      id: a.athlete.athleteId,
      firstName: "Présent",
      lastName: "Test",
      birthDate: "2000-01-01",
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
    const data = { id: a.athlete.athleteId, firstName: "Présent", lastName: "Test", birthDate: "2000-01-01" };
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
  it("un ancien membre avec un log manqué n'est plus sollicité, mais reste dans l'historique", async () => {
    const a = await prepare();
    const past = await a.schedule("2030-06-10");
    await closeOverdueSessions(NOW);
    await prisma.groupMember.deleteMany({ where: { athleteId: a.athlete.athleteId } });
    expect(await audienceAthleteIds(past.id)).toContain(a.athlete.athleteId);
    expect(await activeAudienceIds(past.id)).not.toContain(a.athlete.athleteId);
    const before = await prisma.notification.count({ where: { userId: a.athlete.userId } });
    await remindAthletes(a.owner.userId, a.organizationId, past.id, undefined, NOW);
    expect(await prisma.notification.count({ where: { userId: a.athlete.userId } })).toBe(before);
    await takeRollCall(a.owner.userId, a.organizationId, past.id, {
      entries: [{ athleteId: a.athlete.athleteId, status: "absent" }],
    });
    expect(await prisma.attendance.count({ where: { scheduledSessionId: past.id } })).toBe(0);
  });
  it("une séance à l'attribution orpheline se réenregistre", async () => {
    const a = await prepare();
    const session = await a.schedule("2030-06-20");
    await prisma.assignment.create({
      data: { scheduledSessionId: session.id, targetType: "group", targetId: randomUUID() },
    });
    const edit = await getSessionForEdit(a.owner.userId, a.organizationId, session.id);
    expect(edit.assignments).toEqual([{ targetType: "group", targetId: a.groupId }]);
    await expect(saveScheduledSession(a.owner.userId, a.organizationId, { ...edit })).resolves.toMatchObject({
      id: session.id,
    });
  });
  it("supprimer le dernier groupe d'un brouillon programmé annule sa publication", async () => {
    const a = await prepare();
    const other = await prisma.group.create({ data: { organizationId: a.organizationId, name: "Autre" } });
    const save = (targetIds: string[]) =>
      prisma.scheduledSession
        .create({
          data: {
            organizationId: a.organizationId,
            createdBy: a.owner.userId,
            date: new Date("2030-07-01T00:00:00Z"),
            startTime: "18:00",
            title: "Brouillon",
            type: "strength",
            draft: {},
            publishAt: new Date("2030-06-30T10:00:00Z"),
            assignments: { create: targetIds.map((targetId) => ({ targetType: "group" as const, targetId })) },
          },
        })
        .then((row) => row.id);
    const alone = await save([a.groupId]);
    const shared = await save([a.groupId, other.id]);
    await deleteGroup(a.owner.userId, a.organizationId, a.groupId);
    expect((await prisma.scheduledSession.findUniqueOrThrow({ where: { id: alone } })).publishAt).toBeNull();
    expect((await prisma.scheduledSession.findUniqueOrThrow({ where: { id: shared } })).publishAt).not.toBeNull();
  });
  it("saveAthlete signale qu'un coach vient de sortir l'athlète de son périmètre", async () => {
    const a = await prepare();
    const coach = await addStaff(a.organizationId, "Coach", "coach", [a.groupId]);
    const result = await saveAthlete(coach.userId, a.organizationId, {
      id: a.athlete.athleteId,
      firstName: "Présent",
      lastName: "Test",
      birthDate: "2000-01-01",
      groupIds: [],
    });
    expect(result).toEqual({ id: a.athlete.athleteId, stillVisible: false });
  });
  it("le flux d'agenda échappe le texte, donne une fin, et son lien se révoque", async () => {
    const a = await prepare();
    await a.schedule("2030-06-20");
    await prisma.scheduledSession.updateMany({
      where: { organizationId: a.organizationId },
      data: { title: "Force; bas, haut" },
    });
    const link = await icalLink(a.athlete.userId, a.organizationId);
    const token = link.split("/").at(-1)!;
    const feed = await icalFeed(a.athlete.athleteId, token, NOW);
    expect(feed).toContain("SUMMARY:Force\\; bas\\, haut");
    expect(feed).toContain("DTSTART;TZID=Europe/Paris:20300620T180000");
    expect(feed).toContain("DTEND;TZID=Europe/Paris:20300620T190000");
    await revokeIcalLink(a.athlete.userId, a.organizationId);
    await expect(icalFeed(a.athlete.athleteId, token, NOW)).rejects.toThrow();
    const fresh = await icalLink(a.athlete.userId, a.organizationId);
    await expect(icalFeed(a.athlete.athleteId, fresh.split("/").at(-1)!, NOW)).resolves.toContain("BEGIN:VCALENDAR");
  });
  it("l'athlète ne voit ni brouillon ni compétition d'un autre dans le calendrier", async () => {
    const a = await prepare();
    const published = await a.schedule("2030-06-20");
    const draft = await saveScheduledSession(a.owner.userId, a.organizationId, {
      date: "2030-06-21",
      startTime: "18:00",
      location: "Stade",
      publishAt: null,
      draft: { title: "Brouillon", type: "strength", durationMin: 60, coachNote: null, blocks: [] },
      assignments: [{ targetType: "athlete", targetId: a.athlete.athleteId }],
      overrides: [],
    });
    const other = await prisma.competition.create({
      data: { organizationId: a.organizationId, name: "Autre", date: new Date("2030-06-22T00:00:00Z") },
    });
    const mine = await prisma.competition.create({
      data: {
        organizationId: a.organizationId,
        name: "La mienne",
        date: new Date("2030-06-23T00:00:00Z"),
        athletes: { create: { athleteId: a.athlete.athleteId } },
      },
    });
    const range = { from: "2030-06-19", to: "2030-06-24" };
    const seen = await listCalendar(a.athlete.userId, a.organizationId, range);
    expect(seen.sessions.map((s) => s.id)).toEqual([published.id]);
    expect(seen.competitions.map((c) => c.id)).toEqual([mine.id]);
    const coach = await listCalendar(a.owner.userId, a.organizationId, range);
    expect(coach.sessions.map((s) => s.id)).toContain(draft.id);
    expect(coach.competitions.map((c) => c.id)).toContain(other.id);
  });
  it("supprimer une séance publiée à venir prévient ses athlètes, sans mot de santé", async () => {
    const a = await prepare();
    const future = "2030-06-20";
    const session = await a.schedule(future);
    await deleteSession(a.owner.userId, a.organizationId, session.id);
    const sent = await prisma.notification.findFirstOrThrow({
      where: { userId: a.athlete.userId, type: "session_cancelled" },
    });
    expect(sent.payload).toMatchObject({ date: future, organizationId: a.organizationId });
  });
  it("supprimer une séance passée ne prévient personne", async () => {
    const a = await prepare();
    const session = await a.schedule("2020-01-10");
    await deleteSession(a.owner.userId, a.organizationId, session.id);
    expect(await prisma.notification.count({ where: { userId: a.athlete.userId, type: "session_cancelled" } })).toBe(0);
  });
  it("une fiche sans compte est « sans retour », sans relance, et le coach peut valider pour elle", async () => {
    const a = await prepare();
    const sheet = await prisma.athlete.create({
      data: {
        organizationId: a.organizationId,
        firstName: "Sans",
        lastName: "Compte",
        birthDate: new Date("2000-01-01T00:00:00Z"),
        groups: { create: { groupId: a.groupId, createdAt: new Date("2030-06-01T10:00:00Z") } },
      },
    });
    const session = await a.schedule("2030-06-10");
    await closeOverdueSessions(NOW);
    expect(await prisma.sessionLog.count({ where: { athleteId: sheet.id } })).toBe(0);
    const detail = await getSessionDetailForCoach(a.owner.userId, a.organizationId, session.id, NOW);
    expect(detail.athletes.find((x) => x.athleteId === sheet.id)).toMatchObject({
      status: "no_return",
      hasAccount: false,
    });
    await coachLogSession(a.owner.userId, a.organizationId, session.id, sheet.id, "partial");
    const after = await getSessionDetailForCoach(a.owner.userId, a.organizationId, session.id, NOW);
    expect(after.athletes.find((x) => x.athleteId === sheet.id)?.status).toBe("partial");
    await expect(
      coachLogSession(a.owner.userId, a.organizationId, session.id, a.athlete.athleteId, "done"),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("dupliquer une séance copie ses adaptations", async () => {
    const a = await prepare();
    const session = await a.schedule("2030-06-20");
    await prisma.athleteOverride.create({
      data: {
        scheduledSessionId: session.id,
        athleteId: a.athlete.athleteId,
        itemRef: "b0-i0",
        prescription: { load: 80 },
      },
    });
    const copy = await duplicateSession(a.owner.userId, a.organizationId, session.id, "2030-06-27");
    expect(await prisma.athleteOverride.count({ where: { scheduledSessionId: copy.id } })).toBe(1);
  });
  it("corriger une validation retire la douleur saisie par erreur", async () => {
    const a = await prepare();
    const session = await a.schedule("2030-06-10");
    const base = { clientId: randomUUID(), status: "done" as const, variantDone: "club" as const, sets: [] };
    await logSession(a.athlete.userId, a.organizationId, session.id, {
      ...base,
      pain: { bodyArea: "knee", side: "left", intensity: 5 },
    });
    await logSession(a.athlete.userId, a.organizationId, session.id, { ...base, clientId: randomUUID() });
    const log = await prisma.sessionLog.findFirstOrThrow({ where: { scheduledSessionId: session.id } });
    expect(log.pain).toBeNull();
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
      birthDate: "2000-01-01",
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
      birthDate: "2000-01-01",
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
