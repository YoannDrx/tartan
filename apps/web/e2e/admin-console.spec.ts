import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { sql } from "./personas";

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
  ["/admin/jeu", m.admin.nav.game],
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

  // Les fiches (T20) : un espace, puis une facture d'essai posée en base, comme l'écrirait le webhook Stripe.
  const project = info.project.name;
  const number = `CONSOLE-${project}-0001`;
  const organizationId = await sql(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `select o.id from organizations o join "user" u on u.id = o.owner_id where u.email = $1`,
      [`console-${project}@e2e.tartan.test`],
    );
    await client.query(
      `insert into billing_invoices
         (id, livemode, organization_id, stripe_customer_id, stripe_subscription_id, number, status, currency,
          total_cents, amount_paid_cents, stripe_created_at, synced_at)
       values ($1, false, $2, $3, $4, $5, 'paid', 'eur', 1900, 1900, now(), now())
       on conflict (id) do nothing`,
      [`in_console_${project}`, rows[0]!.id, `cus_console_${project}`, `sub_console_${project}`, number],
    );
    return rows[0]!.id;
  });
  await page.goto("/admin/espaces");
  await page.locator(`a[href="/admin/espaces/${organizationId}"]`).filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { name: "Coaching Console", level: 1 })).toBeVisible();
  await expect(page.getByText(`console-${project}@e2e.tartan.test`).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);

  await page.goto("/admin/factures");
  await page.getByRole("link", { name: number, exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { name: number, level: 1 })).toBeVisible();
  // Une facture d'essai le dit, et reste remboursable en entier.
  await expect(page.getByText(m.admin.testMode)).toBeVisible();
  await expect(page.getByText(/19,00/).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test("un coach ordinaire est renvoyé hors de la console", async ({ page }) => {
  await createCoachSpace(page, "Hors console");
  await page.goto("/admin/revenus");
  await expect(page).toHaveURL(/\/(accueil|suivi|aujourdhui)/);
});
