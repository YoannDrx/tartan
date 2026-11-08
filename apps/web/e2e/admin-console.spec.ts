import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

const pages = [
  ["/admin/revenus", m.admin.nav.revenue],
  ["/admin/utilisateurs", m.admin.nav.users],
  ["/admin/espaces", m.admin.nav.spaces],
  ["/admin/abonnements", m.admin.nav.subscriptions],
  ["/admin/factures", m.admin.nav.invoices],
  ["/admin/litiges", m.admin.nav.disputes],
  ["/admin/usage", m.admin.nav.usage],
  ["/admin/versions", m.admin.nav.versions],
  ["/admin/journal", m.admin.nav.audit],
] as const;

test("la console s'ouvre à l'éditeur, lisible sur chaque écran, et reste fermée aux autres", async ({ page }, info) => {
  test.setTimeout(180_000);
  await createCoachSpace(page, "Console", `support-${info.project.name}@e2e.tartan.test`);
  for (const [path, title] of pages) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  }
  await page.goto("/admin/utilisateurs");
  await page.getByRole("link", { name: `support-${info.project.name}@e2e.tartan.test` }).click();
  await expect(page.getByRole("button", { name: m.admin.resendVerification })).toBeVisible();
  await expect(page.getByRole("button", { name: m.admin.suspend })).toHaveCount(0);
});

test("un coach ordinaire est renvoyé hors de la console", async ({ page }) => {
  await createCoachSpace(page, "Hors console");
  await page.goto("/admin/revenus");
  await expect(page).toHaveURL(/\/(accueil|suivi|aujourdhui)/);
});
