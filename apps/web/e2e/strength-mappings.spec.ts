import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { groupLink, joinAsAthlete } from "./journeys";

test("le propriétaire rapproche une ancienne référence après vérification et conserve les clés inconnues", async ({
  page,
  browser,
}, info) => {
  await createCoachSpace(page, "Rapprochement");
  await page.setViewportSize({ width: info.project.name === "desktop" ? 1440 : 390, height: 900 });
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId;
  const root = `/api/v1/orgs/${orgId}`;
  const athlete = await joinAsAthlete(browser, await groupLink(page), "Maya");
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    await sql.query("UPDATE organizations SET progression_enabled = true WHERE id = $1", [orgId]);
    const athleteId = (await (await athlete.page.request.get("/api/v1/me")).json()).spaces[0].athleteId;
    const exerciseResponse = await page.request.post(`${root}/exercises`, {
      data: {
        name: "Squat barre libre vérifié",
        category: "strength",
        strengthLoadKind: "external_total",
        cues: ["Barre libre, charge totale avec la barre"],
      },
    });
    expect(exerciseResponse.ok()).toBe(true);
    const exercise = await exerciseResponse.json();
    expect(
      (
        await page.request.post(`${root}/exercises`, {
          data: { name: "Variante assistée", category: "strength", strengthLoadKind: "assistance" },
        })
      ).ok(),
    ).toBe(true);
    for (const exerciseKey of ["back_squat", "ancienne_machine_non_identifiee_avec_variante_particuliere"]) {
      expect(
        (
          await page.request.post(`${root}/athletes/${athleteId}/strength-tests`, {
            data: { exerciseKey, kind: "one_rm", value: 100, date: "2026-10-01" },
          })
        ).ok(),
      ).toBe(true);
    }
    expect((await athlete.page.request.get(`${root}/strength-mappings`)).status()).toBe(403);
    const report = async () => (await page.request.get(`${root}/strength-mappings`)).json();
    await page.goto("/reglages", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: m.strengthMapping.title, exact: true }).click();
    const known = page.getByRole("region", { name: m.strengthTest.back_squat, exact: true });
    const unknown = page.getByRole("region", {
      name: "ancienne_machine_non_identifiee_avec_variante_particuliere",
      exact: true,
    });
    await expect(unknown.getByText(m.strengthMapping.unknown, { exact: true })).toBeVisible();
    await expect(unknown.getByRole("button")).toHaveCount(0);
    await known.getByRole("button", { name: m.strengthMapping.choose, exact: true }).click();
    const select = known.getByLabel(m.strengthMapping.exercise, { exact: true });
    await expect(select).toHaveValue("");
    await expect(select.getByRole("option", { name: /Variante assistée/ })).toHaveCount(0);
    await known.getByRole("button", { name: m.strengthMapping.confirm, exact: true }).click();
    await expect(known.getByText(m.strengthMapping.reasonError, { exact: true })).toBeVisible();
    expect((await report()).mappings).toEqual([]);
    await select.selectOption(exercise.id);
    await expect(known.getByText("Barre libre, charge totale avec la barre", { exact: true })).toBeVisible();
    await known
      .getByLabel(m.strengthMapping.reason, { exact: true })
      .fill("Les anciens tests utilisent la barre libre et une charge totale, variante vérifiée.");
    await known.getByRole("checkbox", { name: m.strengthMapping.check, exact: true }).check();
    if (info.project.name === "desktop") {
      await page.setViewportSize({ width: 768, height: 900 });
      await expectNoHorizontalScroll(page);
      await expectAccessible(page);
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await known.getByRole("button", { name: m.strengthMapping.confirm, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Squat arrière → Squat barre libre vérifié");
    await dialog.getByRole("button", { name: m.common.cancel, exact: true }).click();
    expect((await report()).mappings).toEqual([]);
    await known.getByRole("button", { name: m.strengthMapping.confirm, exact: true }).click();
    await dialog.getByRole("button", { name: m.strengthMapping.confirm, exact: true }).click();
    await expect(page.getByText(m.strengthMapping.saved, { exact: true })).toBeVisible();
    const mapped = await report();
    expect(mapped.mappings).toMatchObject([
      {
        legacyKey: "back_squat",
        exerciseId: exercise.id,
        exerciseName: "Squat barre libre vérifié",
        loadKind: "external_total",
      },
    ]);
    expect(mapped.unmapped).toEqual([
      { legacyKey: "ancienne_machine_non_identifiee_avec_variante_particuliere", count: 1 },
    ]);
    const strength = await (await page.request.get(`${root}/athletes/${athleteId}/strength/${exercise.id}`)).json();
    expect(strength.reference).toBeNull();
    expect(strength.tests).toMatchObject([{ exerciseKey: "back_squat", value: 100 }]);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText("Squat arrière → Squat barre libre vérifié", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: m.strengthMapping.choose, exact: true })).toHaveCount(0);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expectNoHorizontalScroll(page);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "";
    });
    await page.screenshot({ path: `/tmp/tartan-strength-mappings-${info.project.name}.png`, fullPage: true });
  } finally {
    await athlete.context.close();
    await sql.end();
  }
});
