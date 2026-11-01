import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "mot-de-passe-de-test-e2e";

const slug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[^a-z]/gi, "")
    .toLowerCase();

export const uniqueEmail = (name: string) =>
  `${slug(name)}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.tartan.test`;

export const signUp = async (page: Page, email: string, next = "/connexion") => {
  await page.goto(next);
  await page.getByRole("button", { name: "Utiliser un mot de passe" }).click();
  await page.getByRole("button", { name: /Pas encore de compte/ }).click();
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte", exact: true }).click();
};

export const createCoachSpace = async (page: Page, name = "Thomas") => {
  await signUp(page, uniqueEmail(name.toLowerCase()));
  await expect(page.getByRole("heading", { name: "Crée ton espace coach" })).toBeVisible();
  await page.getByLabel("Prénom").fill(name);
  await page.getByLabel("Nom", { exact: true }).fill("Coach");
  await page.getByLabel("Nom du club ou de ton coaching").fill(`Coaching ${name}`);
  await page.getByLabel("Premier groupe").fill("Hauteur Élite");
  await page.getByRole("button", { name: "Créer mon espace" }).click();
  await expect(page.getByRole("heading", { name: "Suivi du groupe" })).toBeVisible();
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
