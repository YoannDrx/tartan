import { expect, test, type Page } from "@playwright/test";
import { PLANS } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { ATHLETE_IDS } from "@tartan/mascot/athletes";
import { expectAccessible, expectNoHorizontalScroll, expectNoMotion } from "./helpers";

const t = m.landing;
const phone = (page: Page) => page.viewportSize()!.width < 768;

// Le film, en hauteurs d'écran : trois sur téléphone, quatre et demi sur ordinateur.
const filmScreens = (page: Page) =>
  page.evaluate(() => document.querySelector(".film")!.getBoundingClientRect().height / window.innerHeight);

test("la page d'accueil montre le titre et le bouton d'emblée, puis un film court", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  // Sans défiler : le titre, la promesse et le bouton tiennent dans le premier écran.
  const viewport = page.viewportSize()!;
  for (const target of [
    page.getByRole("heading", { level: 1, name: t.title }),
    page.getByText(t.lead, { exact: true }),
    page.locator(".film-beat-hero .film-cta a"),
  ]) {
    const box = (await target.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
  const screens = await filmScreens(page);
  expect(screens).toBeCloseTo(viewport.width < 1024 ? 3 : 4.5, 1);

  // Le film est un relais : le premier athlète est en scène, les deux autres attendent leur tour.
  const athletes = page.locator("[data-film-athlete]");
  await expect(athletes).toHaveCount(3);
  await expect(page.locator('[data-film-athlete="hurdles"]')).toBeVisible();
  await expect(page.locator('[data-film-athlete="highJump"]')).toBeHidden();

  // Au bout du film, c'est le troisième qui a pris le relais.
  await page.evaluate(() => {
    const film = document.querySelector(".film")!.getBoundingClientRect();
    window.scrollTo(0, film.top + window.scrollY + 0.7 * (film.height - window.innerHeight));
  });
  await expect(page.locator('[data-film-athlete="highJump"]')).toBeVisible();
  await expect(page.locator('[data-film-athlete="hurdles"]')).toBeHidden();
  await expect(page.locator(".film")).toHaveAttribute("data-world", "nuit");
});

test("le groupe se présente, un seul athlète joue son geste à la fois", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const band = page.getByRole("list", { name: t.group.label });
  await band.scrollIntoViewIfNeeded();
  await expect(band.locator("[data-athlete]")).toHaveCount(ATHLETE_IDS.length);
  for (const id of ATHLETE_IDS) {
    await expect(band.getByText(m.group.events[id], { exact: true })).toBeAttached();
  }

  // Un geste qui joue redessine sa scène d'image en image ; les autres ne bougent pas.
  const moving = async () => {
    const before = await band.locator("svg").evaluateAll((scenes) => scenes.map((scene) => scene.innerHTML));
    await page.waitForTimeout(250);
    const after = await band.locator("svg").evaluateAll((scenes) => scenes.map((scene) => scene.innerHTML));
    return before.map((scene, index) => scene !== after[index]).filter(Boolean).length;
  };
  await expect.poll(moving).toBe(1);

  // La bande défile de côté sur téléphone, et se parcourt au clavier.
  if (phone(page)) {
    expect(await band.evaluate((list) => list.scrollWidth > list.clientWidth)).toBe(true);
    await expect(band).toHaveAttribute("tabindex", "0");
  }
  await expectNoHorizontalScroll(page);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("list", { name: t.group.label }).scrollIntoViewIfNeeded();
  expect(await moving()).toBe(0);
  await expectNoMotion(page);
});

test("les tarifs se lisent en cartes sur téléphone, en tableau au-delà", async ({ page }) => {
  await page.goto("/tarifs", { waitUntil: "networkidle" });
  const cards = ["discovery", "coach", "club"].map((key) =>
    page.getByRole("region", { name: m.billing.plans[key as "discovery" | "coach" | "club"], exact: true }),
  );
  const table = page.getByRole("table", { name: m.billing.compare.caption });
  if (phone(page)) {
    for (const card of cards) await expect(card).toBeVisible();
    // L'offre mise en avant dit ce qui la distingue, sans ouvrir le tableau.
    await expect(cards[1]!).toContainText(String(PLANS.coach.limits.maxAthletes));
    await expect(cards[1]!.getByRole("link")).toBeVisible();
    // Le tableau complet est replié : il s'ouvre à la demande, sans mot coupé.
    await expect(table).toBeHidden();
    await page.getByText(m.billing.compare.all, { exact: true }).click();
    await expect(table).toBeVisible();
    await expect(table.getByRole("rowheader", { name: m.billing.compare.retention })).toBeVisible();
    const hyphens = await table.evaluate((node) =>
      [...node.querySelectorAll("th, td")].map((cell) => getComputedStyle(cell).hyphens),
    );
    expect(new Set(hyphens)).toEqual(new Set(["manual"]));
  } else {
    for (const card of cards) await expect(card).toBeHidden();
    await expect(table).toBeVisible();
  }
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test("la page d'accueil répond aux questions d'avant inscription et reste accessible", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const questions = page.locator("section", { hasText: t.faq.more });
  const first = m.help.themes.demarrer.questions.pourQui;
  await page.getByText(first.q, { exact: true }).click();
  await expect(page.getByText(first.a, { exact: true })).toBeVisible();
  await expect(questions.getByRole("link", { name: t.faq.more, exact: true })).toHaveAttribute("href", "/aide");
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test("la page introuvable et la page hors ligne portent un athlète du groupe", async ({ page }) => {
  await page.goto("/cette-page-n-existe-pas");
  await expect(page.getByRole("heading", { name: m.common.notFound })).toBeVisible();
  await expect(page.locator("svg.athlete")).toHaveCount(1);
  await expectNoHorizontalScroll(page);
  await page.goto("/hors-ligne");
  await expect(page.getByRole("heading", { name: m.offline.title })).toBeVisible();
  await expect(page.locator("svg.athlete")).toHaveCount(1);
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

// L'échauffement : le jeu ne pèse rien tant qu'on n'y touche pas. Le code de la simulation porte le message
// « invalid seed » : aucun script chargé avant le clic ne le contient, un script chargé après, si.
test("l'échauffement ne charge le jeu qu'au premier geste, puis la course se joue sur la page", async ({ page }) => {
  test.setTimeout(90_000);
  const scriptsWith = (needle: string) =>
    page.evaluate(async (text) => {
      const urls = performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((url) => url.endsWith(".js") || url.includes(".js?"));
      const bodies = await Promise.all(urls.map((url) => fetch(url).then((response) => response.text())));
      return bodies.filter((body) => body.includes(text)).length;
    }, needle);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  const section = page.getByRole("region", { name: m.landing.warmUp.title });
  await section.scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");
  expect(await scriptsWith("invalid seed")).toBe(0);
  await expect(section.getByRole("link", { name: m.landing.warmUp.all })).toHaveAttribute("href", "/jeu");

  await section.getByRole("button", { name: m.landing.warmUp.play, exact: true }).click();
  await expect(section.getByRole("img", { name: m.game.events.hurdles.canvas })).toBeVisible();
  expect(await scriptsWith("invalid seed")).toBeGreaterThan(0);
  await section.getByRole("button", { name: m.game.start, exact: true }).click();
  await expect(section.getByRole("button", { name: m.game.events.hurdles.action, exact: true })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
