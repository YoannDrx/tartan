import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { landingIndex, moveInPlanning } from "@/features/sessions/planning-order";
import { listCalendar, listPlanning, moveSession, saveScheduledSession } from "@/server/session.service";
import { addStaff, makeOrg } from "./helpers";

describe("ordre du planning après un déplacement", () => {
  const week = [
    { id: "matin", date: "2030-06-10", startTime: "09:00" },
    { id: "soir", date: "2030-06-10", startTime: "18:00" },
    { id: "libre", date: "2030-06-10", startTime: null },
    { id: "midi", date: "2030-06-11", startTime: "12:00" },
  ];

  it("range la séance déplacée à son heure, comme le serveur le fera", () => {
    const moved = moveInPlanning(week, "midi", "2030-06-10");
    expect(moved.map((session) => session.id)).toEqual(["matin", "midi", "soir", "libre"]);
    expect(landingIndex(week, "midi", "2030-06-10")).toBe(1);
  });

  it("place une séance sans heure en fin de journée, et une première séance en tête", () => {
    expect(landingIndex(week, "libre", "2030-06-11")).toBe(1);
    expect(landingIndex(week, "matin", "2030-06-11")).toBe(0);
    expect(landingIndex(week, "midi", "2030-06-12")).toBe(0);
  });

  it("ne touche ni aux autres séances ni à la liste d'origine", () => {
    const moved = moveInPlanning(week, "soir", "2030-06-12");
    expect(week[1]).toEqual({ id: "soir", date: "2030-06-10", startTime: "18:00" });
    expect(moved.filter((session) => session.date === "2030-06-10").map((session) => session.id)).toEqual([
      "matin",
      "libre",
    ]);
    expect(moved.at(-1)).toEqual({ id: "soir", date: "2030-06-12", startTime: "18:00" });
  });
});

describe("séances verrouillées dans le planning", () => {
  const range = { from: "2030-06-01", to: "2030-06-30" };

  const prepare = async () => {
    const org = await makeOrg("Planning");
    const assistant = await addStaff(org.organizationId, "AdjointPlanning", "assistant", [org.groupId]);
    const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: org.organizationId } });
    const schedule = (userId: string, date: string, title: string) =>
      saveScheduledSession(userId, org.organizationId, {
        date,
        startTime: "18:00",
        location: null,
        publishAt: null,
        draft: {
          title,
          type: "strength",
          durationMin: 45,
          coachNote: null,
          blocks: [
            {
              name: "Corps",
              variant: "club",
              items: [{ exerciseId: exercise.id, prescription: { sets: 3, reps: 5 } }],
            },
          ],
        },
        assignments: [{ targetType: "group", targetId: org.groupId }],
        overrides: [],
      });
    return { ...org, assistant, schedule };
  };

  it("un adjoint voit la séance d'un autre sans pouvoir la déplacer : le planning la verrouille", async () => {
    const { owner, organizationId, assistant, schedule } = await prepare();
    const fromOwner = await schedule(owner.userId, "2030-06-10", "Séance du coach");
    const own = await schedule(assistant.userId, "2030-06-11", "Séance de l'adjoint");

    const planning = await listPlanning(assistant.userId, organizationId, range);
    expect(planning.sessions.map((session) => session.id).sort()).toEqual([fromOwner.id, own.id].sort());
    expect(planning.readOnly).toEqual([fromOwner.id]);

    // Le verrou dit la même chose que le serveur : refus pour l'une, déplacement pour l'autre.
    await expect(moveSession(assistant.userId, organizationId, fromOwner.id, "2030-06-12")).rejects.toMatchObject({
      status: 403,
    });
    await moveSession(assistant.userId, organizationId, own.id, "2030-06-12");
    const after = await listCalendar(assistant.userId, organizationId, range);
    expect(after.sessions.find((session) => session.id === own.id)?.date).toBe("2030-06-12");
    expect(after.sessions.find((session) => session.id === fromOwner.id)?.date).toBe("2030-06-10");
  });

  it("le propriétaire n'a aucune séance verrouillée, et le calendrier garde son contrat", async () => {
    const { owner, organizationId, assistant, schedule } = await prepare();
    await schedule(assistant.userId, "2030-06-11", "Séance de l'adjoint");
    const planning = await listPlanning(owner.userId, organizationId, range);
    expect(planning.readOnly).toEqual([]);
    expect(await listCalendar(owner.userId, organizationId, range)).not.toHaveProperty("readOnly");
  });
});
