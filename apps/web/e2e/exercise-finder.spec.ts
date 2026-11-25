import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { ExerciseSummary } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll, expectNoMotion } from "./helpers";
import { today } from "./journeys";

const t = w.exercises;
const f = t.finder;
// Captures de recette, hors dépôt : `E2E_SHOTS_DIR=/chemin E2E_PROD=1 corepack pnpm test:e2e e2e/exercise-finder.spec.ts`.
const SHOTS = process.env.E2E_SHOTS_DIR;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

const MISSING = "Tirage menton câble";
const SEARCHED = "rdl maison";
const RENAMED = "Soulevé roumain maison";

// Atteindre un contrôle comme au clavier : Tab jusqu'à lui, sans jamais le viser à la souris.
const tabTo = async (page: Page, target: Locator, key: "Tab" | "Shift+Tab" = "Tab", limit = 150) => {
  for (let presses = 0; presses < limit; presses += 1) {
    if (await target.evaluate((element) => element === document.activeElement).catch(() => false)) return;
    await page.keyboard.press(key);
  }
  await expect(target, "le contrôle doit s'atteindre au clavier").toBeFocused();
};

// La recherche part au serveur : on attend la réponse à ce terme avant de lire les résultats.
const typeSearch = async (page: Page, term: string) => {
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      (response.request().postData() ?? "").includes(`"q":${JSON.stringify(term)}`),
  );
  await page.keyboard.type(term);
  await answered;
};

// La bibliothèque du constructeur, ouverte au clavier : sa colonne sur ordinateur, sa feuille ailleurs.
const openLibrary = async (page: Page) => {
  const opener = page.getByRole("button", { name: t.picker.open, exact: true });
  const aside = page.getByRole("complementary", { name: m.builder.library });
  await expect(aside.getByPlaceholder(m.exercises.search).or(opener)).toBeVisible({ timeout: 30_000 });
  const sheet = await opener.isVisible();
  if (sheet) {
    await tabTo(page, opener);
    await page.keyboard.press("Enter");
  }
  const scope = sheet ? page.getByRole("dialog") : aside;
  const field = scope.getByPlaceholder(m.exercises.search);
  // La feuille pose la saisie dans la recherche ; la colonne s'atteint au Tab.
  if (sheet) await expect(field).toBeFocused();
  else await tabTo(page, field);
  return { scope, field, sheet };
};

