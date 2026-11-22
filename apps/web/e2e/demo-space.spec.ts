import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { DEMO_ATHLETES, DEMO_SPACE_NAME } from "@tartan/domain";
import {
  createCoachSpace,
  expectAccessible,
  expectNoHorizontalScroll,
  expectNoMotion,
  sqlQuery,
  uniqueEmail,
} from "./helpers";

// L'espace de démonstration, de bout en bout, sur le build de production : un coach neuf l'ouvre depuis ses premiers
// pas, y voit Tartan rempli (suivi, calendrier, une séance, un athlète), constate que le planificateur et l'envoi de
// vidéo y sont coupés, revient à son espace, puis supprime la démonstration.
const d = w.demoSpace;
const WIDTHS = [390, 768, 1440];

const shotPath = (info: TestInfo, name: string) =>
  process.env.DEMO_SPACE_SHOTS
    ? path.join(process.env.DEMO_SPACE_SHOTS, `${info.project.name}-${name}.png`)
    : info.outputPath(`${name}.png`);

// Chaque écran regardé à 390, 768 et 1440 px : sans débordement, sans erreur axe.
const atWidths = async (page: Page, info: TestInfo, name: string) => {
  const initial = page.viewportSize();
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    await page.screenshot({ path: shotPath(info, `${name}-${width}`), fullPage: true });
  }
  if (initial) await page.setViewportSize(initial);
};

const banner = (page: Page) => page.getByRole("region", { name: d.banner.label });
const lea = DEMO_ATHLETES[0]!;

test("un coach neuf ouvre la démonstration, la parcourt, revient à son espace et la supprime", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "un parcours complet, largeurs posées à la main");
  test.setTimeout(600_000);
  const email = uniqueEmail("demonstration");
  await createCoachSpace(page, "Demo", email);

  // Depuis la carte « Pour démarrer », jusqu'à la page des premiers pas.
  await page.getByRole("link", { name: d.intro.cardLink }).click();
  await expect(page.getByRole("heading", { name: d.intro.title })).toBeVisible();
  await atWidths(page, info, "premiers-pas");
  await page.getByRole("button", { name: d.intro.open }).click();

  // Le suivi de la démonstration : bandeau, athlètes fictifs, et un espace à part dans le sélecteur.
  await expect(banner(page)).toBeVisible({ timeout: 180_000 });
  await expect(page).toHaveURL(/\/suivi/);
  await expect(page.getByText(lea.firstName, { exact: false }).first()).toBeVisible();
  const switcher = page.getByLabel(m.settings.switchSpace);
  await expect(switcher.locator("option:checked")).toHaveText(d.switcherLabel(DEMO_SPACE_NAME));
  // Ni tour de piste, ni carte des premiers pas : la démonstration naît remplie.
  await expect(page.getByRole("dialog", { name: w.onboarding.tour.title })).toHaveCount(0);
  await expect(page.getByRole("region", { name: m.home.guidedTitle })).toHaveCount(0);
  await atWidths(page, info, "suivi");

  const [demo] = await sqlQuery<{ id: string }>(
    'SELECT o.id FROM organizations o JOIN "user" u ON u.id = o.demo_owner_id WHERE o.is_demo AND u.email = $1',
    [email],
  );
  expect(demo).toBeTruthy();
  // Aucun compte derrière les athlètes de la démonstration.
  const [accounts] = await sqlQuery<{ n: number }>(
    "SELECT count(*)::int AS n FROM athletes WHERE organization_id = $1 AND user_id IS NOT NULL",
    [demo!.id],
  );
  expect(accounts!.n).toBe(0);

  // Le calendrier, une séance, un athlète.
  await page.getByRole("link", { name: m.nav.calendrier }).first().click();
  await expect(page).toHaveURL(/\/calendrier/);
  await expect(banner(page)).toBeVisible();
  await expect(page.getByText("Force bas du corps").first()).toBeVisible();
  await atWidths(page, info, "calendrier");

  const [session] = await sqlQuery<{ id: string }>(
    "SELECT id FROM scheduled_sessions WHERE organization_id = $1 AND date < CURRENT_DATE ORDER BY date DESC LIMIT 1",
    [demo!.id],
  );
  await page.goto(`/seances/${session!.id}`);
  await expect(banner(page)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await atWidths(page, info, "seance");

  await page.goto("/athletes");
  await page
    .getByRole("link", { name: new RegExp(`${lea.firstName} ${lea.lastName}`) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/athletes\/[0-9a-f-]+/);
  await expect(banner(page)).toBeVisible();
  await atWidths(page, info, "athlete");

  // Coupés : le planificateur (ni onglet, ni écran) et l'envoi de vidéo (refusé par le serveur, raison donnée).
  await expect(page.getByRole("link", { name: m.nav.planificateur })).toHaveCount(0);
  await page.goto("/planificateur");
  await expect(page.getByText(w.planner.disabled)).toBeVisible();
  await expect(page.getByRole("link", { name: w.planner.seeOffers })).toHaveCount(0);
  const upload = await page.request.post(`/api/v1/orgs/${demo!.id}/videos`, {
    data: {},
    headers: { origin: new URL(page.url()).origin },
  });
  expect(upload.status()).toBe(403);
  expect(await upload.json()).toMatchObject({ code: "demo_space", message: d.cut.video });
  // La facturation non plus.
  await page.goto("/abonnement");
  await expect(page.getByText(d.cut.billing)).toBeVisible();

  // Mouvement réduit : le bandeau ne bouge pas.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/suivi");
  await expect(banner(page)).toBeVisible();
  await expectNoMotion(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // Retour à son espace : plus de bandeau, ses premiers pas l'attendent.
  await banner(page).getByRole("button", { name: d.banner.back }).click();
  await expect(banner(page)).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Suivi du groupe" })).toBeVisible();
  await expect(page.getByRole("region", { name: m.home.guidedTitle })).toBeVisible();

  // Depuis ses premiers pas, il supprime la démonstration, après confirmation.
  await page.goto("/premiers-pas#demonstration");
  await expect(page.getByText(/s'efface le \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
  await page.getByRole("button", { name: d.intro.remove }).click();
  const dialog = page.getByRole("dialog", { name: d.banner.confirmTitle });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: d.banner.confirm }).click();
  await expect(page.getByRole("button", { name: d.intro.open })).toBeVisible({ timeout: 30_000 });
  const [left] = await sqlQuery<{ n: number }>("SELECT count(*)::int AS n FROM organizations WHERE id = $1", [
    demo!.id,
  ]);
  expect(left!.n).toBe(0);
  await expect(page.getByLabel(m.settings.switchSpace)).toHaveCount(0);
});

test("depuis la démonstration, le bandeau la supprime et ramène à son espace", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "un parcours complet, largeurs posées à la main");
  test.setTimeout(420_000);
  await createCoachSpace(page, "Bandeau");
  await page.goto("/premiers-pas#demonstration");
  await page.getByRole("button", { name: d.intro.open }).click();
  await expect(banner(page)).toBeVisible({ timeout: 180_000 });
  await banner(page).getByRole("button", { name: d.banner.removeLabel }).click();
  await page
    .getByRole("dialog", { name: d.banner.confirmTitle })
    .getByRole("button", { name: d.banner.confirm })
    .click();
  await expect(page).toHaveURL(/\/premiers-pas/, { timeout: 30_000 });
  await expect(banner(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: d.intro.open })).toBeVisible();
});
