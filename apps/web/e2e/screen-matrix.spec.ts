import { expect, test, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { groupLink, joinAsAthlete } from "./journeys";
import { sweptScreens } from "./screens";

// Le balayage de la matrice : chaque écran, pour chaque rôle qui l'ouvre, à 390, 768 et 1440 px, en mouvement réduit.
// Un écran qui plante, déborde ou échoue à axe arrête la recette. Le contenu de chaque écran reste prouvé par ses
// parcours (`screens.ts`).
const WIDTHS = [390, 768, 1440];

const sweep = async (page: Page, paths: string[]) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of paths) {
    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response?.status() ?? 200, path).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: m.common.genericError }), path).toHaveCount(0);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(page);
      await expectAccessible(page);
    }
  }
};

test("matrice des écrans : public, coach et athlète, à trois largeurs", async ({ page, browser }, info) => {
  // Les largeurs sont posées à la main : un seul projet suffit.
  test.skip(info.project.name !== "desktop", "balayage unique, largeurs explicites");
  test.setTimeout(900_000);

  await sweep(page, sweptScreens("public").map((screen) => screen.path));

  await createCoachSpace(page, "Matrice");
  const me = await (await page.request.get("/api/v1/me")).json();
  const root = `/api/v1/orgs/${me.spaces[0].organizationId}`;
  const athlete = await joinAsAthlete(browser, await groupLink(page), "Balayage");
  try {
    const [exercises, athletes] = await Promise.all([
      (await page.request.get(`${root}/exercises`)).json(),
      (await page.request.get(`${root}/athletes`)).json(),
    ]);
    const exercise = exercises.find((e: { shared: boolean }) => !e.shared) ?? exercises[0];
    const athleteId = athletes[0].id as string;
    await sweep(page, [
      ...sweptScreens("coach").map((screen) => screen.path),
      `/exercices/${exercise.id}`,
      `/historique/${athleteId}`,
    ]);
    await sweep(athlete.page, sweptScreens("athlete").map((screen) => screen.path));
  } finally {
    await athlete.context.close();
  }
});