for (const size of [
  { project: "mobile", width: 390, height: 844 },
  { project: "desktop", width: 1440, height: 900 },
]) {
  test(`chercher ou créer un exercice au clavier, sans quitter la séance (${size.width} px)`, async ({
    page,
    context,
  }, info) => {
    test.skip(info.project.name !== size.project, "une largeur par projet");
    test.setTimeout(240_000);
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await createCoachSpace(page, "Chercher");
    const me = await (await page.request.get("/api/v1/me")).json();
    const root = `/api/v1/orgs/${me.spaces[0].organizationId}`;
    const named = async (name: string): Promise<ExerciseSummary[]> =>
      (await (await page.request.get(`${root}/exercises`)).json()).filter((e: ExerciseSummary) => e.name === name);

    const title = "Séance du chercheur";
    await page.goto(`/seances/nouvelle?date=${today()}`, { waitUntil: "networkidle" });
    await page.getByLabel(m.builder.titleLabel, { exact: true }).locator("visible=true").fill(title);
    // Sous la feuille ouverte, la séance sort de l'arbre d'accessibilité : on la lit par son contenu.
    const inSession = (exercise: string) =>
      page.locator(`[aria-label="${m.builder.body}"] li`).filter({ hasText: exercise }).first();
    const { scope, field, sheet } = await openLibrary(page);
    await expect(scope.getByText(/^\d+ fiches$/)).toBeVisible();
    await shot(page, `apres-${size.width}-1-recherche-vide`);

    // Un terme absent : aucune fiche, et la ligne qui crée, que la touche Entrée prend sans flèche.
    await typeSearch(page, MISSING);
    await expect(scope.getByText(t.results(0), { exact: true })).toBeVisible();
    await expect(scope.getByText(f.noMatch, { exact: true })).toBeVisible();
    const createRow = scope.getByRole("button", { name: new RegExp(`^${f.create(MISSING)}`) });
    await expect(createRow).toBeVisible();
    // Plus aucun renvoi vers la bibliothèque : la séance en cours ne se quitte pas.
    await expect(scope.getByRole("link", { name: m.builder.sequence.createInLibrary })).toHaveCount(0);
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await shot(page, `apres-${size.width}-2-terme-absent`);
    await page.keyboard.press("Enter");

    // La création rapide : le nom repris, la famille et la charge déjà choisies, un seul bouton.
    await expect(scope.getByRole("heading", { name: f.quick.title, exact: true })).toBeVisible();
    const name = scope.getByLabel(m.exercises.name, { exact: true });
    await expect(name).toBeFocused();
    await expect(name).toHaveValue(MISSING);
    const strength = scope.getByRole("radio", { name: m.exerciseCategory.strength, exact: true });
    await expect(strength).toBeChecked();
    await expect(scope.getByRole("radio", { name: f.quick.loadKinds.external_total, exact: true })).toBeChecked();
    await expect(scope.getByRole("checkbox")).toHaveCount(0);
    await expect(scope.getByRole("textbox")).toHaveCount(1);
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await expectNoMotion(page);
    await shot(page, `apres-${size.width}-3-creation-rapide`);
    // Les pastilles se changent aux flèches, comme tout groupe de boutons radio.
    await tabTo(page, strength);
    await page.keyboard.press("ArrowRight");
    await expect(scope.getByRole("radio", { name: m.exerciseCategory.plyo, exact: true })).toBeChecked();
    // Une autre famille n'hérite pas de la charge proposée pour la musculation.
    await expect(scope.getByRole("radio", { name: f.quick.loadKinds.none, exact: true })).toBeChecked();
    await page.keyboard.press("ArrowLeft");
    await expect(strength).toBeChecked();
    await expect(scope.getByRole("radio", { name: f.quick.loadKinds.external_total, exact: true })).toBeChecked();
    await tabTo(page, scope.getByRole("button", { name: f.quick.submit, exact: true }));
    await page.keyboard.press("Enter");

    // Créée, la fiche est dans la séance ; la recherche reprend, vide, avec le chemin pour la compléter.
    await expect(inSession(MISSING)).toBeAttached();
    await expect(scope.getByText(f.created(MISSING), { exact: true })).toBeVisible();
    await expect(field).toBeFocused();
    await expect(field).toHaveValue("");
    const complete = scope.getByRole("link", { name: new RegExp(`^${f.complete}`) });
    await expect(complete).toHaveAttribute("target", "_blank");
    await expect(page).toHaveURL(/\/seances\/nouvelle/);
    expect(await named(MISSING)).toMatchObject([
      { shared: false, category: "strength", strengthLoadKind: "external_total", aliases: [] },
    ]);
    await expectAccessible(page);
    await shot(page, `apres-${size.width}-4-fiche-dans-la-seance`);

    // Un autre terme, un nom corrigé avant de créer : Entrée dans le champ suffit, le terme reste un autre nom.
    await typeSearch(page, SEARCHED);
    await expect(scope.getByText(f.noMatch, { exact: true })).toBeVisible();
    await expect(scope.getByRole("button", { name: new RegExp(`^${f.create(SEARCHED)}`) })).toBeEnabled();
    await page.keyboard.press("Enter");
    await expect(name).toHaveValue(SEARCHED);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(RENAMED);
    await page.keyboard.press("Enter");
    await expect(inSession(RENAMED)).toBeAttached();
    expect(await named(RENAMED)).toMatchObject([{ aliases: [SEARCHED] }]);

    // Les flèches parcourent les fiches trouvées depuis le champ ; Entrée ajoute celle qui est désignée.
    await expect(field).toBeFocused();
    await typeSearch(page, "goblet");
    await expect(scope.getByRole("button", { name: /^Goblet squat .*voir la fiche$/ })).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(scope.getByText(/^Goblet squat, fiche 1 sur \d+$/)).toBeAttached();
    await page.keyboard.press("Enter");
    await expect(inSession("Goblet squat")).toBeAttached();

    // Le même nom, à la casse et aux accents près : la fiche existante est proposée, rien n'est recréé.
    await page.keyboard.press("ControlOrMeta+a");
    await typeSearch(page, "tirage MENTON cable");
    await expect(scope.getByText(t.results(1), { exact: true })).toBeVisible();
    await page.keyboard.press("ArrowUp");
    await expect(scope.getByText(f.onCreate("tirage MENTON cable"), { exact: true })).toBeAttached();
    await page.keyboard.press("Enter");
    await expect(scope.getByText(f.quick.exists(MISSING), { exact: true })).toBeVisible();
    await expect(scope.getByRole("radio")).toHaveCount(0);
    await expectAccessible(page);
    // Les messages des ajouts précédents s'effacent seuls : la capture montre la feuille, pas eux.
    if (SHOTS) await expect(page.getByText(t.picker.added("Goblet squat"), { exact: true })).toBeHidden();
    await shot(page, `apres-${size.width}-5-fiche-existante`);
    await tabTo(page, scope.getByRole("button", { name: f.quick.useExisting, exact: true }));
    await page.keyboard.press("Enter");
    await expect(scope.getByText(f.reused(MISSING), { exact: true })).toBeVisible();
    expect(await named(MISSING)).toHaveLength(1);

    // « Compléter la fiche » ouvre le formulaire complet dans un autre onglet : la séance garde son travail.
    const opened = context.waitForEvent("page");
    await expect(field).toBeFocused();
    await tabTo(page, complete, "Shift+Tab");
    await page.keyboard.press("Enter");
    const sheetPage = await opened;
    await sheetPage.setViewportSize({ width: size.width, height: size.height });
    const form = sheetPage.getByRole("dialog");
    await expect(form.getByLabel(m.exercises.name, { exact: true })).toHaveValue(MISSING);
    await form.getByLabel(m.exercises.cues, { exact: true }).fill("Coudes hauts\nBuste gainé");
    await form.getByLabel(m.builder.sets, { exact: true }).fill("3");
    await form.getByLabel(m.builder.reps, { exact: true }).fill("10");
    await form.getByLabel(m.builder.strides, { exact: true }).fill("8");
    await form.getByLabel(m.builder.coneSpacing, { exact: true }).fill("4.5");
    await expectAccessible(sheetPage);
    await expectNoHorizontalScroll(sheetPage);
    await shot(sheetPage, `apres-${size.width}-6-completer-la-fiche`);
    await form.getByRole("button", { name: m.common.save, exact: true }).click();
    await expect(form).toBeHidden();
    await expect(sheetPage).toHaveURL(/\/exercices\/[0-9a-f-]{36}$/);
    await expect(sheetPage.getByRole("heading", { level: 1, name: MISSING, exact: true })).toBeVisible();
    await expect(sheetPage.getByText("Coudes hauts", { exact: true })).toBeVisible();
    await expect(sheetPage.getByText(/8 foulées · 4,5 pieds entre deux plots/)).toBeVisible();
    await sheetPage.close();
    await page.bringToFront();

    // La séance n'a pas bougé : elle se publie avec les fiches créées à l'instant.
    if (sheet) {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
    }
    await expect(page.getByLabel(m.builder.titleLabel, { exact: true }).locator("visible=true")).toHaveValue(title);
    for (const exercise of [MISSING, RENAMED, "Goblet squat"]) await expect(inSession(exercise)).toBeVisible();
    await expect(page.getByText(m.nativeBuilder.localSaved, { exact: true })).toBeVisible();
    await page.goto("/exercices");
    if (size.width === 390) {
      // Ancienne copie locale, écrite avant que le constructeur conserve les noms.
      await page.evaluate(() => {
        const key = Object.keys(localStorage).find((entry) => entry.startsWith("tartan.builder.web."))!;
        const stored = JSON.parse(localStorage.getItem(key)!);
        delete stored.form.exercises;
        localStorage.setItem(key, JSON.stringify(stored));
      });
    }
    await page.goBack();
    await page.getByRole("button", { name: m.nativeBuilder.restore, exact: true }).click();
    for (const exercise of [MISSING, RENAMED, "Goblet squat"]) await expect(inSession(exercise)).toBeVisible();
    await expect(page.getByText(m.builder.sequence.deletedExercise, { exact: true })).toHaveCount(0);
    const block = page.getByRole("region", { name: m.builder.blocks.main, exact: true });
    await block.getByRole("button", { name: m.builder.duplicateBlock }).click();
    await expect(block).toHaveCount(2);
    await expect(block.nth(1).getByText(RENAMED, { exact: true }).first()).toBeVisible();
    await block.nth(1).getByRole("button", { name: m.builder.deleteBlock }).click();
    await page.getByRole("dialog").getByRole("button", { name: m.common.delete, exact: true }).click();
    await expect(block).toHaveCount(1);
    await expectNoHorizontalScroll(page);
    await page.getByRole("tab", { name: "En autonomie" }).click();
    await page.getByRole("button", { name: "Générer depuis la version club" }).click();
    await page.getByRole("tab", { name: "Au club" }).click();
    await page.getByRole("button", { name: "Publier", exact: true }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    // Publiée, la séance garde les fiches créées : le constructeur la rouvre avec elles.
    await page.getByRole("link", { name: m.common.edit, exact: true }).click();
    for (const exercise of [MISSING, RENAMED]) await expect(inSession(exercise)).toBeVisible();

    // Dans la bibliothèque, la fiche se retrouve par son nom comme par ce que le coach cherchait.
    await page.goto("/exercices", { waitUntil: "networkidle" });
    const search = page.getByLabel(m.exercises.search, { exact: true });
    await search.fill(SEARCHED);
    await expect(page.getByRole("link", { name: new RegExp(`^${RENAMED}`) })).toBeVisible();
    await search.fill("tirage menton");
    await page.getByRole("link", { name: new RegExp(`^${MISSING}`) }).click();
    await expect(page.getByRole("heading", { level: 1, name: MISSING, exact: true })).toBeVisible();
    await expect(page.getByText("Coudes hauts", { exact: true })).toBeVisible();

    // La bibliothèque crée de la même façon : ce qui est cherché sans être trouvé devient le nom proposé.
    await page.goto("/exercices", { waitUntil: "networkidle" });
    await search.fill("Marche du fermier lourde");
    await expect(page.getByText(t.results(0), { exact: true })).toBeVisible();
    await page.getByRole("button", { name: f.create("Marche du fermier lourde"), exact: true }).click();
    const quick = page.getByRole("dialog");
    await expect(quick.getByLabel(m.exercises.name, { exact: true })).toHaveValue("Marche du fermier lourde");
    await expect(quick.getByRole("radio", { checked: true })).toHaveCount(2);
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await expectNoMotion(page);
    await shot(page, `apres-${size.width}-7-bibliotheque-creation`);
    await quick.getByRole("button", { name: f.quick.submitInLibrary, exact: true }).click();
    await expect(quick.getByText(f.created("Marche du fermier lourde"), { exact: true })).toBeVisible();
    await expect(quick.getByRole("link", { name: f.complete, exact: true })).toHaveAttribute(
      "href",
      /\/exercices\/[0-9a-f-]{36}\?modifier=1$/,
    );
    await expectAccessible(page);
    await shot(page, `apres-${size.width}-8-bibliotheque-creee`);
    await quick.getByRole("button", { name: f.quick.done, exact: true }).click();
    await expect(quick).toBeHidden();
    await expect(page.getByRole("link", { name: /^Marche du fermier lourde/ })).toBeVisible();
    // Le même nom une seconde fois : la fiche existante s'ouvre, sans doublon.
    await page.goto("/exercices?nouveau=1", { waitUntil: "networkidle" });
    await quick.getByLabel(m.exercises.name, { exact: true }).fill("marche du fermier LOURDE");
    await expect(quick.getByText(f.quick.exists("Marche du fermier lourde"), { exact: true })).toBeVisible();
    await quick.getByRole("button", { name: f.quick.openExisting, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Marche du fermier lourde", exact: true })).toBeVisible();
    expect(await named("Marche du fermier lourde")).toHaveLength(1);
  });
}

test("la feuille de recherche et de création tient à 768 px", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "une seule fois, sur le moteur de bureau");
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await createCoachSpace(page, "Tablette");
  await page.goto(`/seances/nouvelle?date=${today()}`, { waitUntil: "networkidle" });
  const { scope, sheet } = await openLibrary(page);
  expect(sheet, "sous 1024 px, la bibliothèque est une feuille").toBe(true);
  await typeSearch(page, "squat bulgare lesté");
  await expect(scope.getByText(t.results(0), { exact: true })).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await shot(page, "apres-768-2-terme-absent");
  await page.keyboard.press("Enter");
  // La fiche la plus proche du catalogue donne la famille ; « lesté » donne la charge.
  await expect(scope.getByRole("radio", { name: m.exerciseCategory.strength, exact: true })).toBeChecked();
  await expect(scope.getByRole("radio", { name: f.quick.loadKinds.added_weight, exact: true })).toBeChecked();
  await expect(scope.getByText(f.quick.basedOn("Squat bulgare"), { exact: true })).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await expectNoMotion(page);
  await shot(page, "apres-768-3-creation-rapide");
  // « Retour aux résultats » rend la recherche telle qu'elle était, la saisie dans le champ.
  await scope.getByRole("button", { name: t.picker.back, exact: true }).click();
  await expect(scope.getByPlaceholder(m.exercises.search)).toBeFocused();
  await expect(scope.getByPlaceholder(m.exercises.search)).toHaveValue("squat bulgare lesté");
});
