import { expect, test, type Page } from "@playwright/test";
import { motion } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectNoMotion } from "./helpers";

type Played = { pseudo: string; name: string; duration: number };
type Recorded = { animations?: Played[]; finished?: boolean };
type Probed = Window & { __transitions: Recorded[] };

// Note chaque transition de vue que la page démarre, et ce que le navigateur anime une fois qu'elle est prête.
const record = (page: Page) =>
  page.evaluate(() => {
    const log: Recorded[] = [];
    (window as unknown as Probed).__transitions = log;
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((update: never) => {
      const transition = start(update);
      const entry: Recorded = {};
      log.push(entry);
      void transition.ready.then(() => {
        entry.animations = document
          .getAnimations()
          .map((animation) => {
            const effect = animation.effect as KeyframeEffect;
            return {
              pseudo: effect.pseudoElement ?? "",
              name: (animation as CSSAnimation).animationName ?? "",
              duration: Number(effect.getComputedTiming().duration),
            };
          })
          .filter((item) => item.pseudo.startsWith("::view-transition"));
      });
      void transition.finished.then(() => (entry.finished = true));
      return transition;
    }) as typeof document.startViewTransition;
  });
const recorded = (page: Page) => page.evaluate(() => (window as unknown as Probed).__transitions);
// La première transition, une fois terminée : celle du changement de page.
const firstTransition = async (page: Page) => {
  await expect.poll(async () => (await recorded(page))[0]?.finished).toBe(true);
  return (await recorded(page))[0]!.animations!;
};
const durationOf = (played: Played[], pseudo: string) => played.find((item) => item.pseudo === pseudo)?.duration;

const nav = (page: Page) => page.getByRole("navigation", { name: "Navigation principale" }).locator("visible=true");

test("d'une rubrique à l'autre, le contenu se fond, le bandeau reste et l'onglet actif glisse", async ({
  page,
}, info) => {
  await createCoachSpace(page, `Fondu ${info.project.name}`);
  await page.goto("/suivi", { waitUntil: "networkidle" });
  // Un seul onglet actif visible : deux éléments du même nom feraient avorter la transition.
  await expect(page.locator(".vt-active-tab:visible")).toHaveCount(1);
  await record(page);

  await nav(page).getByRole("link", { name: m.nav.calendrier, exact: true }).click();
  await expect(page.getByRole("heading", { name: m.nav.calendrier, exact: true, level: 1 })).toBeVisible();
  const played = await firstTransition(page);

  // Le contenu : l'ancienne page s'efface pendant que la suivante apparaît.
  expect(played.find((item) => item.name === "vt-out")).toMatchObject({ duration: motion.duration.quick });
  expect(played.find((item) => item.name === "vt-in")).toMatchObject({ duration: motion.duration.quick });
  // Le bandeau piste garde sa place, l'onglet actif glisse jusqu'à la nouvelle rubrique.
  expect(durationOf(played, "::view-transition-group(page-band)")).toBe(motion.duration.base);
  expect(durationOf(played, "::view-transition-group(active-tab)")).toBe(motion.duration.base);
  // Rien ne dépasse le plafond des écrans de travail, ni ne garde la durée par défaut du navigateur.
  for (const item of played) expect(item.duration, item.pseudo).toBeLessThanOrEqual(motion.duration.enter);
  expect(played.map((item) => item.duration)).not.toContain(250);

  await expect(nav(page).getByRole("link", { name: m.nav.calendrier, exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // Le titre de l'onglet suit, au plus tard à la fin de la transition.
  await expect(page).toHaveTitle(new RegExp(m.nav.calendrier));
  await expect(page.locator(".vt-active-tab:visible")).toHaveCount(1);

  // Changer de semaine n'est pas changer de page : la même adresse, aucun fondu de page.
  const before = (await recorded(page)).length;
  await page.getByRole("link", { name: "Période suivante", exact: true }).click();
  await expect(page).toHaveURL(/semaine=/);
  await page.waitForLoadState("networkidle");
  const later = (await recorded(page)).slice(before).flatMap((entry) => entry.animations ?? []);
  expect(later.filter((item) => item.name === "vt-in" || item.name === "vt-out")).toEqual([]);
});

test("en mouvement réduit, la page change d'un coup", async ({ page }, info) => {
  await createCoachSpace(page, `Net ${info.project.name}`);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/suivi", { waitUntil: "networkidle" });
  await record(page);
  await nav(page).getByRole("link", { name: m.nav.calendrier, exact: true }).click();
  await expect(page.getByRole("heading", { name: m.nav.calendrier, exact: true, level: 1 })).toBeVisible();
  // La transition a bien lieu, mais rien ne dure : ni fondu, ni glissement.
  expect((await firstTransition(page)).filter((item) => item.duration > 0 || item.name !== "")).toEqual([]);
  await expectNoMotion(page);
});

test("d'une page du site à l'autre, le contenu se fond et l'en-tête reste", async ({ page }) => {
  // React n'anime que ce qui est à l'écran : la page entière y tient, de l'en-tête au pied de page.
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 6000 });
  await page.goto("/tarifs", { waitUntil: "networkidle" });
  await record(page);
  await page.locator("footer").getByRole("link", { name: m.help.title, exact: true }).click();
  await expect(page.getByRole("heading", { name: m.help.title, exact: true, level: 1 })).toBeVisible();
  const played = await firstTransition(page);
  expect(played.find((item) => item.name === "vt-in")).toMatchObject({ duration: motion.duration.quick });
  expect(played.find((item) => item.name === "vt-out")).toMatchObject({ duration: motion.duration.quick });
  expect(durationOf(played, "::view-transition-group(site-header)")).toBe(motion.duration.base);
  for (const item of played) expect(item.duration, item.pseudo).toBeLessThanOrEqual(motion.duration.enter);
});
