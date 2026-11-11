import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { groupLink, joinAsAthlete } from "./journeys";

// L'arrivée d'un athlète : il sait dans quel groupe il est et qui le suit, puis referme l'accueil.
test("un athlète qui arrive est accueilli par son groupe, puis referme l'accueil", async ({ page, browser }, info) => {
  const coach = `Accueil${info.project.name === "desktop" ? "Bureau" : "Mobile"}`;
  await createCoachSpace(page, coach);
  const link = await groupLink(page);
  const athlete = await joinAsAthlete(browser, link, "Lina");
  try {
    const welcome = athlete.page.getByRole("region", { name: m.athleteWelcome.title("Hauteur Élite") });
    await expect(welcome).toBeVisible();
    await expect(welcome).toContainText(m.athleteWelcome.body(coach));
    await expectNoHorizontalScroll(athlete.page);
    await expectAccessible(athlete.page);
    await athlete.page.screenshot({ path: info.outputPath("accueil-390.png"), fullPage: true });

    for (const width of [768, 1440]) {
      await athlete.page.setViewportSize({ width, height: 900 });
      await expect(welcome).toBeVisible();
      await expectNoHorizontalScroll(athlete.page);
      await athlete.page.screenshot({ path: info.outputPath(`accueil-${width}.png`), fullPage: true });
    }
    await athlete.page.setViewportSize({ width: 390, height: 844 });

    await welcome.getByRole("button", { name: m.athleteWelcome.dismiss, exact: true }).click();
    await expect(welcome).toHaveCount(0);
    // Refermé une fois, il ne revient pas à la visite suivante.
    await athlete.page.reload();
    await expect(athlete.page.getByRole("heading", { name: "Salut Lina" })).toBeVisible();
    await expect(welcome).toHaveCount(0);
  } finally {
    await athlete.context.close();
  }
});
