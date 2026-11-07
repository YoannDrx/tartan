import { m } from "@tartan/i18n";
import { expect, type Browser, type Page } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

export const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());

export const createExercise = async (page: Page, name: string) => {
  await page.goto("/exercices?nouveau=1");
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByLabel("Consignes clés").fill("Pieds actifs\nBras synchronisés");
  await page.getByLabel("Séries").fill("4");
  await page.getByLabel("Rép.").fill("5");
  await page.getByLabel("Lien YouTube").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42");
  await page.getByLabel("Nom affiché").fill("Démo courte");
  await page.getByLabel("Fin (s)").fill("90");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  // Le nom exact : la bibliothèque de départ contient des exercices aux noms voisins.
  await expect(page.getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) })).toBeVisible();
};

export const groupLink = async (page: Page): Promise<string> => {
  await page.goto("/reglages");
  await page.getByRole("button", { name: "Lien du groupe" }).click();
  const input = page.getByLabel("Lien d'invitation du groupe");
  await expect(input).toHaveValue(/\/i\//);
  return input.inputValue();
};

export const joinAsAthlete = async (
  browser: Browser,
  link: string,
  firstName: string,
  opts: { health?: boolean } = {},
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
  await expect(page.getByRole("heading", { name: /t'invite à rejoindre Hauteur Élite/ })).toBeVisible();
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
  await page.getByRole("button", { name: `Ajouter ${exercise} à la séance` }).click();
  await expect(page.getByRole("button", { name: new RegExp(exercise) }).first()).toBeVisible();
  await page.getByRole("tab", { name: "En autonomie" }).click();
  await page.getByRole("button", { name: "Générer depuis la version club" }).click();
  await page.getByRole("tab", { name: "Au club" }).click();
  await page.getByRole("button", { name: "Publier", exact: true }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
};
