import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll, expectNoMotion } from "./helpers";

const t = m.help;

test("le centre d'aide se lit par thème, à toutes les largeurs", async ({ page }, info) => {
  await page.goto("/aide");
  await expect(page.getByRole("heading", { level: 1, name: t.title })).toBeVisible();
  const themes = page.getByRole("navigation", { name: t.themesLabel });
  await expect(themes.getByRole("link")).toHaveCount(Object.keys(t.themes).length);

  // Une réponse reste fermée tant qu'on ne la demande pas.
  const question = t.themes.compte.questions.emailConnexion;
  await expect(page.getByText(question.a)).toBeHidden();
  await themes.getByRole("link", { name: t.themes.compte.title }).click();
  await expect(page).toHaveURL(/#compte$/);
  await page.getByText(question.q, { exact: true }).click();
  await expect(page.getByText(question.a)).toBeVisible();

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    await page.screenshot({ path: info.outputPath(`aide-${width}.png`), fullPage: true });
  }

  await page.getByRole("link", { name: t.write }).click();
  await expect(page.getByRole("heading", { level: 1, name: m.contact.title })).toBeVisible();
});

test("le centre d'aide s'ouvre au clavier et sans mouvement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/aide#groupe");
  const question = t.themes.groupe.questions.inviter;
  await page.getByText(question.q, { exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(question.a)).toBeVisible();
  await expectNoMotion(page);
});

test("l'aide de l'écran est à la même place partout, sans quitter l'écran", async ({ page }, info) => {
  await createCoachSpace(page, `Aide${info.project.name === "desktop" ? "Bureau" : "Mobile"}`);
  const open = async () => {
    await page.getByRole("button", { name: m.nav.reglages, exact: true }).click();
    await page.getByRole("menuitem", { name: t.screen.open, exact: true }).click();
    return page.getByRole("dialog", { name: t.screen.title });
  };

  let dialog = await open();
  await expect(dialog).toContainText(t.screens.suivi[0]);
  const all = dialog.getByRole("link", { name: t.screen.all });
  await expect(all).toHaveAttribute("href", "/aide#seances");
  await expect(all).toHaveAttribute("target", "_blank");
  await expect(dialog.getByRole("link", { name: t.write })).toHaveAttribute("href", "/contact");
  await expectAccessible(page);
  await page.screenshot({ path: info.outputPath("aide-ecran.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/suivi$/);

  await page.goto("/exercices");
  dialog = await open();
  await expect(dialog).toContainText(t.screens.exercices[0]);
  await page.keyboard.press("Escape");

  // Un écran sans repère propre renvoie au centre d'aide.
  await page.goto("/reglages");
  await expect(page.getByRole("link", { name: t.center, exact: true })).toHaveAttribute("href", "/aide");
});
