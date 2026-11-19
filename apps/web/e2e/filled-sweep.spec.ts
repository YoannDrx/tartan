import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll, sqlQuery, uniqueEmail } from "./helpers";
import { groupLink, joinAsAthlete } from "./journeys";

// Le balayage sur données remplies (lot K2, constats B6, G4, G13). La matrice des écrans tourne sur un espace vide :
// elle ne voyait pas `/suivi` déborder de 165 px dès que la semaine comptait neuf séances. Ici, un espace rempli par
// le script de démonstration (`demo:fill --groupe`) : 30 athlètes, puis 40, et une semaine de neuf séances publiées.

const DB = process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e";
const PORT = Number(process.env.E2E_PORT ?? 3100);
const WIDTHS = [390, 768, 1440];

test.describe.configure({ retries: 0 });

const fillGroup = (email: string, count: number) =>
  execFileSync("corepack", ["pnpm", "exec", "tsx", "prisma/demo-fill.ts", email, "--groupe", String(count)], {
    cwd: path.join(import.meta.dirname, ".."),
    env: {
      ...process.env,
      DATABASE_URL: DB,
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
      BETTER_AUTH_SECRET: "secret-e2e-secret-e2e-secret-e2e-secret-e2e",
      CRON_SECRET: "e2e-cron",
      RESEND_API_KEY: "",
      MUX_TOKEN_ID: "",
      MUX_TOKEN_SECRET: "",
      OPENAI_API_KEY: "",
    },
    stdio: "pipe",
  });

// Les captures de recette, hors dépôt, seulement si `E2E_SHOTS_DIR` est posé (comme `video-fullscreen`).
const shot = async (page: Page, name: string) => {
  if (!process.env.E2E_SHOTS_DIR) return;
  const width = page.viewportSize()?.width ?? 0;
  await page.screenshot({ path: path.join(process.env.E2E_SHOTS_DIR, `${name}-${width}.png`) });
};

const sweep = async (page: Page, paths: string[]) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const target of paths) {
    const response = await page.goto(target, { waitUntil: "networkidle" });
    expect(response?.status() ?? 200, target).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: m.common.genericError }), target).toHaveCount(0);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(page);
      await expectAccessible(page);
      await shot(page, `rempli${target.replace(/[^a-z]+/gi, "-")}`);
    }
  }
};

// Les lignes d'athlètes affichées dans la grille du suivi.
const gridRows = (page: Page) => page.locator("tbody tr");

