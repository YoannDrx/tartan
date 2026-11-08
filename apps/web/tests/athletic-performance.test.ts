import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addPerformance, deletePerformance, updatePerformance } from "@/server/performance.service";
import { getAthleteFile, getMyFile } from "@/server/athlete.service";
import { addAthlete, addStaff, makeOrg } from "./helpers";

const setup = async () => {
  const org = await makeOrg("Performances");
  const athlete = await addAthlete(org.organizationId, org.groupId, "Sprint");
  const base = { athleteId: athlete.athleteId, discipline: "100 m", mark: 12, unit: "s" as const, date: "2030-06-01" };
  const read = async () => (await getMyFile(athlete.userId, org.organizationId)).performances;
  return { ...org, athlete, base, read };
};
it("calcule le chrono minimum, distingue la référence et recalcule après correction et suppression", async () => {
  const a = await setup();
  const first = await addPerformance(a.owner.userId, a.organizationId, a.base);
  expect(await a.read()).toMatchObject([
    { id: first.id, measurementType: "time", recordDirection: "lower", isBaseline: true, isPb: false },
  ]);
  const fast = await addPerformance(a.owner.userId, a.organizationId, { ...a.base, mark: 11, date: "2030-06-02" });
  expect((await a.read()).find((r) => r.id === fast.id)).toMatchObject({ isPb: true, isBaseline: false });
  await updatePerformance(a.owner.userId, a.organizationId, {
    ...a.base,
    id: fast.id,
    expectedVersion: 1,
    mark: 13,
    date: "2030-06-02",
  });
  expect((await a.read()).find((r) => r.id === first.id)).toMatchObject({ isPb: false, isBaseline: true });
  await expect(deletePerformance(a.owner.userId, a.organizationId, fast.id)).rejects.toMatchObject({ status: 409 });
  await deletePerformance(a.owner.userId, a.organizationId, fast.id, 2);
  expect(await a.read()).toHaveLength(1);
});
it("déduplique une création concurrente, conserve sa correction et ne ressuscite pas un résultat supprimé", async () => {
  const a = await setup();
  const body = { ...a.base, clientId: randomUUID() };
  const rows = await Promise.all([
    addPerformance(a.owner.userId, a.organizationId, body),
    addPerformance(a.owner.userId, a.organizationId, body),
  ]);
  expect(rows[0]).toEqual(rows[1]);
  expect(await a.read()).toHaveLength(1);
  await updatePerformance(a.owner.userId, a.organizationId, {
    ...a.base,
    id: rows[0]!.id,
    expectedVersion: 1,
    mark: 11,
  });
  expect(await addPerformance(a.owner.userId, a.organizationId, body)).toMatchObject({ version: 2 });
  expect((await a.read())[0]!.mark).toBe(11);
  await expect(addPerformance(a.owner.userId, a.organizationId, { ...body, mark: 5 })).rejects.toMatchObject({
    status: 409,
  });
  await deletePerformance(a.owner.userId, a.organizationId, rows[0]!.id, 2);
  await expect(addPerformance(a.owner.userId, a.organizationId, body)).rejects.toMatchObject({ status: 409 });
  expect(await a.read()).toHaveLength(0);
  expect(await prisma.performanceCreation.count({ where: { athleteId: a.athlete.athleteId } })).toBe(1);
  await prisma.athlete.delete({ where: { id: a.athlete.athleteId } });
  expect(await prisma.performanceCreation.count({ where: { athleteId: a.athlete.athleteId } })).toBe(0);
});
it("isole les contextes, rapproche exactement cm/m et refuse une correction obsolète", async () => {
  const a = await setup();
  const first = await addPerformance(a.owner.userId, a.organizationId, {
    ...a.base,
    discipline: "Longueur",
    unit: "cm",
    mark: 600,
  });
  const best = await addPerformance(a.owner.userId, a.organizationId, {
    ...a.base,
    discipline: "Longueur",
    unit: "m",
    mark: 6.2,
    date: "2030-06-02",
  });
  const indoor = await addPerformance(a.owner.userId, a.organizationId, {
    ...a.base,
    discipline: "Longueur",
    unit: "m",
    mark: 7,
    comparisonContext: "salle",
  });
  expect((await a.read()).filter((r) => r.isPb).map((r) => r.id)).toEqual([best.id]);
  expect((await a.read()).find((r) => r.id === indoor.id)?.isBaseline).toBe(true);
  const result = await Promise.allSettled(
    [6.3, 6.4].map((mark) =>
      updatePerformance(a.owner.userId, a.organizationId, {
        ...a.base,
        id: best.id,
        expectedVersion: 1,
        discipline: "Longueur",
        unit: "m",
        mark,
      }),
    ),
  );
  expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(result.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
  const file = await getAthleteFile(a.owner.userId, a.organizationId, a.athlete.athleteId);
  expect(file.performances.find((r) => r.id === first.id)).toBeDefined();
  expect(JSON.stringify(file.performances)).not.toContain("fingerprint");
});
it("contrôle rôle, athlète, espace et unité avant toute écriture", async () => {
  const a = await setup();
  const outsider = await addStaff(a.organizationId, "Hors groupe", "coach", []);
  const row = await addPerformance(a.owner.userId, a.organizationId, a.base);
  for (const userId of [a.athlete.userId, outsider.userId]) {
    await expect(addPerformance(userId, a.organizationId, a.base)).rejects.toMatchObject({ status: 403 });
    await expect(
      updatePerformance(userId, a.organizationId, { ...a.base, id: row.id, expectedVersion: 1 }),
    ).rejects.toMatchObject({ status: 403 });
  }
  await expect(deletePerformance(a.owner.userId, a.organizationId, row.id, 1, randomUUID())).rejects.toMatchObject({
    status: 404,
  });
  await expect(
    addPerformance(a.owner.userId, a.organizationId, { ...a.base, measurementType: "distance" }),
  ).rejects.toThrow();
  const other = await makeOrg("Ailleurs");
  await expect(deletePerformance(other.owner.userId, other.organizationId, row.id, 1)).rejects.toMatchObject({
    status: 404,
  });
  expect(await prisma.performance.count({ where: { athleteId: a.athlete.athleteId } })).toBe(1);
});
