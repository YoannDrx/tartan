import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

test("le calculateur distingue estimation, référence et arrondi sans enregistrer de maximum", async ({
  page,
}, info) => {
  await createCoachSpace(page, "Calculateur");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId;
  await page.goto("/outils/charges");
  await expect(page.getByText(m.progression.disabled)).toBeVisible();
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    await sql.query("UPDATE organizations SET progression_enabled = true WHERE id = $1", [orgId]);
    await page.goto("/exercices");
    await page.getByRole("link", { name: m.calculator.title, exact: true }).click();
    await expect(page.locator(".world-work")).toBeVisible();
    await page.getByLabel(m.calculator.reference, { exact: true }).fill("87");
    const row40 = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "40 %", exact: true }) });
    await expect(row40.getByRole("cell").nth(0)).toHaveText("34,8");
    await expect(row40.getByRole("cell").nth(1)).toHaveText("35");
    await page.getByLabel(m.calculator.load, { exact: true }).fill("60,5");
    await page.getByLabel(m.calculator.reps, { exact: true }).fill("3");
    await expect(page.getByRole("status").filter({ hasText: m.calculator.estimate })).toContainText("66,55 kg");
    await expect(page.getByLabel(m.calculator.reference, { exact: true })).toHaveValue("87");
    await page.getByRole("button", { name: m.calculator.useEstimate }).click();
    await expect(page.getByLabel(m.calculator.reference, { exact: true })).toHaveValue("66.55");
    await expect(row40.getByRole("cell").nth(0)).toHaveText("26,62");
    await page.getByLabel(m.calculator.reps, { exact: true }).fill("11");
    await expect(page.getByText(m.calculator.invalidReps)).toBeVisible();
    await expect(page.getByRole("button", { name: m.calculator.useEstimate })).toBeDisabled();
    await expect(page.getByLabel(m.calculator.reference, { exact: true })).toHaveValue("66.55");
    await page.getByLabel(m.calculator.load, { exact: true }).fill("100");
    await page.getByLabel(m.calculator.reps, { exact: true }).fill("1");
    await expect(page.getByRole("status").filter({ hasText: m.calculator.measured })).toContainText("100 kg");
    await page.getByRole("button", { name: m.calculator.useEstimate }).click();
    await expect(page.getByRole("row")).toHaveCount(14);
    expect(
      (await sql.query("SELECT count(*)::int AS count FROM strength_references WHERE organization_id = $1", [orgId]))
        .rows[0].count,
    ).toBe(0);
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(page);
    }
    await page.setViewportSize({ width: info.project.name === "desktop" ? 1440 : 390, height: 900 });
    await expectAccessible(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `/tmp/tartan-calculator-${info.project.name}.png`, fullPage: true });
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  } finally {
    await sql.end();
  }
});
