import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { createApiClient } from "../../../packages/api-client/src/index";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

test("phases : brouillon privé, partage, chevauchement, conflit et transport natif", async ({ page }, info) => {
  const t = m.trainingPhases;
  await createCoachSpace(page, "Phases");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId as string;
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    await sql.query("UPDATE organizations SET phases_enabled = true WHERE id = $1", [orgId]);
  } finally {
    await sql.end();
  }
  const native = createApiClient({
    baseUrl: new URL(page.url()).origin,
    headers: async () => ({
      Cookie: (await page.context().cookies()).map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    }),
  });
  const context = await native.trainingPhaseContext(orgId);
  const target = { type: "group" as const, id: context.groups[0]!.id };
  const query = { from: "2030-01-01", to: "2030-04-01" };
  await page.goto(`/phases?${new URLSearchParams(query)}`);
  expect(await page.locator(".world-work").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    "rgb(196, 68, 43)",
  );
  await page.getByRole("button", { name: t.add, exact: true }).click();
  const dialog = page.getByRole("dialog");
  expect(await dialog.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(21, 22, 26)");
  await dialog.getByLabel(t.target, { exact: true }).selectOption(`group:${target.id}`);
  await dialog.getByLabel(t.name, { exact: true }).fill("Préparation générale de printemps");
  await dialog.getByLabel(t.end, { exact: true }).fill("2030-03-25");
  await dialog.getByLabel(t.objective, { exact: true }).fill("Construire la force et la régularité");
  await dialog.getByLabel(t.description, { exact: true }).fill("Trois mois pour installer les repères.");
  await dialog.getByLabel(t.privateNote, { exact: true }).fill("Note réservée au coach");
  await expectAccessible(page);
  await page.evaluate(() => {
    document.body.style.zoom = "2";
  });
  await expectNoHorizontalScroll(page);
  await page.evaluate(() => {
    document.body.style.zoom = "1";
  });
  await dialog.screenshot({ path: `/tmp/tartan-phase-form-${info.project.name}.png` });
  await dialog.getByRole("button", { name: m.common.save, exact: true }).click();
  await expect(dialog).toBeHidden();
  const timeline = page.getByRole("region", { name: t.timeline });
  await expect(timeline.getByText(t.draft, { exact: true })).toBeVisible();
  let phase = (await native.trainingPhases(orgId, query)).phases[0]!;
  expect(phase.shared).toBe(false);
  const { targetName: _name, version, shared: _shared, ...fields } = phase;
  const body = { ...fields, privateNote: phase.privateNote ?? "", expectedVersion: version };
  await expect(
    native.saveTrainingPhase(orgId, { ...body, id: randomUUID(), expectedVersion: 0 }),
  ).rejects.toMatchObject({ status: 409, code: "phase_overlap" });
  await timeline.getByRole("button", { name: m.common.edit, exact: true }).click();
  await native.saveTrainingPhase(orgId, { ...body, objective: "Modifié depuis un autre appareil" });
  await dialog.getByLabel(t.name, { exact: true }).fill("Modification à préserver");
  await dialog.getByRole("button", { name: m.common.save, exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText(t.conflict);
  await expect(dialog.getByLabel(t.name, { exact: true })).toHaveValue("Modification à préserver");
  await page.reload();
  await expect(timeline.getByText("Modifié depuis un autre appareil")).toBeVisible();
  await timeline.getByRole("button", { name: t.publish, exact: true }).click();
  await dialog.getByRole("button", { name: t.publish, exact: true }).click();
  await expect(timeline.getByText(t.shared, { exact: true })).toBeVisible();
  phase = (await native.trainingPhases(orgId, query)).phases[0]!;
  expect(phase).toMatchObject({ version: 3, shared: true });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `/tmp/tartan-phases-${info.project.name}-${width}.png` });
  }
  await page.goto("/calendrier?semaine=2030-01-21");
  await expect(page.getByText(t.week(3, 12))).toBeVisible();
  await expect(page.getByText("Préparation générale de printemps", { exact: true })).toBeVisible();
  await expect(native.deleteTrainingPhase(orgId, phase.id, 1)).rejects.toMatchObject({ status: 409 });
  const removed = await native.deleteTrainingPhase(orgId, phase.id, phase.version);
  expect(await native.deleteTrainingPhase(orgId, phase.id, phase.version)).toEqual(removed);
  expect((await native.trainingPhases(orgId, query)).phases).toEqual([]);
  await expect(native.saveTrainingPhase(orgId, { ...body, expectedVersion: 0 })).rejects.toMatchObject({ status: 409 });
  const next = { ...body, id: randomUUID(), expectedVersion: 0 };
  const [first, retry] = await Promise.all([
    native.saveTrainingPhase(orgId, next),
    native.saveTrainingPhase(orgId, next),
  ]);
  expect(first).toEqual(retry);
});
