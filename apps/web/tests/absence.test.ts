import { absenceReason } from "@tartan/contracts";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { setMyAttendance } from "@/server/athlete-view.service";
import { publishRow, saveScheduledSession } from "@/server/session.service";
import { addAthlete, makeOrg } from "./helpers";

const NOW = new Date("2030-06-08T10:00:00Z");

const prepare = async (date = "2030-06-10") => {
  const org = await makeOrg("Absence");
  const athlete = await addAthlete(org.organizationId, org.groupId, "Léa");
  const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: org.organizationId } });
  const saved = await saveScheduledSession(org.owner.userId, org.organizationId, {
    date,
    startTime: "18:00",
    location: "Stade",
    publishAt: null,
    draft: {
      title: "Séance",
      type: "strength",
      durationMin: 60,
      coachNote: null,
      blocks: [{ name: "Corps", variant: "club", items: [{ exerciseId: exercise.id, prescription: { sets: 3 } }] }],
    },
    assignments: [{ targetType: "group", targetId: org.groupId }],
    overrides: [],
  });
  await publishRow(saved.id, org.owner.userId, new Date("2020-01-01T10:00:00Z"), { silent: true });
  const absences = () =>
    prisma.notification.findMany({ where: { userId: org.owner.userId, type: "absence_reported" } });
  const row = () =>
    prisma.attendance.findUniqueOrThrow({
      where: { scheduledSessionId_athleteId: { scheduledSessionId: saved.id, athleteId: athlete.athleteId } },
    });
  const answer = (status: "present" | "absent", reason?: (typeof absenceReason.options)[number], now = NOW) =>
    setMyAttendance(athlete.userId, org.organizationId, saved.id, status, reason, now);
  return { org, saved, absences, row, answer };
};

describe("absence signalée par l'athlète", () => {
  it("le motif est une liste fermée, sans aucune donnée de santé", () => {
    expect(absenceReason.options).toEqual(["work", "studies", "transport", "family", "other"]);
    expect(absenceReason.options.join(" ")).not.toMatch(/sant|health|injur|bless|ill|malad|pain|douleur|sick/i);
  });

  it("le coach est prévenu une fois, et le motif ajouté ensuite ne le dérange pas de nouveau", async () => {
    const { absences, row, answer, saved } = await prepare();
    await answer("absent");
    const [notice] = await absences();
    expect(notice?.payload).toMatchObject({ athlete: "Léa", date: "2030-06-10", link: `/seances/${saved.id}/suivi` });
    // Le motif n'entre jamais dans la notification : il reste dans le suivi.
    expect(JSON.stringify(notice?.payload)).not.toMatch(/work|transport|family/);
    await answer("absent", "transport");
    expect(await absences()).toHaveLength(1);
    expect((await row()).absenceReason).toBe("transport");
  });

  it("« je viens » efface le motif, et une nouvelle absence prévient de nouveau", async () => {
    const { absences, row, answer } = await prepare();
    await answer("absent", "work");
    await answer("present", "work");
    expect(await row()).toMatchObject({ status: "present", absenceReason: null });
    await answer("absent");
    expect(await absences()).toHaveLength(2);
  });

  it("une séance déjà passée ne déclenche aucune notification", async () => {
    const { absences, answer } = await prepare("2030-06-01");
    await answer("absent", "family");
    expect(await absences()).toHaveLength(0);
  });
});
