import { expect, test } from "@playwright/test";
import { motion } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

const milliseconds = (value: string) => Math.round(parseFloat(value) * (value.endsWith("ms") ? 1 : 1000));

test("l'ossature tient sur téléphone : en-tête allégé, barre basse lisible, cibles assez grandes", async ({
  page,
}, info) => {
  const name = `Ossature${info.project.name === "desktop" ? "Bureau" : "Mobile"}`;
  await createCoachSpace(page, name);
  await page.goto("/suivi", { waitUntil: "networkidle" });
  const phone = page.viewportSize()!.width < 768;
  const header = page.locator("header.app-header");

  // Un seul espace : son nom tronqué n'encombre plus l'en-tête du téléphone. Il se lit dans le menu.
  const space = header.getByText(`Coaching ${name}`, { exact: true });
  if (phone) await expect(space).toBeHidden();
  else await expect(space).toBeVisible();
  await page.getByRole("button", { name: m.nav.reglages, exact: true }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByText(`Coaching ${name}`, { exact: true })).toBeVisible();
  // Le menu descend à sa place, vite.
  const entering = await menu.evaluate((node) => {
    const style = getComputedStyle(node);
    return { name: style.animationName, duration: style.animationDuration };
  });
  expect(entering.name).toBe("drop-in");
  expect(milliseconds(entering.duration)).toBe(motion.duration.quick);

  // L'aide de l'écran s'ouvre en feuille : elle monte à sa place, dans le plafond des écrans de travail.
  await menu.getByRole("menuitem", { name: m.help.screen.open, exact: true }).click();
  const sheet = page.getByRole("dialog", { name: m.help.screen.title });
  await expect(sheet).toBeVisible();
  const rising = await sheet.evaluate((node) => {
    const style = getComputedStyle(node);
    return { name: style.animationName, duration: style.animationDuration };
  });
  expect(rising.name).toBe("rise-in");
  expect(milliseconds(rising.duration)).toBe(motion.duration.enter);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // Chaque cible de l'en-tête et de la barre basse fait au moins 44 px ; aucun libellé sous 12 px.
  const targets = await page
    .locator("header.app-header a:visible, header.app-header button:visible, nav[aria-label] a:visible")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { label: node.textContent || node.getAttribute("aria-label"), width: box.width, height: box.height };
      }),
    );
  expect(targets.length).toBeGreaterThan(4);
  for (const target of targets) {
    expect(Math.min(target.width, target.height), String(target.label)).toBeGreaterThanOrEqual(44);
  }
  const small = await page.locator("header.app-header, nav[aria-label]").evaluateAll((roots) =>
    roots.flatMap((root) =>
      [...root.querySelectorAll("*")]
        .filter((node) => [...node.childNodes].some((child) => child.nodeType === 3 && child.textContent!.trim()))
        .filter((node) => (node as HTMLElement).offsetParent !== null)
        .map((node) => ({ text: node.textContent!.trim(), size: parseFloat(getComputedStyle(node).fontSize) }))
        .filter((item) => item.size < 12),
    ),
  );
  expect(small).toEqual([]);

  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test("un état vide porte l'athlète de sa rubrique, sur son bout de piste", async ({ page }, info) => {
  await createCoachSpace(page, `Vide${info.project.name === "desktop" ? "Bureau" : "Mobile"}`);
  for (const [path, athlete] of [
    ["/videos", "highJump"],
    ["/athletes", "longJump"],
    ["/annonces", "hurdles"],
  ] as const) {
    await page.goto(path, { waitUntil: "networkidle" });
    const tile = page.locator(`[data-athlete="${athlete}"]`);
    await expect(tile).toBeVisible();
    await expect(tile.locator("svg.athlete")).toHaveCount(1);
    // La tuile ne recouvre pas le texte de l'état vide.
    const [tileBox, textBox] = await Promise.all([
      tile.boundingBox(),
      tile.locator("xpath=..").locator("p").first().boundingBox(),
    ]);
    expect(textBox!.x + textBox!.width).toBeLessThanOrEqual(tileBox!.x);
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  }
});
