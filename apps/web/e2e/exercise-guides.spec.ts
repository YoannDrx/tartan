import { expect, test, type Page } from "@playwright/test";
import { EXERCISE_CATALOG, STADIUM_EDITION } from "@tartan/domain/exercise-catalog";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import type { ExerciseSummary } from "@tartan/contracts";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { groupLink, joinAsAthlete, today } from "./journeys";

test("catalogue : recherche, guide figé et consultation de la séance attribuée", async ({ page, browser }, info) => {
  test.setTimeout(240_000);
  const inspect = async (target: Page, screen: string) => {
    await target.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [390, 768, 1440]) {
      await target.setViewportSize({ width, height: 900 });
      for (const theme of ["tartan", "light", "dark"]) {
        await target.evaluate(
          (value) => document.querySelector("[data-theme]")?.setAttribute("data-theme", value),
          theme,
        );
        await expectNoHorizontalScroll(target);
        await expectAccessible(target);
        if (info.project.name === "desktop")
          await target.screenshot({ path: `/tmp/tartan-guide-${screen}-${theme}-${width}.png`, fullPage: true });
      }
    }
  };
  await createCoachSpace(page, "Guides");
  const me = await (await page.request.get("/api/v1/me")).json();
  const root = `/api/v1/orgs/${me.spaces[0].organizationId}`;
  const library: ExerciseSummary[] = await (await page.request.get(`${root}/exercises`)).json();
  const expected = [...EXERCISE_CATALOG, ...STADIUM_EDITION].map((entry) => entry.catalogKey).sort();
  const guides = library.flatMap(({ guide }) => (guide ? [guide] : []));
  expect(guides.map((guide) => guide.catalogKey).sort()).toEqual(expected);
  expect(guides.filter((guide) => guide.technicalReview === "approved")).toHaveLength(233);
  expect(guides.filter((guide) => guide.illustration.photo)).toHaveLength(233);
  const snatch = library.find((e) => e.name === "Arraché")!;
  const motion = m.exerciseGuide.motion;
  const g = w.exercises.guide;
  // Un seul système de filtres : la famille est une pastille, l'haltérophilie a la sienne.
  await page.goto("/exercices", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: m.exerciseGuide.families.weightlifting, exact: true }).click();
  await page.getByLabel(m.exercises.search, { exact: true }).fill("Squat snatch");
  // La fiche a sa propre adresse : on l'ouvre, on ne la regarde plus dans un dialogue.
  // Le filtre d'une famille garde son bandeau : la famille se lit au-dessus des fiches, plus sous chaque nom.
  const weightlifting = page.getByRole("region", { name: new RegExp(`^${m.exerciseGuide.families.weightlifting}`) });
  await weightlifting.getByRole("link", { name: "Arraché", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/exercices/${snatch.id}$`));
  const sheet = page.getByRole("region", { name: m.exerciseGuide.title });
  // La version concise s'affiche ; le texte complet relu attend sous « Détail ».
  const concise = snatch.guide!.concise!;
  await expect(sheet.getByText(concise.objective, { exact: true }).first()).toBeVisible();
  await expect(sheet.getByText(concise.steps[0]!, { exact: true }).first()).toBeVisible();
  await expect(sheet.getByText(snatch.guide!.loadExplanation)).toBeHidden();
  await sheet.getByText(g.detail, { exact: true }).click();
  await expect(sheet.getByText(snatch.guide!.loadExplanation)).toBeVisible();
  await expect(sheet.getByText(snatch.guide!.steps[0]!, { exact: true }).last()).toBeVisible();
  await expect(sheet.getByText(m.exerciseGuide.approved)).toBeVisible();
  // Le geste animé tourne ; une pastille l'arrête sur la ligne choisie du guide, affichée sous l'image.
  await expect(sheet.getByRole("button", { name: motion.pause })).toBeVisible();
  // L'arraché est écrit pour le nouveau moteur : la scène est vue de profil, et se redessine sans rendu de page.
  const scene = sheet.locator("svg[data-view]");
  await expect(scene).toHaveAttribute("data-view", "side");
  // Toute la scène : une pièce immobile (un disque posé) ne dirait pas si le geste avance.
  const drawn = () => scene.innerHTML();
  // Le geste ne joue que sous les yeux : on le fait venir à l'écran.
  await scene.scrollIntoViewIfNeeded();
  const before = await drawn();
  await expect.poll(drawn).not.toBe(before);
  // Le sélecteur de vue se manie au clavier : Face, puis retour au profil.
  const views = sheet.getByRole("group", { name: motion.view });
  await expect(views.getByRole("button", { name: motion.views.side, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await views.getByRole("button", { name: motion.views.front, exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(scene).toHaveAttribute("data-view", "front");
  await expect(views.getByRole("button", { name: motion.views.front, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(sheet.getByRole("button", { name: motion.pause })).toBeVisible();
  await expect(scene.locator("path")).not.toHaveCount(0);
  // La pastille « 2 » montre l'étape 2, celle que la fiche numérote 2. Avant, la troisième pastille portait « 3 »
  // et la ligne dessous disait « Étape 2 », parce que la première position s'appelle « Mise en place ».
  const pastilles = sheet.getByRole("group", { name: motion.positions });
  const second = pastilles.getByRole("button", { name: g.position(2), exact: true });
  await expect(second).toHaveText("2");
  await second.click();
  await expect(sheet.getByRole("button", { name: motion.play })).toBeVisible();
  await expect(sheet.getByText(`${g.position(2)} :`)).toBeVisible();
  await expect(pastilles.getByRole("button", { name: g.position(0), exact: true })).toHaveText(g.position(0));
  // Arrêté sur une position, le geste ne bouge plus.
  const held = await drawn();
  await page.waitForTimeout(300);
  expect(await drawn()).toBe(held);
  await inspect(page, "library");
  // En mouvement réduit, la frise des quatre positions remplace la lecture, dans la vue choisie.
  const frieze = sheet.getByRole("list", { name: motion.positions });
  await expect(frieze.getByRole("img")).toHaveCount(4);
  await expect(frieze.locator("svg[data-view='front']")).toHaveCount(4);
  await views.getByRole("button", { name: motion.views.side, exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(frieze.locator("svg[data-view='side']")).toHaveCount(4);
  await page.screenshot({ path: `/tmp/tartan-guide-library-frise-profil.png`, fullPage: true });
  // Le good morning, longtemps à reprendre, est réécrit sur le nouveau moteur : il a lui aussi ses deux vues.
  await page.goto("/exercices", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: m.exerciseGuide.families.strength, exact: true }).click();
  await page.getByLabel(m.exercises.search, { exact: true }).fill("Good morning");
  await page
    .getByRole("region", { name: new RegExp(`^${m.exerciseGuide.families.strength}`) })
    .getByRole("link", { name: "Good morning", exact: true })
    .click();
  await expect(sheet.getByRole("list", { name: motion.positions }).getByRole("img")).toHaveCount(4);
  await expect(sheet.getByRole("group", { name: motion.view })).toBeVisible();
  const link = await groupLink(page);
  const athlete = await joinAsAthlete(browser, link, "GuideAthlete");
  try {
    const groups = await (await page.request.get(`${root}/groups`)).json();
    const response = await page.request.post(`${root}/sessions`, {
      data: {
        date: today(),
        startTime: null,
        location: null,
        publishAt: null,
        assignments: [{ targetType: "group", targetId: groups[0].id }],
        overrides: [],
        draft: {
          title: "Apprendre l'arraché",
          type: "strength",
          durationMin: 30,
          coachNote: null,
          blocks: [
            {
              name: "Technique",
              variant: "club",
              items: [{ exerciseId: snatch.id, prescription: { sets: 2, reps: 3 } }],
            },
          ],
        },
      },
    });
    expect(response.ok()).toBe(true);
    const session = await response.json();
    expect(
      (
        await page.request.post(`${root}/sessions/${session.id}/publish`, {
          data: { expectedVersion: session.version },
        })
      ).ok(),
    ).toBe(true);
    await athlete.page.goto(`/seance/${session.id}`, { waitUntil: "networkidle" });
    await athlete.page.getByText(m.exerciseGuide.open, { exact: true }).click();
    // L'athlète lit aussi la version concise, et le détail sur demande.
    await expect(athlete.page.getByText(snatch.guide!.concise!.objective, { exact: true }).first()).toBeVisible();
    await athlete.page.getByText(w.exercises.guide.detail, { exact: true }).first().click();
    await expect(athlete.page.getByText(snatch.guide!.loadExplanation).first()).toBeVisible();
    await expect(athlete.page.getByText(m.exerciseGuide.approved)).toBeVisible();
    await inspect(athlete.page, "session");
    // Le guide figé dans la séance reçoit le geste, lu d'après la fiche commune.
    await expect(
      athlete.page.getByRole("list", { name: m.exerciseGuide.motion.positions }).first().getByRole("img"),
    ).toHaveCount(4);
    await athlete.page.goto(`/seance/${session.id}/mode`, { waitUntil: "networkidle" });
    await athlete.page.getByText(m.exerciseGuide.open, { exact: true }).click();
    await expect(
      athlete.page
        .getByRole("region", { name: m.exerciseGuide.title })
        .getByText(snatch.guide!.concise!.steps[0]!, { exact: true }),
    ).toBeVisible();
    await inspect(athlete.page, "mode");
    const catalogue = await athlete.page.request.get(`${root}/exercises`);
    expect(catalogue.ok()).toBe(true);
    expect(await catalogue.json()).toContainEqual(expect.objectContaining({ id: snatch.id }));
    const create = await athlete.page.request.post(`${root}/exercises`, {
      data: { name: "Exercice ajouté par l’athlète", category: "strength" },
    });
    expect(create.status()).toBe(403);
  } finally {
    await athlete.context.close();
  }
});
