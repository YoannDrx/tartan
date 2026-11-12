import { expect, test } from "@playwright/test";
import { motion } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import {
  createCoachSpace,
  durationOf,
  expectAccessible,
  expectNoHorizontalScroll,
  firstTransition,
  recordTransitions,
} from "./helpers";
import { createExercise, groupLink, joinAsAthlete, publishSession } from "./journeys";

const TITLE = "Vitesse et bonds";

test("l'accueil de l'athlète ouvre sur le bandeau piste, et la carte du jour s'ouvre en écran de séance", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  await createCoachSpace(page, `Seance${info.project.name === "desktop" ? "Bureau" : "Mobile"}`);
  await createExercise(page, "Bonds horizontaux");
  const link = await groupLink(page);
  await publishSession(page, TITLE, "Bonds horizontaux");
  const athlete = await joinAsAthlete(browser, link, "Lina");
  const screen = athlete.page;
  try {
    // L'accueil de l'athlète est un écran comme les autres : bandeau piste, barre de navigation sur la piste.
    await screen.goto("/aujourdhui", { waitUntil: "networkidle" });
    await expect(screen.locator(".world-work")).toHaveCount(1);
    await expect(screen.locator("header.app-header.tartan-band")).toHaveCount(1);
    await expect(screen.locator("header.page-band")).toContainText(m.today.greeting("Lina"));
    await expectNoHorizontalScroll(screen);
    await expectAccessible(screen);

    // La carte du jour porte le nom de sa séance : l'ouvrir, c'est la voir devenir la feuille de l'écran.
    // Le lien de la séance elle-même, pas celui de son mode plein écran.
    const href = await screen.locator('a[href^="/seance/"]:not([href$="/mode"])').first().getAttribute("href");
    const name = `session-${href!.split("/")[2]}`;
    // En développement, l'écran de séance se compile à la première visite : on la fait avant de mesurer.
    await screen.goto(href!, { waitUntil: "networkidle" });
    await screen.goto("/aujourdhui", { waitUntil: "networkidle" });
    await recordTransitions(screen);
    await screen.locator(`a[href="${href}"]`).first().click();
    await expect(screen.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
    const played = await firstTransition(screen);
    expect(durationOf(played, `::view-transition-group(${name})`)).toBe(motion.duration.base);
    expect(durationOf(played, "::view-transition-group(page-band)")).toBe(motion.duration.base);
    for (const item of played) expect(item.duration, item.pseudo).toBeLessThanOrEqual(motion.duration.enter);

    // L'écran de séance : le bandeau, puis la feuille de la séance, avec la validation à portée de pouce.
    await expect(screen.locator("header.page-band")).toContainText(TITLE);
    const sheet = screen.getByRole("region", { name: TITLE });
    await expect(sheet.getByRole("button", { name: m.today.quickDone, exact: true })).toBeVisible();
    await expect(sheet.getByRole("link", { name: m.today.start })).toBeVisible();
    await expectNoHorizontalScroll(screen);
    await expectAccessible(screen);

    // Le retour ramène à l'accueil.
    await screen.getByRole("link", { name: m.common.back, exact: true }).click();
    await expect(screen).toHaveURL(/\/aujourdhui$/);

    // En thème clair, la carte du jour se détache du fond craie de la page.
    await athlete.context.addCookies([{ name: "tartan-theme", value: "light", url: screen.url() }]);
    await screen.reload({ waitUntil: "networkidle" });
    const colors = await screen.evaluate(() => ({
      card: getComputedStyle(document.querySelector(".on-hero")!).backgroundColor,
      page: getComputedStyle(document.documentElement).backgroundColor,
    }));
    expect(colors.card).not.toBe(colors.page);
    await expectAccessible(screen);
  } finally {
    await athlete.context.close();
  }
});
