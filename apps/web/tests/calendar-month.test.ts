import { randomUUID } from "node:crypto";
import { rangeQuery } from "@tartan/contracts";
import { describe, expect, it } from "vitest";
import { getAthleteCalendar, logSession } from "@/server/athlete-view.service";
import { prisma } from "@/lib/prisma";
import { getCalendarView, getMe, updatePreferences } from "@/server/me.service";
import { audienceAthleteIds, listCalendar, publishRow, saveScheduledSession } from "@/server/session.service";
import { addAthlete, makeOrg } from "./helpers";

const NOW = new Date("2030-06-12T10:00:00Z");

const prepare = async () => {
  const org = await makeOrg("Mois");
  const first = await addAthlete(org.organizationId, org.groupId, "Ana", {
    joinedAt: new Date("2030-06-01T10:00:00Z"),
  });
  const second = await addAthlete(org.organizationId, org.groupId, "Ben", {
    joinedAt: new Date("2030-06-01T10:00:00Z"),
  });
  const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: org.organizationId } });
  const schedule = async (date: string, assignments: { targetType: "group" | "athlete"; targetId: string }[]) => {
    const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
      date,
      startTime: "18:00",
      location: "Stade",
      publishAt: null,
      draft: {
        title: `Séance ${date}`,
        type: "strength",
        durationMin: 45,
        coachNote: null,
        blocks: [
          { name: "Corps", variant: "club", items: [{ exerciseId: exercise.id, prescription: { sets: 3, reps: 5 } }] },
        ],
      },
      assignments,
      overrides: [],
    });
    await publishRow(session.id, org.owner.userId, new Date("2030-06-01T10:00:00Z"), { silent: true });
    return session;
  };
  return { ...org, first, second, schedule };
};

describe("calendrier au mois", () => {
  it("refuse une période inversée ou sans borne", () => {
    expect(rangeQuery.safeParse({ from: "2030-06-01", to: "2030-07-12" }).success).toBe(true);
    expect(rangeQuery.safeParse({ from: "2030-06-02", to: "2030-06-01" }).success).toBe(false);
    expect(rangeQuery.safeParse({ from: "2030-01-01", to: "2030-12-31" }).success).toBe(false);
  });

  it("résume la réalisation avec la même audience que le calcul séance par séance", async () => {
    const { owner, organizationId, groupId, first, schedule } = await prepare();
    const session = await schedule("2030-06-10", [{ targetType: "group", targetId: groupId }]);
    await logSession(first.userId, organizationId, session.id, {
      clientId: randomUUID(),
      status: "done",
      variantDone: "club",
      sets: [],
    });

    const plain = await listCalendar(owner.userId, organizationId, { from: "2030-06-01", to: "2030-06-30" });
    expect(plain.sessions[0]?.completion).toBeUndefined();

    const month = await listCalendar(owner.userId, organizationId, {
      from: "2030-06-01",
      to: "2030-06-30",
      summary: true,
    });
    const audience = await audienceAthleteIds(session.id);
    expect(month.sessions[0]).toMatchObject({
      durationMin: 45,
      exerciseCount: 1,
      completion: { done: 1, partial: 0, missed: 0, total: audience.length },
    });
    expect(audience).toHaveLength(2);
  });

  it("garde dans le filtre de groupe une séance attribuée à l'un de ses membres", async () => {
    const { owner, organizationId, groupId, first, schedule } = await prepare();
    const direct = await schedule("2030-06-11", [{ targetType: "athlete", targetId: first.athleteId }]);
    const other = await addAthlete(organizationId, null, "Hors");
    await schedule("2030-06-12", [{ targetType: "athlete", targetId: other.athleteId }]);
    const { sessions } = await listCalendar(owner.userId, organizationId, {
      from: "2030-06-01",
      to: "2030-06-30",
      groupId,
    });
    expect(sessions.map((s) => s.id)).toEqual([direct.id]);
  });

  it("n'efface pas tout le mois pour une séance au contenu illisible", async () => {
    const { organizationId, groupId, first, schedule } = await prepare();
    const good = await schedule("2030-06-10", [{ targetType: "group", targetId: groupId }]);
    const broken = await schedule("2030-06-11", [{ targetType: "group", targetId: groupId }]);
    await prisma.scheduledSession.update({ where: { id: broken.id }, data: { snapshot: { invalide: true } } });
    const { sessions } = await getAthleteCalendar(
      first.userId,
      organizationId,
      { from: "2030-06-01", to: "2030-06-30" },
      NOW,
    );
    expect(sessions.map((s) => s.id)).toEqual([good.id]);
  });

  it("suit le choix de vue sans qu'un appareil revenu du hors-ligne écrase un choix récent", async () => {
    const { owner } = await makeOrg("Vue");
    await updatePreferences(owner.userId, { calendarView: "month", calendarViewUpdatedAt: "2030-06-12T10:00:00.000Z" });
    await updatePreferences(owner.userId, { calendarView: "list", calendarViewUpdatedAt: "2030-06-11T10:00:00.000Z" });
    expect(await getCalendarView(owner.userId)).toBe("month");
    expect((await getMe(owner.userId)).preferences?.calendarView).toBe("month");
  });
});
