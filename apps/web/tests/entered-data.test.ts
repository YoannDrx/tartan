import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  addCoachNote,
  addPerformance,
  addStrengthTest,
  deleteCoachNote,
  deletePerformance,
  deleteStrengthTest,
} from "@/server/athlete.service";
import { deleteCompetition, saveCompetition } from "@/server/session.service";
import { addJumpAttempt, deleteJumpAttempt } from "@/server/video.service";
import { addAthlete, addStaff, makeOrg } from "./helpers";

const prepare = async () => {
  const org = await makeOrg("Saisies");
  const athlete = await addAthlete(org.organizationId, org.groupId, "Léa");
  const outsider = await addStaff(org.organizationId, "Autre", "coach", []);
  const mark = (value: number, unit: "m" | "cm" | "s" = "m") =>
    addPerformance(org.owner.userId, org.organizationId, {
      athleteId: athlete.athleteId,
      discipline: "high_jump",
      mark: value,
      unit,
      date: "2030-06-10",
    });
  const rows = () =>
    prisma.performance.findMany({ where: { athleteId: athlete.athleteId }, orderBy: { createdAt: "asc" } });
  return { ...org, athlete, outsider, mark, rows };
};

describe("données saisies", () => {
  it("le record se recalcule en mètres, à l'ajout comme au retrait", async () => {
    const a = await prepare();
    await a.mark(2.1);
    await a.mark(205, "cm");
    let rows = await a.rows();
    expect(rows.map((r) => r.isPb)).toEqual([true, false]);
    await deletePerformance(a.owner.userId, a.organizationId, rows[0]!.id);
    rows = await a.rows();
    expect(rows.map((r) => r.isPb)).toEqual([true]);
  });
  it("un athlète ne supprime rien", async () => {
    const a = await prepare();
    await a.mark(2);
    const [row] = await a.rows();
    await expect(deletePerformance(a.athlete.userId, a.organizationId, row!.id)).rejects.toMatchObject({ status: 403 });
    await addStrengthTest(a.owner.userId, a.organizationId, {
      athleteId: a.athlete.athleteId,
      exerciseKey: "squat",
      value: 100,
      kind: "one_rm",
      date: "2030-06-10",
    });
    const test = await prisma.strengthTest.findFirstOrThrow({ where: { athleteId: a.athlete.athleteId } });
    await expect(deleteStrengthTest(a.athlete.userId, a.organizationId, test.id)).rejects.toMatchObject({
      status: 403,
    });
    await deleteStrengthTest(a.owner.userId, a.organizationId, test.id);
    expect(await prisma.strengthTest.count({ where: { id: test.id } })).toBe(0);
  });
  it("un coach hors périmètre ne supprime rien", async () => {
    const a = await prepare();
    await a.mark(2);
    const [row] = await a.rows();
    await expect(deletePerformance(a.outsider.userId, a.organizationId, row!.id)).rejects.toThrow();
    expect(await prisma.performance.count({ where: { id: row!.id } })).toBe(1);
    const jump = await addJumpAttempt(a.owner.userId, a.organizationId, {
      athleteId: a.athlete.athleteId,
      barHeightCm: 180,
      attemptNo: 1,
      result: "O",
    });
    await expect(deleteJumpAttempt(a.outsider.userId, a.organizationId, jump.id)).rejects.toThrow();
    await deleteJumpAttempt(a.owner.userId, a.organizationId, jump.id);
    expect(await prisma.jumpAttempt.count({ where: { id: jump.id } })).toBe(0);
  });
  it("seuls l'auteur et le propriétaire retirent une note", async () => {
    const a = await prepare();
    const colleague = await addStaff(a.organizationId, "Collègue", "coach", [a.groupId]);
    const other = await addStaff(a.organizationId, "Tiers", "coach", [a.groupId]);
    await addCoachNote(colleague.userId, a.organizationId, a.athlete.athleteId, "Note");
    const note = await prisma.coachNote.findFirstOrThrow({ where: { athleteId: a.athlete.athleteId } });
    await expect(deleteCoachNote(other.userId, a.organizationId, note.id)).rejects.toMatchObject({ status: 403 });
    await deleteCoachNote(a.owner.userId, a.organizationId, note.id);
    expect(await prisma.coachNote.count({ where: { id: note.id } })).toBe(0);
  });
  it("une compétition avec un athlète hors périmètre reste en place, et ses marques survivent au retrait", async () => {
    const a = await prepare();
    const saved = await saveCompetition(a.owner.userId, a.organizationId, {
      name: "Meeting",
      date: "2030-06-22",
      athleteIds: [a.athlete.athleteId],
    });
    await addPerformance(a.owner.userId, a.organizationId, {
      athleteId: a.athlete.athleteId,
      discipline: "high_jump",
      mark: 2,
      unit: "m",
      date: "2030-06-22",
      competitionId: saved.id,
    });
    await expect(deleteCompetition(a.outsider.userId, a.organizationId, saved.id)).rejects.toThrow();
    await deleteCompetition(a.owner.userId, a.organizationId, saved.id);
    expect(await prisma.competition.count({ where: { id: saved.id } })).toBe(0);
    expect((await a.rows()).map((r) => r.competitionId)).toEqual([null]);
  });
  it("un autre espace ne retire rien", async () => {
    const a = await prepare();
    const other = await makeOrg("Ailleurs");
    await a.mark(2);
    const [row] = await a.rows();
    await expect(deletePerformance(other.owner.userId, other.organizationId, row!.id)).rejects.toMatchObject({
      status: 404,
    });
  });
});
