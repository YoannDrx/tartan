import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { Client } from "pg";
import { expectAccessible, expectNoHorizontalScroll } from "./helpers";

const DB = process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e";
const setLeaderboard = async (open: boolean) => {
  const sql = new Client({ connectionString: DB });
  await sql.connect();
  await sql.query(
    `insert into platform_settings (key, value, updated_at) values ('gameLeaderboardEnabled', $1, now())
     on conflict (key) do update set value = $1, updated_at = now()`,
    [JSON.stringify(open)],
  );
  await sql.end();
};

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

test("le disque : tenir pour tourner, puis une marque, un mordu ou une sortie du cercle", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/jeu", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: m.game.events.discus.play, exact: true }).click();
  await expect(page.getByRole("img", { name: m.game.events.discus.canvas })).toBeVisible();
  await page.getByRole("button", { name: m.game.start, exact: true }).click();
  await page.keyboard.down(" ");
  await page.waitForTimeout(1_400);
  await page.keyboard.up(" ");
  const outcome = page.getByRole("status").filter({ hasText: /Lancer mesuré à|mordu|Sorti du cercle/ });
  await expect(outcome).toBeVisible({ timeout: 30_000 });
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test("le combiné : une épreuve, ses points, puis l'épreuve suivante", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.goto("/jeu", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: m.game.combined.play, exact: true }).click();
  await expect(page.getByText(m.game.combined.step(1, 6, m.game.events.hurdles.title))).toBeVisible();
  await page.getByRole("button", { name: m.game.start, exact: true }).click();
  // Sans appui, la course va à son terme, haies percutées : une marque, des points.
  const next = page.getByRole("button", { name: m.game.combined.next(m.game.events.longJump.title), exact: true });
  await expect(next).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Total provisoire : \d+ points\./)).toBeVisible();
  await page.screenshot({ path: info.outputPath("combine.png"), fullPage: true });
  await next.click();
  await expect(page.getByText(m.game.combined.step(2, 6, m.game.events.longJump.title))).toBeVisible();
  await expect(page.getByRole("img", { name: m.game.events.longJump.canvas })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test("classement ouvert : la course jouée est rejouée par le serveur, puis classée sous un pseudo", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Un seul passage : le classement est commun aux deux projets.");
  test.setTimeout(150_000);
  await setLeaderboard(true);
  try {
    // Les réglages sont gardés 30 s en mémoire par le serveur : on attend qu'il voie le classement ouvert.
    await expect
      .poll(async () => (await (await page.request.get("/api/v1/game/leaderboard?event=hurdles")).json()).enabled, {
        timeout: 45_000,
        intervals: [2_000],
      })
      .toBe(true);
    await page.goto("/jeu", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: m.game.events.hurdles.play, exact: true }).click();
    await expect(page.getByRole("heading", { name: m.game.leaderboard.title })).toBeVisible();
    await page.getByRole("button", { name: m.game.start, exact: true }).click();
    // Sans appui, la course va au bout en temps réel : le serveur vérifie qu'elle n'a pas été plus vite.
    const pseudo = page.getByLabel(m.game.leaderboard.pseudo);
    await expect(pseudo).toBeVisible({ timeout: 60_000 });
    await pseudo.fill("Coureur E2E");
    await page.getByRole("button", { name: m.game.leaderboard.submit, exact: true }).click();
    await expect(page.getByText(m.game.leaderboard.saved)).toBeVisible();
    await expect(page.getByRole("region", { name: m.game.leaderboard.title }).getByText("Coureur E2E")).toBeVisible();
    await expectAccessible(page);
    // L'effacement, sans compte.
    await page.getByRole("button", { name: m.game.leaderboard.erase, exact: true }).click();
    await expect(page.getByRole("region", { name: m.game.leaderboard.title }).getByText("Coureur E2E")).toHaveCount(0);
  } finally {
    await setLeaderboard(false);
  }
});

test("la page du jeu est au plan du site et ouverte aux robots", async ({ request }) => {
  expect(await (await request.get("/sitemap.xml")).text()).toContain("https://tartan.coach/jeu");
  expect(await (await request.get("/robots.txt")).text()).toContain("Allow: /jeu");
});
