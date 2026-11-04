import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import { Client } from "pg";

const DB = process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e";

export const PASSWORD = "mot-de-passe-de-test-e2e";

const slug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[^a-z]/gi, "")
    .toLowerCase();

export const uniqueEmail = (name: string) =>
  `${slug(name)}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.tartan.test`;

export const signUp = async (page: Page, email: string, next = "/connexion") => {
  await page.goto(next, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Utiliser un mot de passe" }).click();
  await page.getByRole("button", { name: /Pas encore de compte/ }).click();
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte", exact: true }).click();
  // Le lien de confirmation part par e-mail : le test le remplace par une écriture en base.
  await expect(page.getByText(m.auth.verifySent)).toBeVisible();
  const sql = new Client({ connectionString: DB });
  await sql.connect();
  await sql.query(`update "user" set email_verified = true where email = $1`, [email]);
  await sql.end();
  await page.goto(next, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Utiliser un mot de passe" }).click();
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  const signIn = page.getByRole("button", { name: m.auth.signInWithPassword, exact: true });
  await signIn.click();
  // La connexion recharge la page : un champ rempli avant la fin serait perdu.
  await expect(signIn).toBeHidden();
  await page.waitForLoadState("networkidle");
};

export const createCoachSpace = async (page: Page, name = "Thomas") => {
  await signUp(page, uniqueEmail(name.toLowerCase()));
  // En développement, la première compilation d'une page peut prendre longtemps.
  await expect(page.getByRole("heading", { name: "Crée ton espace coach" })).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  // Le début de l'adresse n'est pas un prénom : le champ attend le vrai.
  await expect(page.getByLabel("Prénom")).toHaveValue("");
  await page.getByLabel("Prénom").fill(name);
  await page.getByLabel("Nom", { exact: true }).fill("Coach");
  await page.getByLabel("Date de naissance").fill("1985-03-14");
  await page.getByLabel("Nom du club ou de ton coaching").fill(`Coaching ${name}`);
  await page.getByLabel("Premier groupe").fill("Hauteur Élite");
  await page.getByRole("checkbox", { name: /conditions d'utilisation/ }).check();
  await page.getByRole("button", { name: "Créer mon espace" }).click();
  await expect(page.getByRole("heading", { name: "Suivi du groupe" })).toBeVisible({ timeout: 60_000 });
  // Un espace neuf guide le coach, même avec sa bibliothèque de départ.
  await expect(page.getByRole("heading", { name: "Pour démarrer" })).toBeVisible();
};

export const expectAccessible = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
};

export const expectNoHorizontalScroll = async (page: Page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
};
