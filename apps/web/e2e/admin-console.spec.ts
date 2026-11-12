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
  ["/admin/configuration", m.admin.nav.configuration],
  ["/admin/mascotte", m.admin.nav.mascot],
] as const;

test("la console s'ouvre à l'éditeur, lisible sur chaque écran, et reste fermée aux autres", async ({ page }, info) => {
  test.setTimeout(180_000);
  await createCoachSpace(page, "Console", `console-${info.project.name}@e2e.tartan.test`);
  for (const [path, title] of pages) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  }
  // L'export comptable n'est demandé qu'au clic, et part en téléchargement.
  const exports: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/admin/revenus/export")) exports.push(request.url());
  });
  await page.goto("/admin/revenus", { waitUntil: "networkidle" });
  expect(exports).toEqual([]);
  const year = new Date().getUTCFullYear();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: m.admin.revenue.exportCsv(year), exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`tartan-factures-${year}.csv`);

  await page.goto("/admin/utilisateurs");
  // Sur téléphone, une carte par ligne ; dès la tablette, la table.
  const phone = (page.viewportSize()?.width ?? 0) < 768;
  await expect(page.getByRole("list", { name: m.admin.nav.users })).toBeVisible({ visible: phone });
  await expect(page.getByRole("table", { name: m.admin.nav.users })).toBeVisible({ visible: !phone });
  await page.getByRole("link", { name: `console-${info.project.name}@e2e.tartan.test` }).click();
  await expect(page.getByRole("button", { name: m.admin.resendVerification })).toBeVisible();
  await expect(page.getByRole("button", { name: m.admin.suspend })).toHaveCount(0);
});

test("un coach ordinaire est renvoyé hors de la console", async ({ page }) => {
  await createCoachSpace(page, "Hors console");
  await page.goto("/admin/revenus");
  await expect(page).toHaveURL(/\/(accueil|suivi|aujourdhui)/);
});
