import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { expectAccessible, expectNoHorizontalScroll } from "./helpers";

// Tartan Meeting : l'affiche ne charge rien du jeu ; un geste lance la course, qui se joue au clavier ou au pouce.
test("le 110 m haies se joue jusqu'à l'arrivée, et le record reste sur l'appareil", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.goto("/jeu", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Tartan");
  await expect(page.getByRole("img", { name: m.game.canvas })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);

  await page.getByRole("button", { name: m.game.play, exact: true }).click();
  const canvas = page.getByRole("img", { name: m.game.canvas });
  await expect(canvas).toBeVisible();
  await page.getByRole("button", { name: m.game.start, exact: true }).click();
  const jump = page.getByRole("button", { name: m.game.jump, exact: true });
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
  await page.getByRole("button", { name: m.game.play, exact: true }).click();
  await expect(page.getByText(/Ton record : \d+,\d\d s\./)).toBeVisible();
});

test("la page du jeu est au plan du site et ouverte aux robots", async ({ request }) => {
  expect(await (await request.get("/sitemap.xml")).text()).toContain("https://tartan.coach/jeu");
  expect(await (await request.get("/robots.txt")).text()).toContain("Allow: /jeu");
});
