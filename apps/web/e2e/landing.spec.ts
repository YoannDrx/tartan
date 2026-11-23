import { expect, test, type Page } from "@playwright/test";
import { PLANS } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { expectAccessible, expectNoHorizontalScroll, expectNoMotion } from "./helpers";

const t = m.landing;
const phone = (page: Page) => page.viewportSize()!.width < 768;

// Le film, en hauteurs d'écran : trois sur téléphone, quatre et demi sur ordinateur.
const filmScreens = (page: Page) =>
  page.evaluate(() => document.querySelector(".film")!.getBoundingClientRect().height / window.innerHeight);

test("la page d'accueil montre le titre et le bouton d'emblée, puis un film qui prend son temps", async ({ page }) => {
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
  expect(screens).toBeCloseTo(viewport.width < 1024 ? 7.5 : 10, 1);

  // Un seul geste répond au défilement : le saut en hauteur de Noé, du titre jusqu'à la validation.
  await expect(page.locator("[data-film-athlete]")).toHaveCount(1);
  await expect(page.locator('[data-film-athlete="highJump"]')).toBeVisible();

  // Au franchissement, le monde a changé ; le sauteur est toujours là.
  await page.evaluate(() => {
    const film = document.querySelector(".film")!.getBoundingClientRect();
    window.scrollTo(0, film.top + window.scrollY + 0.7 * (film.height - window.innerHeight));
  });
  await expect(page.locator(".film")).toHaveAttribute("data-world", "nuit");
  await expect(page.locator('[data-film-athlete="highJump"]')).toBeVisible();
});

test("l'en-tête écrit Tartan avec la marque pour T, lu « Tartan »", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const word = page.locator(".film-chrome .wordmark");
  await expect(word).toHaveAttribute("role", "img");
  await expect(word).toHaveAttribute("aria-label", "Tartan");
  // La hauteur d'un logotype lisible (DESIGN.md : 24 px au moins), et ses deux masques servis.
  expect((await word.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  for (const file of ["wordmark-letters.svg", "wordmark-line.svg"]) {
    expect((await page.request.get(`/brand/${file}`)).ok()).toBe(true);
  }
});

test("les écrans du coach et de l'athlète se parcourent par onglets, au clavier comme au doigt", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  for (const side of [t.coach, t.athlete]) {
    const tabs = page.getByRole("tablist", { name: side.tabs, exact: true });
    await tabs.scrollIntoViewIfNeeded();
    await expect(tabs.getByRole("tab")).toHaveCount(Object.keys(side.features).length);
    // Un seul écran à la fois, chacun avec son texte de remplacement.
    const first = tabs.getByRole("tab").first();
    await expect(first).toHaveAttribute("aria-selected", "true");
    await first.focus();
    await page.keyboard.press("ArrowRight");
    const second = tabs.getByRole("tab").nth(1);
    await expect(second).toBeFocused();
    await expect(second).toHaveAttribute("aria-selected", "true");
    const panel = page.getByRole("tabpanel", { name: await second.innerText(), exact: true });
    const image = panel.getByRole("img");
    await expect(image).toHaveCount(1);
    await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    if (phone(page)) {
      // Sur téléphone, la capture précède le texte qui la commente.
      const [shot, title] = await Promise.all([image.boundingBox(), panel.getByRole("heading").boundingBox()]);
      expect(shot!.y).toBeLessThan(title!.y);
    }
    await page.keyboard.press("End");
    await expect(tabs.getByRole("tab").last()).toHaveAttribute("aria-selected", "true");
  }
  for (const feature of [...Object.values(t.coach.features), ...Object.values(t.athlete.features)]) {
    expect(feature.alt.length, feature.tab).toBeGreaterThan(40);
  }
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);

  // L'application est ouverte à tous : ni pilote, ni bêta, ni légende de capture.
  const text = (await page.locator("body").innerText()).toLowerCase();
  for (const word of ["pilote", "bêta", "fictive", "fictif"]) expect(text).not.toContain(word);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("tablist", { name: t.coach.tabs, exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole("tab", { name: t.coach.features.planificateur.tab, exact: true }).click();
  await expectNoMotion(page);
  // Sans mouvement, le film reste sur le sauteur au-dessus de la barre.
  await expect(page.locator('[data-film-athlete="highJump"]')).toBeVisible();
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

// Le jeu est retiré depuis le 23 novembre 2026 : son ancienne adresse mène à l'accueil, et le site ne la cite plus.
test("l'ancienne page du jeu redirige vers l'accueil", async ({ page, request }) => {
  const legacy = "/jeu";
  const response = await request.get(legacy, { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toMatch(/^(https?:\/\/[^/]+)?\/$/);
  await page.goto(legacy);
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(legacy);
  expect(await (await request.get("/robots.txt")).text()).not.toContain(legacy);
});
