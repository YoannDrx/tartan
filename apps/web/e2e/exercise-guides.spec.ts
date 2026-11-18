import { expect, test, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
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
  expect(library.filter((e) => e.guide)).toHaveLength(173);
  expect(library.filter((e) => e.guide?.technicalReview === "approved")).toHaveLength(150);
  const snatch = library.find((e) => e.name === "Arraché")!;
  await page.goto("/exercices", { waitUntil: "networkidle" });
  await page.getByLabel(m.exerciseGuide.family, { exact: true }).selectOption("weightlifting");
  await page.getByLabel(m.exercises.search, { exact: true }).fill("Squat snatch");
  await page.getByRole("button", { name: /^Arraché Bibliothèque/ }).click();
  await expect(page.getByRole("dialog").getByText(m.exerciseGuide.approved)).toBeVisible();
  await expect(page.getByRole("dialog").getByText(snatch.guide!.loadExplanation)).toBeVisible();
  // Le geste animé tourne ; une pastille l'arrête sur la ligne choisie du guide, affichée sous l'image.
  const motion = m.exerciseGuide.motion;
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: motion.pause })).toBeVisible();
  // L'arraché est écrit pour le nouveau moteur : la scène est vue de profil, et se redessine sans rendu de page.
  const scene = dialog.locator("svg[data-view]");
  await expect(scene).toHaveAttribute("data-view", "side");
  const drawn = () => scene.locator("path").first().getAttribute("d");
  const before = await drawn();
  await expect.poll(drawn).not.toBe(before);
  // Le sélecteur de vue se manie au clavier : Face, puis retour au profil.
  const views = dialog.getByRole("group", { name: motion.view });
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
  await expect(dialog.getByRole("button", { name: motion.pause })).toBeVisible();
  await expect(scene.locator("path")).not.toHaveCount(0);
  await dialog.getByRole("button", { name: motion.show(3, motion.position(2)) }).click();
  await expect(dialog.getByRole("button", { name: motion.play })).toBeVisible();
  await expect(dialog.getByText(`${motion.position(2)} :`)).toBeVisible();
  // Arrêté sur une position, le geste ne bouge plus.
  const held = await drawn();
  await page.waitForTimeout(300);
  expect(await drawn()).toBe(held);
  await inspect(page, "library");
  // En mouvement réduit, la frise des quatre positions remplace la lecture, dans la vue choisie.
  const frieze = dialog.getByRole("list", { name: motion.positions });
  await expect(frieze.getByRole("img")).toHaveCount(4);
  await expect(frieze.locator("svg[data-view='front']")).toHaveCount(4);
  await views.getByRole("button", { name: motion.views.side, exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(frieze.locator("svg[data-view='side']")).toHaveCount(4);
  await page.screenshot({ path: `/tmp/tartan-guide-library-frise-profil.png`, fullPage: true });
  await page.keyboard.press("Escape");
  // Un geste à reprendre garde l'ancien moteur : une seule vue, pas de sélecteur.
  await page.getByLabel(m.exerciseGuide.family, { exact: true }).selectOption("strength");
  await page.getByLabel(m.exercises.search, { exact: true }).fill("Good morning");
  await page.getByRole("button", { name: /^Good morning Bibliothèque/ }).click();
  await expect(dialog.getByRole("list", { name: motion.positions }).getByRole("img")).toHaveCount(4);
  await expect(dialog.locator("svg[data-view]")).toHaveCount(0);
  await expect(dialog.getByRole("group", { name: motion.view })).toHaveCount(0);
  await page.keyboard.press("Escape");
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
    await expect(athlete.page.getByText(snatch.guide!.loadExplanation)).toBeVisible();
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
        .getByText(snatch.guide!.steps[0]!, { exact: true }),
    ).toBeVisible();
    await inspect(athlete.page, "mode");
    expect((await athlete.page.request.get(`${root}/exercises`)).status()).toBe(403);
  } finally {
    await athlete.context.close();
  }
});
