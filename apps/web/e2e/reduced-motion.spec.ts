import { expect, test } from "@playwright/test";
import { motion } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectNoMotion, motionOn } from "./helpers";

test("les jetons de mouvement sont ceux que le navigateur applique", async ({ page }) => {
  await page.goto("/aide");
  const applied = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const read = (name: string) => root.getPropertyValue(name).trim();
    return {
      durations: Object.fromEntries(
        ["instant", "quick", "base", "enter", "trace", "expressive", "celebration", "ambient"].map((name) => [
          name,
          read(`--duration-${name}`),
        ]),
      ),
      easings: Object.fromEntries(["elan", "impulsion", "reception"].map((name) => [name, read(`--ease-${name}`)])),
      stagger: read("--stagger-step"),
    };
  });
  // Le navigateur réécrit « 200ms » en « .2s » : on compare des millisecondes.
  const milliseconds = (value: string) => Math.round(parseFloat(value) * (value.endsWith("ms") ? 1 : 1000));
  expect(
    Object.fromEntries(Object.entries(applied.durations).map(([name, value]) => [name, milliseconds(value)])),
  ).toEqual(motion.duration);
  const compact = (curve: string) => curve.replace(/\s+/g, "").replace(/(?<![\d.])0\./g, ".");
  expect(Object.fromEntries(Object.entries(applied.easings).map(([name, value]) => [name, compact(value)]))).toEqual(
    Object.fromEntries(Object.entries(motion.easing).map(([name, value]) => [name, compact(value)])),
  );
  expect(milliseconds(applied.stagger)).toBe(motion.stagger.step);

  // Une transition sans durée précisée prend le changement d'état et l'amorti.
  const chevron = page.getByText(m.help.themes.groupe.questions.inviter.q, { exact: true }).locator("svg");
  const transition = await chevron.evaluate((icon) => {
    const style = getComputedStyle(icon);
    return { duration: style.transitionDuration, curve: style.transitionTimingFunction };
  });
  expect(milliseconds(transition.duration)).toBe(motion.duration.quick);
  expect(compact(transition.curve)).toBe(compact(motion.easing.reception));
});

test("le contrôle du mouvement voit ce qui bouge, puis plus rien en mouvement réduit", async ({ page }) => {
  await page.goto("/aide");
  // Témoin : sans réglage, la page a des transitions. Sans lui, le contrôle ne prouverait rien.
  expect((await motionOn(page)).length).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expectNoMotion(page);
});

test("en mouvement réduit, rien ne bouge sur le site", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/", "/tarifs", "/aide", "/contact", "/connexion", "/hors-ligne"]) {
    await page.goto(path);
    await expectNoMotion(page);
  }
  // Le film et la piste de la page d'accueil, une fois parcourus jusqu'en bas.
  await page.goto("/");
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expectNoMotion(page);
});

test("en mouvement réduit, rien ne bouge dans l'application, menus et dialogues compris", async ({ page }, info) => {
  await createCoachSpace(page, `Calme${info.project.name === "desktop" ? "Bureau" : "Mobile"}`);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/suivi", "/calendrier", "/exercices", "/athletes", "/reglages"]) {
    await page.goto(path);
    await expectNoMotion(page);
  }
  await page.goto("/suivi");
  await page.getByRole("button", { name: m.nav.reglages, exact: true }).click();
  await expectNoMotion(page);
  await page.getByRole("menuitem", { name: m.help.screen.open, exact: true }).click();
  await expect(page.getByRole("dialog", { name: m.help.screen.title })).toBeVisible();
  await expectNoMotion(page);
});
