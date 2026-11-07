import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { randomUUID } from "node:crypto";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { groupLink, joinAsAthlete } from "./journeys";

test("le coach relit les charges, annule, gère un aperçu obsolète puis confirme sans modifier le réalisé", async ({
  page,
  browser,
}, info) => {
  await createCoachSpace(page, "Actualisation");
  await page.setViewportSize({ width: info.project.name === "desktop" ? 1440 : 390, height: 900 });
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId;
  const root = `/api/v1/orgs/${orgId}`;
  const invitation = await groupLink(page);
  const a = await joinAsAthlete(browser, invitation, "Alice");
  const b = await joinAsAthlete(browser, invitation, "Basile");
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    await sql.query("UPDATE organizations SET progression_enabled = true WHERE id = $1", [orgId]);
    const aId = (await (await a.page.request.get("/api/v1/me")).json()).spaces[0].athleteId;
    const bId = (await (await b.page.request.get("/api/v1/me")).json()).spaces[0].athleteId;
    const exerciseResponse = await page.request.post(`${root}/exercises`, {
      data: { name: "Squat charge totale", category: "strength", strengthLoadKind: "external_total" },
    });
    expect(exerciseResponse.ok()).toBe(true);
    const exercise = await exerciseResponse.json();
    const choose = async (athleteId: string, valueKg: number) => {
      expect(
        (
          await page.request.put(`${root}/athletes/${athleteId}/strength/${exercise.id}`, {
            data: { source: "working", valueKg },
          })
        ).ok(),
      ).toBe(true);
    };
    await choose(aId, 100);
    await choose(bId, 100);
    const response = await page.request.post(`${root}/sessions`, {
      data: {
        date: "2030-06-12",
        startTime: null,
        location: null,
        publishAt: null,
        overrides: [],
        assignments: [
          { targetType: "athlete", targetId: aId },
          { targetType: "athlete", targetId: bId },
        ],
        draft: {
          title: "Révision des charges",
          type: "strength",
          durationMin: 30,
          coachNote: null,
          blocks: [
            {
              name: "Force",
              variant: "club",
              items: [
                {
                  exerciseId: exercise.id,
                  prescription: {
                    sets: 3,
                    reps: 4,
                    load: { type: "pct_1rm", value: 80, test: `exercise:${exercise.id}` },
                  },
                },
              ],
            },
          ],
        },
      },
    });
    expect(response.ok()).toBe(true);
    const session = await response.json();
    const sessionRoot = `${root}/sessions/${session.id}`;
    expect(
      (await page.request.post(`${sessionRoot}/publish`, { data: { expectedVersion: session.version } })).ok(),
    ).toBe(true);
    expect(
      (
        await b.page.request.post(`${sessionRoot}/log`, {
          data: { clientId: randomUUID(), status: "done", variantDone: "club" },
        })
      ).ok(),
    ).toBe(true);
    await choose(aId, 150);
    await choose(bId, 200);
    await page.goto(`/seances/${session.id}/suivi`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: m.prescriptionRefresh.title, exact: true }).click();
    const alice = page.getByRole("region", { name: /Alice/ });
    const basile = page.getByRole("region", { name: /Basile/ });
    await expect(alice.getByText("80 kg", { exact: true })).toBeVisible();
    await expect(alice.getByText("120 kg", { exact: true })).toBeVisible();
    await expect(basile.getByText(m.prescriptionRefresh.status.recorded, { exact: true })).toBeVisible();
    if (info.project.name === "desktop") {
      await page.setViewportSize({ width: 768, height: 900 });
      await expectNoHorizontalScroll(page);
      await expectAccessible(page);
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    const confirm = page.getByRole("button", { name: m.prescriptionRefresh.confirm, exact: true });
    await confirm.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: m.common.cancel, exact: true }).click();
    const detail = async () => (await a.page.request.get(`${sessionRoot}/me`)).json();
    expect((await detail()).blocks[0].items[0].resolvedLoadKg).toBe(80);
    await choose(aId, 175);
    await confirm.click();
    await dialog.getByRole("button", { name: m.prescriptionRefresh.confirm, exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: m.prescriptionRefresh.conflict })).toBeVisible();
    await expect(confirm).toBeDisabled();
    await page.getByRole("button", { name: m.prescriptionRefresh.reload, exact: true }).click();
    await expect(alice.getByText("140 kg", { exact: true })).toBeVisible();
    await expect(confirm).toBeEnabled();
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expectNoHorizontalScroll(page);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "";
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole("heading", { name: m.prescriptionRefresh.title, exact: true })).toBeInViewport();
    await page.screenshot({ path: `/tmp/tartan-refresh-loads-${info.project.name}.png`, fullPage: true });
    await confirm.click();
    await dialog.getByRole("button", { name: m.prescriptionRefresh.confirm, exact: true }).click();
    await expect(page.getByText(m.prescriptionRefresh.saved, { exact: true })).toBeVisible();
    expect((await detail()).blocks[0].items[0].resolvedLoadKg).toBe(140);
    expect((await (await b.page.request.get(`${sessionRoot}/me`)).json()).blocks[0].items[0].resolvedLoadKg).toBe(80);
    expect((await a.page.request.get(`${sessionRoot}/refresh-loads`)).status()).toBe(403);
    await page.reload({ waitUntil: "networkidle" });
    await expect(confirm).toBeDisabled();
    await expect(page.getByText(m.prescriptionRefresh.empty, { exact: true })).toBeVisible();
  } finally {
    await a.context.close();
    await b.context.close();
    await sql.end();
  }
});
