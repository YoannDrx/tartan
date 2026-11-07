import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { expectAccessible, signUp, uniqueEmail } from "./helpers";

test("la date ne s'enregistre qu'après confirmation et peut être corrigée avant", async ({ page }) => {
  const email = uniqueEmail("date-confirmation");
  await signUp(page, email, "/connexion?next=%2Fconfirmer-age");
  await page.getByLabel(m.invite.birthDate).fill("2015-01-01");
  await page.getByRole("button", { name: m.age.confirm, exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: m.age.correct, exact: true }).click();
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    const { rows } = await sql.query(
      'select p.birth_date from profiles p join "user" u on u.id = p.id where u.email = $1',
      [email],
    );
    expect(rows[0]?.birth_date ?? null).toBeNull();
    await page.getByLabel(m.invite.birthDate).fill("1990-01-01");
    await page.getByRole("button", { name: m.age.confirm, exact: true }).click();
    await page.getByRole("button", { name: m.age.saveConfirmed, exact: true }).click();
    await expect(page).toHaveURL(/bienvenue/);
    const saved = await sql.query(
      'select p.birth_date from profiles p join "user" u on u.id = p.id where u.email = $1',
      [email],
    );
    expect(saved.rows[0].birth_date).toBeTruthy();
  } finally {
    await sql.end();
  }
});