test("données remplies : 30 puis 40 athlètes, neuf séances, sans débordement et cherchables", async ({
  page,
}, info) => {
  // Les largeurs sont posées à la main : un seul projet suffit, comme la matrice.
  test.skip(info.project.name !== "desktop", "balayage unique, largeurs explicites");
  test.setTimeout(600_000);
  const email = uniqueEmail("volume");
  await createCoachSpace(page, "Volume", email);
  fillGroup(email, 30);

  const [first] = await sqlQuery<{ id: string }>(
    `select s.id from scheduled_sessions s join organization_members om on om.organization_id = s.organization_id
     join "user" u on u.id = om.user_id
     where u.email = $1 and om.role = 'owner' and s.location = 'Stade annexe' order by s.date, s.start_time limit 1`,
    [email],
  );
  const sessionId = first!.id;

  // B6 : la semaine compte bien neuf séances, et la page tient à 390 px.
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/suivi", { waitUntil: "networkidle" });
  await expect(page.locator(`thead a[href^="/seances/"]`)).toHaveCount(9);
  await expect(gridRows(page)).toHaveCount(30);
  await sweep(page, ["/suivi", "/athletes", "/calendrier", `/seances/${sessionId}/suivi`]);

  // G4 : au-delà de trente, la liste se rend par tranches, et l'on retrouve un athlète par son nom.
  fillGroup(email, 10);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/suivi", { waitUntil: "networkidle" });
  await expect(page.getByText(w.tracking.shown(30, 40))).toBeVisible();
  await expect(gridRows(page)).toHaveCount(30);
  await page.getByRole("button", { name: w.tracking.showMore(10) }).click();
  await expect(gridRows(page)).toHaveCount(40);
  const search = page.getByRole("searchbox", { name: w.tracking.search });
  // Sans accent ni majuscule : « elise » trouve les quatre Élise.
  await search.fill("elise");
  await expect(gridRows(page)).toHaveCount(4);
  await search.fill("delacroix louis");
  await expect(gridRows(page)).toHaveCount(4);
  await search.fill("personne");
  await expect(page.getByText(w.tracking.noMatch("personne"))).toBeVisible();
  await search.fill("");

  // L'en-tête des séances reste en vue quand la grille défile.
  const frame = page.getByRole("region", { name: m.coach.trackingTitle });
  const header = page.locator("thead th").first();
  const top = async () => (await header.boundingBox())!.y - (await frame.boundingBox())!.y;
  expect(await top()).toBeLessThan(2);
  await frame.evaluate((element) => element.scrollBy({ top: 900 }));
  expect(await top()).toBeLessThan(2);

  // Même chose pour la liste des athlètes : recherche, tranches, et en-tête collé sous la barre de l'application.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/athletes", { waitUntil: "networkidle" });
  await expect(page.locator(`tbody a[href^="/athletes/"]`)).toHaveCount(30);
  await page.getByRole("searchbox", { name: w.tracking.search }).fill("chloe");
  await expect(page.locator(`tbody a[href^="/athletes/"]`)).toHaveCount(4);
  await page.getByRole("searchbox", { name: w.tracking.search }).fill("");
  await page.mouse.wheel(0, 1500);
  await expect
    .poll(async () => (await page.getByRole("columnheader", { name: m.coach.athleteCol }).boundingBox())!.y)
    .toBeLessThan(80);
  await sweep(page, ["/suivi", "/athletes"]);
});

test("états vides : les phases et les progrès portent l'athlète de leur rubrique", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop", "un seul passage suffit");
  test.setTimeout(240_000);
  const email = uniqueEmail("vides");
  await createCoachSpace(page, "Vides", email);
  await sqlQuery(
    `update organizations set phases_enabled = true where id in (
       select organization_id from organization_members om join "user" u on u.id = om.user_id where u.email = $1)`,
    [email],
  );
  // Finition 8.5 : le premier arrêt du clavier passe l'en-tête et mène au contenu.
  await page.goto("/suivi", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: w.common.skipToContent });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await shot(page, "lien-evitement");
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();

  // G13 : sans phase, le coach voit Inès (rubrique calendrier et phases) et l'ajout de la première phase.
  await page.goto("/phases", { waitUntil: "networkidle" });
  const phases = page.locator("main").getByText(w.planning.phasesEmptyCoach);
  await expect(phases).toBeVisible();
  await expect(page.locator(`main [data-athlete="hurdles"]`)).toBeVisible();
  await expect(page.getByRole("button", { name: m.trainingPhases.add })).toHaveCount(1);
  await expectAccessible(page);
  await shot(page, "vide-phases-coach");

  // Un athlète tout juste arrivé : ni record ni test, Malo l'attend sur ses progrès.
  const athlete = await joinAsAthlete(browser, await groupLink(page), "Vide");
  try {
    await athlete.page.goto("/progres", { waitUntil: "networkidle" });
    await expect(athlete.page.getByText(w.progress.empty)).toBeVisible();
    await expect(athlete.page.locator(`main [data-athlete="poleVault"]`)).toBeVisible();
    await expectAccessible(athlete.page);
    await expectNoHorizontalScroll(athlete.page);
    await shot(athlete.page, "vide-progres-athlete");
    await athlete.page.goto("/phases", { waitUntil: "networkidle" });
    await expect(athlete.page.getByText(w.planning.phasesEmptyAthlete)).toBeVisible();
    await expectAccessible(athlete.page);
  } finally {
    await athlete.context.close();
  }
});
