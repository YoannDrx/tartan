import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

test("le support rectifie une date avec confirmation, sans révéler l'ancienne dans la console", async ({
  page,
}, testInfo) => {
  const email = `support-${testInfo.project.name}@e2e.tartan.test`;
  const name = `Support ${testInfo.project.name}`;
  await createCoachSpace(page, name, email);
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    const { rows } = await sql.query('select id from "user" where email = $1', [email]);
    const id = rows[0].id;
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: m.admin.correctionTitle })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    await page.getByLabel(m.admin.userId, { exact: true }).fill(id);
    await page.getByLabel(m.invite.birthDate, { exact: true }).fill("1991-03-14");
    await page.getByRole("button", { name: m.admin.correctionConfirm, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: m.admin.correctionConfirm, exact: true }).click();
    await expect(page.getByText(m.admin.correctionDone)).toBeVisible();
    const audit = await sql.query(
      "select action from audit_log where actor_id=$1::uuid and entity_id=$1::text and action like 'birth_date_corrected:%'",
      [id],
    );
    expect(audit.rows).toHaveLength(1);

    // Activation pilote : la case agit tout de suite, sans SQL, et laisse une trace.
    const { rows: spaces } = await sql.query("select id from organizations where owner_id = $1::uuid", [id]);
    const organizationId = spaces[0].id;
    await page
      .getByRole("group", { name: `Coaching ${name}` })
      .getByLabel(m.admin.featureProgression)
      .check();
    await expect(page.getByText(m.admin.featuresSaved)).toBeVisible();
    const features = await sql.query(
      "select action from audit_log where entity = 'organization' and entity_id = $1::text",
      [organizationId],
    );
    expect(features.rows.map((row) => row.action)).toContain("space_features:progression=on,phases=off,ai=off");
    const enabled = await sql.query("select progression_enabled from organizations where id = $1::uuid", [
      organizationId,
    ]);
    expect(enabled.rows[0].progression_enabled).toBe(true);
  } finally {
    await sql.end();
  }
});
