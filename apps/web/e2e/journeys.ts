import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { expect, type Browser, type Page } from "@playwright/test";
import { addFromLibrary, signUp, uniqueEmail } from "./helpers";

export const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());

/**
 * Le formulaire complet d'une fiche neuve, comme un coach y arrive : la création rapide par son nom, puis
 * « Compléter la fiche ». Rend le dialogue du formulaire, ouvert sur la page de la fiche.
 */
export const openFullExerciseForm = async (page: Page, name: string) => {
  await page.goto("/exercices?nouveau=1");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(m.exercises.name, { exact: true }).fill(name);
  await dialog.getByRole("button", { name: w.exercises.finder.quick.submitInLibrary, exact: true }).click();
  await dialog.getByRole("link", { name: w.exercises.finder.complete, exact: true }).click();
  await expect(page).toHaveURL(/\/exercices\/[0-9a-f-]{36}\?modifier=1$/);
  await expect(dialog.getByLabel(m.exercises.aliases, { exact: true })).toBeVisible();
  await expect(dialog.getByLabel(m.exercises.name, { exact: true })).toHaveValue(name);
  return dialog;
};

export const createExercise = async (page: Page, name: string) => {
  await openFullExerciseForm(page, name);
  await page.getByLabel("Consignes clés").fill("Pieds actifs\nBras synchronisés");
  await page.getByLabel("Séries").fill("4");
  await page.getByLabel("Rép.").fill("5");
  await page.getByLabel("Lien YouTube").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42");
  await page.getByLabel("Nom affiché").fill("Démo courte");
  await page.getByLabel("Fin (s)").fill("90");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  // La fiche complétée reste ouverte, à son adresse.
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/exercices\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
};

export const groupLink = async (page: Page): Promise<string> => {
  await page.goto("/reglages/groupes");
  await page.getByRole("button", { name: "Lien du groupe" }).click();
  const input = page.getByLabel("Lien d'invitation du groupe");
  await expect(input).toHaveValue(/\/i\//);
  return input.inputValue();
};

export const joinAsAthlete = async (
  browser: Browser,
  link: string,
  firstName: string,
  opts: { health?: boolean; groupName?: string } = {},
) => {
  const context = await browser.newContext({
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(link);
  await expect(page.getByRole("heading", { name: /t'invite à rejoindre/ })).toContainText(
    opts.groupName ?? "Hauteur Élite",
  );
  await signUp(page, uniqueEmail(firstName.toLowerCase()), new URL(link).pathname);
  await page.getByLabel("Prénom").fill(firstName);
  await page.getByLabel("Nom", { exact: true }).fill("Test");
  await page.getByLabel("Date de naissance").fill("2004-05-12");
  await page.getByRole("checkbox", { name: /conditions d'utilisation/ }).check();
  if (opts.health !== false) await page.getByRole("checkbox", { name: /informations de santé/ }).check();
  await page.getByRole("checkbox", { name: /me filment/ }).check();
  await page.getByRole("button", { name: "Rejoindre le groupe" }).click();
  await page.getByRole("button", { name: m.age.saveConfirmed, exact: true }).click();
  await expect(page.getByRole("heading", { name: `Salut ${firstName}` })).toBeVisible();
  return { context, page };
};

export const publishSession = async (page: Page, title: string, exercise: string) => {
  // Pendant le rendu en flux, React peut remplacer le formulaire : on attend la fin, puis on vise la copie affichée.
  await page.goto(`/seances/nouvelle?date=${today()}`, { waitUntil: "networkidle" });
  await page.getByLabel("Titre").locator("visible=true").fill(title);
  await addFromLibrary(page, exercise);
  await expect(page.getByRole("button", { name: new RegExp(exercise) }).first()).toBeVisible();
  await page.getByRole("tab", { name: "En autonomie" }).click();
  await page.getByRole("button", { name: "Générer depuis la version club" }).click();
  await page.getByRole("tab", { name: "Au club" }).click();
  await page.getByRole("button", { name: "Publier", exact: true }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
};
