import { createApiClient } from "../../../packages/api-client/src/index";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

test("résultats athlé : première référence, chrono, correction, conflit et suppression", async ({ page }, info) => {
  await createCoachSpace(page, "Performances");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId;
  await page.goto("/athletes");
  await page.getByRole("button", { name: m.athletes.new, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Prénom", { exact: true }).fill("Camille");
  await dialog.getByLabel("Nom", { exact: true }).fill("Sprint");
  await dialog.getByLabel("Date de naissance", { exact: true }).fill("2000-04-10");
  await dialog.getByRole("button", { name: m.common.save, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Camille Sprint" })).toBeVisible();
  const athleteId = new URL(page.url()).pathname.split("/").at(-1)!;
  const endpoint = `/api/v1/orgs/${orgId}/athletes/${athleteId}`;
  const records = page.getByRole("region", { name: m.performances.title, exact: true });
  const add = async (mark: string, date: string) => {
    await records.getByRole("button", { name: m.common.add, exact: true }).click();
    await dialog.getByLabel(m.performances.discipline, { exact: true }).fill("100 m");
    await dialog.getByLabel(m.performances.measurement, { exact: true }).selectOption("time");
    await dialog.getByLabel(m.performances.mark, { exact: true }).fill(mark);
    await dialog.getByLabel(m.builder.date, { exact: true }).fill(date);
    await dialog.getByLabel(m.performances.context, { exact: true }).fill("piste, manuel");
    await expectAccessible(page);
    await page.evaluate(() => {
      document.body.style.zoom = "2";
    });
    await expectNoHorizontalScroll(page);
    await page.evaluate(() => {
      document.body.style.zoom = "1";
    });
    await dialog.screenshot({ path: `/tmp/tartan-performance-form-${info.project.name}.png` });
    await dialog.getByRole("button", { name: m.common.save, exact: true }).click();
    await expect(dialog).not.toBeVisible();
  };
  await add("12", "2030-06-01");
  await expect(records.getByText(m.performances.baseline, { exact: true })).toBeVisible();
  await add("11.5", "2030-06-02");
  await expect(records.getByText(m.athletes.record, { exact: true })).toHaveCount(1);
  const file = await (await page.request.get(endpoint)).json();
  const faster = file.performances.find((p: { mark: number }) => p.mark === 11.5);
  const item = records.getByRole("listitem").filter({ hasText: "11,5 s" });
  await item.getByRole("button", { name: new RegExp(`^${m.performances.edit}`) }).click();
  await dialog.getByLabel(m.performances.mark, { exact: true }).fill("13");
  await dialog.getByRole("button", { name: m.common.save, exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(records.getByText(m.athletes.record, { exact: true })).toHaveCount(0);
  await expect(records.getByText(m.performances.baseline, { exact: true })).toBeVisible();
  const body = {
    discipline: "100 m",
    unit: "s",
    mark: 11,
    date: "2030-06-02",
    comparisonContext: "piste, manuel",
    expectedVersion: 1,
  };
  expect((await page.request.put(`${endpoint}/performances/${faster.id}`, { data: body })).status()).toBe(409);
  expect(
    (await page.request.delete(`${endpoint}/performances/${faster.id}`, { params: { expectedVersion: 1 } })).status(),
  ).toBe(409);
  expect(
    (
      await page.request.post(`${endpoint}/performances`, {
        data: { ...body, expectedVersion: undefined, measurementType: "distance", clientId: randomUUID() },
      })
    ).status(),
  ).toBe(400);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  }
  await page.setViewportSize({ width: info.project.name === "mobile" ? 390 : 1440, height: 950 });
  await records.screenshot({ path: `/tmp/tartan-performances-${info.project.name}.png` });
  await records
    .getByRole("listitem")
    .filter({ hasText: "13 s" })
    .getByRole("button", { name: /^Supprimer/ })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: m.common.delete, exact: true }).click();
  await expect(records.getByRole("listitem")).toHaveCount(1);
  // Transport natif réel : requêtes du client partagé contre l'API locale authentifiée.
  const native = createApiClient({
    baseUrl: new URL(page.url()).origin,
    headers: async () => ({
      Cookie: (await page.context().cookies()).map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    }),
  });
  const creation = {
    discipline: "Longueur",
    mark: 600,
    unit: "cm",
    measurementType: "distance",
    recordDirection: "higher",
    date: "2030-06-01",
    clientId: randomUUID(),
  } as const;
  const [created, replayed] = await Promise.all([
    native.addPerformance(orgId, athleteId, creation),
    native.addPerformance(orgId, athleteId, creation),
  ]);
  expect(replayed).toEqual(created);
  const { clientId: _clientId, ...correction } = creation;
  expect(
    await native.updatePerformance(orgId, athleteId, created.id, { ...correction, mark: 610, expectedVersion: 1 }),
  ).toMatchObject({ version: 2 });
  await expect(native.deletePerformance(orgId, athleteId, created.id, 1)).rejects.toMatchObject({ status: 409 });
  expect(await native.deletePerformance(orgId, athleteId, created.id, 2)).toMatchObject({ athleteId });
  await expect(native.addPerformance(orgId, athleteId, creation)).rejects.toMatchObject({ status: 409 });
});
