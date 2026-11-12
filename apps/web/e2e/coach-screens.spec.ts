import { expect, test, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { createExercise, publishSession } from "./journeys";

// Le bouton est à l'écran, et rien ne le recouvre : c'est lui que touche un doigt posé en son centre.
const reachable = (page: Page) =>
  page.getByRole("button", { name: m.builder.publish, exact: true }).evaluate((button) => {
    const box = button.getBoundingClientRect();
    const inside = box.top >= 0 && box.bottom <= window.innerHeight;
    const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return inside && (top === button || button.contains(top));
  });

test("dans le constructeur, « Publier » reste à portée de pouce d'un bout à l'autre du formulaire", async ({
  page,
}, info) => {
  await createCoachSpace(page, `Pouce${info.project.name === "desktop" ? "Bureau" : "Mobile"}`);
  await createExercise(page, "Bonds horizontaux");
  await page.goto("/seances/nouvelle", { waitUntil: "networkidle" });
  // Le formulaire dépasse largement l'écran : sans barre collante, le bouton serait tout en bas.
  const pages = await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);
  expect(pages).toBeGreaterThan(1.5);
  for (const share of [0, 0.5, 1]) {
    await page.evaluate((part) => {
      const travel = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: travel * part, behavior: "instant" });
    }, share);
    await expect.poll(() => reachable(page), { message: `à ${share * 100} % du formulaire` }).toBe(true);
  }
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
  // Et il publie : la séance part depuis le haut du formulaire, sans aller chercher le bouton.
  await publishSession(page, "Vitesse et bonds", "Bonds horizontaux");
});
