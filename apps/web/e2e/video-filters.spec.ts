import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll, sqlQuery } from "./helpers";

// Audit G2 : à 390 px, la vidéo vient avant les filtres, rangés dans une feuille ; « Feuille de barres » n'apparaît
// que si les athlètes affichés sautent en hauteur.
test("vidéos du coach : la liste d'abord, les filtres en feuille, la feuille de barres dans le contexte hauteur", async ({
  page,
}) => {
  await createCoachSpace(page, "Filtres vidéo");
  const me = await (await page.request.get("/api/v1/me")).json();
  const organizationId = me.spaces[0].organizationId as string;
  const [org] = await sqlQuery<{ owner_id: string }>("select owner_id from organizations where id=$1", [
    organizationId,
  ]);
  const [group] = await sqlQuery<{ id: string }>("select id from groups where organization_id=$1 limit 1", [
    organizationId,
  ]);
  const [athlete] = await sqlQuery<{ id: string }>(
    "insert into athletes (id, organization_id, first_name, last_name, updated_at) values (gen_random_uuid(), $1, 'Inès', 'Haies', now()) returning id",
    [organizationId],
  );
  await sqlQuery(
    "insert into group_members (group_id, athlete_id, created_at, updated_at) values ($1, $2, now(), now())",
    [group!.id, athlete!.id],
  );
  await sqlQuery("update athletes set disciplines = '{hurdles}' where id=$1", [athlete!.id]);
  const [video] = await sqlQuery<{ id: string }>(
    "insert into videos (id, organization_id, athlete_id, uploaded_by, status, fps, time_scale, duration_ms, updated_at) values (gen_random_uuid(), $1, $2, $3, 'ready', 30, 1, 1000, now()) returning id",
    [organizationId, athlete!.id, org!.owner_id],
  );
  const firstVideo = page.locator(`main a[href='/videos/${video!.id}']`);
  const filtersButton = page.getByRole("button", { name: new RegExp(`^${w.video.filters.open}`) });
  const statusFilter = page.getByLabel(m.videoCollaboration.allStates, { exact: true });
  const barSheet = page.getByRole("button", { name: m.video.barSheet, exact: true });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/videos", { waitUntil: "networkidle" });
  // La première vidéo est dans le premier écran ; aucun champ de filtre ne la précède.
  await expect(firstVideo).toBeInViewport();
  await expect(statusFilter).toBeHidden();
  // Une coureuse de haies : pas de feuille de barres.
  await expect(barSheet).toHaveCount(0);
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);

  // Les filtres s'ouvrent en feuille, puis le bouton dit combien sont actifs.
  await filtersButton.click();
  const sheet = page.getByRole("dialog", { name: w.video.filters.title });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel(m.videoCollaboration.allStates, { exact: true }).selectOption("ready");
  // La case « à relire » est la case dessinée des autres écrans : 24 px de cible (lot K2, constat G8).
  const review = sheet.getByRole("checkbox", { name: m.videoCollaboration.awaitingReview });
  await expect(review).toHaveClass(/\bcheck\b/);
  const box = (await review.boundingBox())!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24);
  await expectAccessible(page);
  await sheet.getByRole("button", { name: m.videoCollaboration.applyFilters, exact: true }).click();
  await expect(page).toHaveURL(/status=ready/);
  await expect(filtersButton).toContainText(w.video.filters.active(1));
  await expect(firstVideo).toBeInViewport();
  await page.getByRole("link", { name: w.video.filters.clear, exact: true }).click();
  await expect(page).not.toHaveURL(/status=/);
  await expect(page.getByRole("link", { name: w.video.filters.clear, exact: true })).toHaveCount(0);

  // L'athlète passe à la hauteur : la feuille de barres revient, dans son contexte.
  await sqlQuery("update athletes set disciplines = '{high_jump}' where id=$1", [athlete!.id]);
  await page.reload({ waitUntil: "networkidle" });
  await expect(barSheet).toBeVisible();

  // Sur ordinateur, les filtres tiennent sur une ligne au-dessus de la liste, sans feuille.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(statusFilter).toBeVisible();
  await expect(filtersButton).toBeHidden();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
});
