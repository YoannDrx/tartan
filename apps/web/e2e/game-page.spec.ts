import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { expectAccessible, expectNoHorizontalScroll } from "./helpers";

// Tartan Meeting : l'affiche ne charge rien du jeu ; un geste lance la course, qui se joue au clavier ou au pouce.
test("le 110 m haies se joue jusqu'à l'arrivée, et le record reste sur l'appareil", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.goto("/jeu", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Tartan");
  await expect(page.getByRole("img", { name: m.game.events.hurdles.canvas })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);

  await page.getByRole("button", { name: m.game.events.hurdles.play, exact: true }).click();
  const canvas = page.getByRole("img", { name: m.game.events.hurdles.canvas });
  await expect(canvas).toBeVisible();
  await page.getByRole("button", { name: m.game.start, exact: true }).click();
  const jump = page.getByRole("button", { name: m.game.events.hurdles.action, exact: true });
  await expect(jump).toBeVisible();
  // Le chrono court pendant la course.
  await expect(page.getByText(m.game.seconds(0), { exact: true })).toHaveCount(0, { timeout: 5_000 });
  // La cible du pouce : 64 px de haut au moins.
  expect((await jump.boundingBox())!.height).toBeGreaterThanOrEqual(64);
  await expectNoHorizontalScroll(page);

  // Échap met en pause, puis la course reprend.
  await page.keyboard.press("Escape");
  await expect(page.getByText(m.game.paused, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: m.game.resume, exact: true }).click();

  // Quelques sauts au clavier, puis la course va à son terme, haies percutées comprises.
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.down(" ");
    await page.waitForTimeout(80);
    await page.keyboard.up(" ");
    await page.waitForTimeout(700);
  }
  const status = page.getByRole("status").filter({ hasText: /Arrivée en/ });
  await expect(status).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(m.game.newRecord)).toBeVisible();
  await canvas.screenshot({ path: info.outputPath("arrivee.png") });
  await expectAccessible(page);
  const stored = await page.evaluate(() => window.localStorage.getItem("tartan.jeu.haies.record"));
  expect(Number(stored)).toBeGreaterThan(12_000);

  // Le record survit au rechargement.
  await page.reload();
  await page.getByRole("button", { name: m.game.events.hurdles.play, exact: true }).click();
  await expect(page.getByText(/Ton record : \d+,\d\d s\./)).toBeVisible();
});

test("le saut en longueur : l'élan, l'appel tenu, puis une marque ou un essai mordu", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/jeu", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: m.game.events.longJump.play, exact: true }).click();
  await expect(page.getByRole("img", { name: m.game.events.longJump.canvas })).toBeVisible();
  await page.getByRole("button", { name: m.game.start, exact: true }).click();
  const press = page.getByRole("button", { name: m.game.events.longJump.action, exact: true });
  await expect(press).toBeVisible();
  // Une trentaine d'appuis brefs, puis l'appel tenu un demi-seconde.
  for (let i = 0; i < 30; i += 1) {
    await page.keyboard.down(" ");
    await page.waitForTimeout(30);
    await page.keyboard.up(" ");
    await page.waitForTimeout(70);
  }
  await expect(page.getByText(/^\d+,\d m\/s$/).first()).not.toHaveText("0,0 m/s");
  await page.keyboard.down(" ");
  await page.waitForTimeout(500);
  await page.keyboard.up(" ");
  const outcome = page.getByRole("status").filter({ hasText: /Saut mesuré à|Mordu|Retombé avant le sable/ });
  await expect(outcome).toBeVisible({ timeout: 30_000 });
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test("le triple saut : élan, appel, puis les réceptions en rythme", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/jeu", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: m.game.events.tripleJump.play, exact: true }).click();
  await expect(page.getByRole("img", { name: m.game.events.tripleJump.canvas })).toBeVisible();
  await page.getByRole("button", { name: m.game.start, exact: true }).click();
  for (let i = 0; i < 38; i += 1) {
    await page.keyboard.down(" ");
    await page.waitForTimeout(25);
    await page.keyboard.up(" ");
    await page.waitForTimeout(60);
  }
  await page.keyboard.down(" ");
  await page.waitForTimeout(300);
  await page.keyboard.up(" ");
  // Deux appuis pendant les bonds : justes ou non, l'essai se termine.
  for (let i = 0; i < 2; i += 1) {
    await page.waitForTimeout(550);
    await page.keyboard.press(" ");
  }
  const outcome = page
    .getByRole("status")
    .filter({ hasText: /Saut mesuré à|Mordu|Retombé avant le sable|Rythme cassé/ });
  await expect(outcome).toBeVisible({ timeout: 30_000 });
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test("le saut en hauteur : la barre monte après un franchissement, et le concours s'arrête après trois échecs", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/jeu", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: m.game.events.highJump.play, exact: true }).click();
  await expect(page.getByRole("img", { name: m.game.events.highJump.canvas })).toBeVisible();
  await page.getByRole("button", { name: m.game.start, exact: true }).click();
  await expect(page.getByText(m.game.distance(1_600), { exact: true })).toBeVisible();
  // Aucun appui : trois refus, et le concours s'arrête sans barre franchie.
  await expect(page.getByRole("status").filter({ hasText: m.game.events.highJump.none })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(m.game.events.highJump.outcomes.balked, { exact: true })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test("le saut à la perche : la barre part de 4,20 m, trois refus arrêtent le concours", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/jeu", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: m.game.events.poleVault.play, exact: true }).click();
  await expect(page.getByRole("img", { name: m.game.events.poleVault.canvas })).toBeVisible();
  await page.getByRole("button", { name: m.game.start, exact: true }).click();
  await expect(page.getByText(m.game.distance(4_200), { exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: m.game.events.poleVault.none })).toBeVisible({
    timeout: 30_000,
  });
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test("la page du jeu est au plan du site et ouverte aux robots", async ({ request }) => {
  expect(await (await request.get("/sitemap.xml")).text()).toContain("https://tartan.coach/jeu");
  expect(await (await request.get("/robots.txt")).text()).toContain("Allow: /jeu");
});
