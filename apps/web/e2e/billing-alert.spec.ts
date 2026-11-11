import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

// Un prélèvement en attente : le propriétaire le voit sur tous ses écrans, puis retrouve ses factures.
test("le propriétaire est prévenu d'un paiement à régulariser et retrouve ses factures", async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  const email = `impaye-${project}@e2e.tartan.test`;
  await createCoachSpace(page, `Impayé ${project}`, email);

  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    const { rows } = await sql.query(
      'select o.id from organizations o join "user" u on u.id = o.owner_id where u.email = $1',
      [email],
    );
    const organizationId: string = rows[0].id;
    const customer = `cus_e2e_${project}`;
    const subscription = `sub_e2e_${project}`;
    await sql.query("update organizations set stripe_customer_id = $2, plan = 'coach' where id = $1", [
      organizationId,
      customer,
    ]);
    await sql.query("delete from subscriptions where organization_id = $1", [organizationId]);
    await sql.query(
      `insert into subscriptions (id, organization_id, plan_key, status, provider, provider_ref, created_at, updated_at)
       values (gen_random_uuid(), $1, 'coach', 'past_due', 'stripe', $2, now(), now())`,
      [organizationId, subscription],
    );
    await sql.query(
      `insert into billing_invoices
         (id, livemode, organization_id, stripe_customer_id, stripe_subscription_id, number, status, currency,
          total_cents, amount_paid_cents, stripe_created_at, synced_at)
       values
         ($1, false, $3, $4, $5, $6, 'paid', 'eur', 0, 0, now() - interval '31 days', now()),
         ($2, false, $3, $4, $5, $7, 'open', 'eur', 1900, 0, now() - interval '1 day', now())`,
      [
        `in_e2e_${project}_1`,
        `in_e2e_${project}_2`,
        organizationId,
        customer,
        subscription,
        `E2E-${project}-0001`,
        `E2E-${project}-0002`,
      ],
    );
  } finally {
    await sql.end();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/suivi");
  const banner = page.getByRole("status").filter({ hasText: m.billing.pastDueBanner });
  await expect(banner).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);

  await banner.getByRole("link", { name: m.billing.pastDueAction }).click();
  await expect(page).toHaveURL(/\/abonnement/);
  // Sur la page qui explique déjà l'impayé, le bandeau ne se répète pas.
  await expect(page.getByText(m.billing.pastDueBanner, { exact: true })).toHaveCount(0);
  await expect(page.getByText(m.billing.pastDueHint, { exact: true })).toBeVisible();
  await expect(page.getByText(`E2E-${project}-0002`, { exact: true })).toBeVisible();
  await expect(page.getByText(`E2E-${project}-0001`, { exact: true })).toBeVisible();
  await expect(page.getByText(m.billing.invoices.status.open, { exact: true })).toBeVisible();
  await expect(page.getByText("19 €", { exact: true })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});
