import { expect, test, type Page } from "@playwright/test";
import type { ExerciseList } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { today } from "./journeys";

const t = w.exercises;
const LIST = "Liste du lot";
const OWN = "Sauts de la liste";

// La bibliothèque du constructeur : sa colonne sur ordinateur, sa feuille ailleurs.
const builderLibrary = async (page: Page) => {
  const opener = page.getByRole("button", { name: t.picker.open, exact: true });
  const aside = page.getByRole("complementary", { name: m.builder.library });
  await expect(aside.getByPlaceholder(m.builder.sequence.searchExercise).or(opener)).toBeVisible({ timeout: 30_000 });
  if (!(await opener.isVisible())) return { scope: aside, sheet: false };
  await opener.click();
  return { scope: page.getByRole("dialog"), sheet: true };
};

test("listes du coach : favori, liste partagée, création dans la liste, séance publiée, copie personnalisée", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await createCoachSpace(page, "Listes");
  const me = await (await page.request.get("/api/v1/me")).json();
  const root = `/api/v1/orgs/${me.spaces[0].organizationId}`;
  const lists = async (): Promise<ExerciseList[]> => (await page.request.get(`${root}/exercise-lists`)).json();

  // Une liste se crée depuis les pastilles de la bibliothèque, et devient le filtre choisi.
  await page.goto("/exercices", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: t.lists.new, exact: true }).click();
  await page.getByRole("dialog").getByLabel(t.lists.name, { exact: true }).fill(LIST);
  await page.getByRole("dialog").getByRole("button", { name: t.lists.create, exact: true }).click();
  await expect(page.getByRole("heading", { name: LIST, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: LIST, exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(t.lists.empty)).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);

  // Partagée avec les coachs de l'espace : un interrupteur, privée par défaut.
  await page.getByRole("checkbox", { name: new RegExp(t.lists.share) }).check();
  await expect.poll(async () => (await lists()).find((list) => list.name === LIST)?.sharedWithCoaches).toBe(true);

  // Depuis la bibliothèque : une étoile, et le rangement dans la liste.
  await page.getByRole("button", { name: t.filters.all, exact: true }).click();
  await page.getByLabel(m.exercises.search, { exact: true }).fill("Goblet");
  const star = page.getByRole("button", { name: t.favorite.add("Goblet squat"), exact: true });
  await star.click();
  await expect(page.getByRole("button", { name: t.favorite.remove("Goblet squat"), exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: t.lists.file("Goblet squat"), exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("checkbox", { name: new RegExp(LIST) })
    .check();
  await expect.poll(async () => (await lists()).find((list) => list.name === LIST)?.exerciseIds.length).toBe(1);
  await page.keyboard.press("Escape");
  await page.getByLabel(m.exercises.search, { exact: true }).fill("");
  await page.getByRole("button", { name: t.filters.favorites, exact: true }).click();
  await expect(page.getByRole("link", { name: /^Goblet squat/ })).toBeVisible();
  await expect(page.getByText(t.results(1), { exact: true })).toBeVisible();

  // « Créer un exercice » directement dans la liste.
  await page.getByRole("button", { name: LIST, exact: true }).click();
  await expect(page.getByRole("link", { name: /^Goblet squat/ })).toBeVisible();
  await page.getByRole("button", { name: t.lists.createInList, exact: true }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel(m.exercises.name, { exact: true }).fill(OWN);
  await form.getByLabel(m.exercises.category, { exact: true }).selectOption("plyo");
  await form.getByLabel(m.builder.sets, { exact: true }).fill("3");
  await form.getByLabel(m.builder.reps, { exact: true }).fill("6");
  await form.getByRole("button", { name: m.common.save, exact: true }).click();
  await expect(form).toBeHidden();
  await expect(page.getByRole("link", { name: new RegExp(`^${OWN}`) })).toBeVisible();
  await expect(page.getByText(t.results(2), { exact: true })).toBeVisible();

  // Le sélecteur du constructeur filtre sur la liste, puis la séance part avec la fiche de la liste.
  const title = "Séance de la liste";
  await page.goto(`/seances/nouvelle?date=${today()}`, { waitUntil: "networkidle" });
  await page.getByLabel(m.builder.titleLabel, { exact: true }).locator("visible=true").fill(title);
  const library = await builderLibrary(page);
  await library.scope.getByRole("button", { name: LIST, exact: true }).click();
  await expect(library.scope.getByText(t.results(2), { exact: true })).toBeVisible();
  await expect(library.scope.getByRole("button", { name: t.picker.preview("Accélérations") })).toHaveCount(0);
  // L'aperçu montre la fiche concise sans quitter le constructeur.
  await library.scope.getByRole("button", { name: t.picker.preview("Goblet squat"), exact: true }).click();
  await expect(library.scope.getByRole("region", { name: m.exerciseGuide.title })).toBeVisible();
  await library.scope.getByRole("button", { name: t.picker.back, exact: true }).click();
  await library.scope.getByRole("button", { name: m.builder.sequence.addToSession(OWN), exact: true }).click();
  if (library.sheet) {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  }
  const body = page.getByRole("region", { name: m.builder.body, exact: true });
  await expect(body.getByRole("listitem").filter({ hasText: OWN })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole("tab", { name: "En autonomie" }).click();
  await page.getByRole("button", { name: "Générer depuis la version club" }).click();
  await page.getByRole("tab", { name: "Au club" }).click();
  await page.getByRole("button", { name: "Publier", exact: true }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText(OWN).first()).toBeVisible();

  // « Personnaliser » une fiche commune : la copie garde le guide et prend sa place dans la liste.
  const goblet = (await lists()).find((list) => list.name === LIST)!.exerciseIds[0]!;
  await page.goto(`/exercices/${goblet}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("region", { name: m.exerciseGuide.title })).toBeVisible();
  await page.getByRole("button", { name: t.sheet.personalize, exact: true }).click();
  await expect(page).not.toHaveURL(new RegExp(`/exercices/${goblet}$`));
  await expect(page.getByRole("button", { name: m.common.edit, exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: m.exerciseGuide.title })).toBeVisible();
  const copy = page.url().split("/").pop()!;
  await expect.poll(async () => (await lists()).find((list) => list.name === LIST)?.exerciseIds).toContain(copy);
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
});
