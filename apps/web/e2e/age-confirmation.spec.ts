import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { expectAccessible, nextOnboardingStep, signUp, uniqueEmail } from "./helpers";

test("l'onboarding permet de corriger la date avant de créer l'espace", async ({ page }) => {
  const email = uniqueEmail("date-onboarding");
  await signUp(page, email);
  await page.getByLabel("Prénom").fill("Camille");
  await page.getByLabel("Nom", { exact: true }).fill("Coach");
  await page.getByLabel(m.invite.birthDate).fill("2015-01-01");
  await nextOnboardingStep(page);
  await page.getByLabel(m.onboarding.orgName).fill("Recette physique");
  await page.getByLabel(m.onboarding.firstGroup, { exact: true }).fill("Sprint");
  await nextOnboardingStep(page);
  await page.getByRole("checkbox", { name: /conditions d'utilisation/ }).check();
  await page.getByRole("button", { name: m.onboarding.createSpace, exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: m.age.correct, exact: true }).click();
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    const { rows } = await sql.query(
      'select p.birth_date, (select count(*) from organizations o where o.owner_id = u.id)::int as spaces from "user" u left join profiles p on p.id = u.id where u.email = $1',
      [email],
    );
    expect(rows[0]?.birth_date ?? null).toBeNull();
    expect(rows[0]?.spaces).toBe(0);
    // « Corriger » ramène au premier temps, où se trouve la date.
    await page.getByLabel(m.invite.birthDate).fill("1990-01-01");
    await nextOnboardingStep(page);
    await nextOnboardingStep(page);
    await page.getByRole("button", { name: m.onboarding.createSpace, exact: true }).click();
    await page.getByRole("button", { name: m.age.saveConfirmed, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Suivi du groupe" })).toBeVisible();
  } finally {
    await sql.end();
  }
});

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
