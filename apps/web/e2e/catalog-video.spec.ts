import { createHmac, randomUUID } from "node:crypto";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Client } from "pg";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

const DB = process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e";
const t = w.admin.catalogVideos;
const media = m.exerciseGuide.media;
const KEY = "back-squat";
const NAME = "Squat arrière";

const inspect = async (page: Page) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  }
};

async function checkLegacyGuide(page: Page, pilot: string) {
  const sql = new Client({ connectionString: DB });
  await sql.connect();
  const id = randomUUID();
  const name = "Éducatif historique " + pilot;
  const copy = w.admin.editorial;
  const before = await sql.query("SELECT id FROM exercises WHERE catalog_key=$1", [pilot]);
  try {
    // Cette fiche de stade est créée par la troisième validation sur la base jetable.
    expect(before.rowCount).toBe(0);
    await sql.query("INSERT INTO exercises (id,name,category,updated_at) VALUES ($1,$2,'strength',now())", [id, name]);
    await page.reload();
    const workshop = page.locator("#atelier");
    await expect(workshop.getByRole("heading", { name: copy.title })).toBeVisible();
    for (const label of [copy.text, copy.image, copy.motion]) {
      await expect(workshop.getByRole("button", { name: new RegExp("^" + label + " · ") })).toBeVisible();
      const approve = workshop.getByRole("button", { name: label + " · " + copy.approve, exact: true });
      if (await approve.count()) await approve.click();
      await expect(workshop.getByRole("button", { name: label + " · " + copy.reopen, exact: true })).toBeVisible();
    }
    const outside = workshop
      .locator("details")
      .filter({ has: page.locator("li").filter({ hasText: name }) })
      .first();
    if ((await outside.getAttribute("open")) === null) await outside.locator("summary").first().click();
    const row = outside.locator("li").filter({ hasText: name });
    await row.getByLabel(copy.legacyGuide).selectOption(pilot);
    await row.getByRole("button", { name: copy.linkGuide }).click();
    await expect
      .poll(
        async () =>
          (await sql.query("SELECT source_catalog_key FROM exercises WHERE id=$1", [id])).rows[0]?.source_catalog_key,
      )
      .toBe(pilot);
    await page.reload();
    if ((await outside.getAttribute("open")) === null) await outside.locator("summary").first().click();
    await expect(row.getByLabel(copy.legacyGuide)).toHaveValue(pilot);
    await inspect(page);
    await row.getByLabel(copy.legacyGuide).selectOption("");
    await row.getByRole("button", { name: copy.linkGuide }).click();
    await expect
      .poll(
        async () =>
          (await sql.query("SELECT source_catalog_key FROM exercises WHERE id=$1", [id])).rows[0]?.source_catalog_key,
      )
      .toBeNull();
  } finally {
    try {
      await sql.query("DELETE FROM exercises WHERE id=$1", [id]);
      if (before.rowCount === 0) {
        await sql.query("DELETE FROM exercises WHERE organization_id IS NULL AND catalog_key=$1", [pilot]);
        await sql.query("DELETE FROM platform_settings WHERE starts_with(key, $1)", [`exerciseReview:${pilot}:`]);
      }
    } finally {
      await sql.end();
    }
  }
}

// La vidéo d'une fiche commune : le fondateur la dépose depuis la console, puis toute fiche du catalogue propose le
// geste animé ou la vidéo.
test("le fondateur dépose la vidéo d'une fiche commune, que la fiche propose à côté du geste animé", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  await createCoachSpace(page, "Catalogue vidéo", `catalogue-${info.project.name}@e2e.tartan.test`);
  await page.goto("/admin/exercices", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: m.admin.nav.exercises, exact: true })).toBeVisible();
  await expect(page.locator(`a[href="/admin/exercices"]`)).toHaveAttribute("aria-current", "true");
  const list = page.locator("#atelier");
  const editorial = w.admin.editorial;
  await list.getByRole("link", { name: editorial.next }).click();
  await expect(list.getByRole("link", { name: editorial.previous })).toBeVisible();
  await list.getByLabel(editorial.family).selectOption("strength");
  await list.getByRole("button", { name: editorial.show }).click();
  await expect(list.getByLabel(editorial.family)).toHaveValue("strength");
  await expect(page).toHaveURL(/famille=strength/);
  if (info.project.name === "desktop") {
    const name = "Mobilité complète, 30 minutes";
    const outside = list
      .locator("details")
      .filter({ has: page.locator("li").filter({ hasText: name }) })
      .first();
    await outside.locator("summary").first().click();
    const row = outside.locator("li").filter({ hasText: name });
    await row.getByText(editorial.reviewCover, { exact: true }).click();
    const cover = row.locator("img");
    const alt = await cover.getAttribute("alt");
    expect(alt).toBeTruthy();
    const approveCover = row.getByRole("button", { name: editorial.image + " · " + editorial.approve, exact: true });
    const revokeCover = row.getByRole("button", { name: editorial.image + " · " + editorial.reopen, exact: true });
    await expect(revokeCover).toBeVisible();
    const detail = await page.context().newPage();
    try {
      await detail.goto("/exercices/e803f572-0db8-55a8-b734-a8cadc7e96b0");
      await expect(detail.getByRole("img", { name: alt!, exact: true })).toBeVisible();
      await revokeCover.click();
      await expect(approveCover).toBeVisible();
      await detail.reload();
      await expect(detail.getByRole("img", { name: alt!, exact: true })).toHaveCount(0);
      await approveCover.click();
      await expect(revokeCover).toBeVisible();
    } finally {
      await detail.close();
    }
  }
  const pilot = info.project.name === "desktop" ? "curve-pop-up" : "band-dorsiflexion";
  await page.goto("/admin/exercices?fiche=" + pilot);
  const workshop = page.locator("#atelier");
  const approve = workshop.getByRole("button", {
    name: w.admin.editorial.image + " · " + w.admin.editorial.approve,
    exact: true,
  });
  const reopen = workshop.getByRole("button", {
    name: w.admin.editorial.image + " · " + w.admin.editorial.reopen,
    exact: true,
  });
  await expect(approve.or(reopen)).toBeVisible();
  if (await reopen.isVisible()) await reopen.click();
  await expect(approve).toBeVisible();
  await approve.click();
  await expect(reopen).toBeVisible();
  await page.reload();
  await expect(reopen).toBeVisible();
  await reopen.click();
  await expect(approve).toBeVisible();
  await checkLegacyGuide(page, pilot);
  await page.getByRole("searchbox", { name: t.search }).fill("squat arriere");
  const card = page.locator(`[data-catalog-key="${KEY}"]`);
  await expect(card.getByRole("heading", { name: NAME, exact: true })).toBeVisible();
  const side = card.locator('[data-catalog-view="side"]');
  await expect(side).toHaveAttribute("data-status", /none|ready|uploading|error/);
  await inspect(page);
  if (info.project.name === "desktop")
    await page.screenshot({ path: info.outputPath("admin-exercices.png"), fullPage: true });

  const sql = new Client({ connectionString: DB });
  await sql.connect();
  try {
    if (process.env.E2E_VIDEO_ENABLED === "true") {
      // L'envoi direct est simulé ; le webhook signé rend la vidéo prête.
      await page.route("https://upload.mux.com/tartan-e2e/**", (route) =>
        route.fulfill({
          status: route.request().method() === "OPTIONS" ? 204 : 201,
          headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" },
        }),
      );
      await side
        .getByLabel(
          new RegExp(`${t.choose(m.exerciseGuide.motion.views.side)}|${t.replace(m.exerciseGuide.motion.views.side)}`),
        )
        .setInputFiles(path.join(import.meta.dirname, "fixtures", "saut-240-etire.webm"));
      await expect(page.getByText(t.sent)).toBeVisible({ timeout: 30_000 });
      const { rows } = await sql.query(
        "select id from catalog_media where catalog_key=$1 and view='side' order by created_at desc limit 1",
        [KEY],
      );
      const event = JSON.stringify({
        type: "video.asset.ready",
        data: { id: `asset-${randomUUID()}`, passthrough: `catalog:${rows[0].id}`, playback_ids: [{ id: "play-e2e" }] },
      });
      const stamp = Math.floor(Date.now() / 1000);
      const signature = createHmac("sha256", "mux-webhook-local-test").update(`${stamp}.${event}`).digest("hex");
      const delivered = await page.request.post("/api/webhooks/mux", {
        data: event,
        headers: { "mux-signature": `t=${stamp},v1=${signature}`, "content-type": "application/json" },
      });
      expect(delivered.ok()).toBe(true);
    } else {
      // Sans Mux, la console le dit, et aucun envoi n'est possible ; la vidéo prête est posée en base.
      await expect(page.getByText(t.disabled)).toBeVisible();
      await sql.query(
        `insert into catalog_media (id, catalog_key, view, status, mux_asset_id, mux_playback_id, updated_at)
         values ($1, $2, 'side', 'ready', $3, 'play-e2e', now())`,
        [randomUUID(), KEY, `asset-${randomUUID()}`],
      );
    }
  } finally {
    await sql.end();
  }
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("searchbox", { name: t.search }).fill("squat arriere");
  await expect(side).toHaveAttribute("data-status", "ready");
  await expect(side.getByText(t.status.ready)).toBeVisible();
  await expect(side.getByRole("button", { name: t.remove(m.exerciseGuide.motion.views.side) })).toBeVisible();

  // La fiche du catalogue propose maintenant le geste animé, puis la vidéo.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/exercices", { waitUntil: "networkidle" });
  await page.getByLabel(m.exercises.search, { exact: true }).fill(NAME);
  // La fiche a sa propre adresse : le lien de la bibliothèque porte le nom puis la famille.
  await page
    .getByRole("link", { name: new RegExp(`^${NAME} `) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/exercices\/[0-9a-f-]+$/);
  const dialog = page.getByRole("region", { name: m.exerciseGuide.title });
  const choice = dialog.getByRole("group", { name: media.choice });
  await expect(choice.getByRole("button", { name: media.motion, exact: true })).toHaveAttribute("aria-pressed", "true");
  await choice.getByRole("button", { name: media.photo, exact: true }).click();
  await expect(dialog.locator('img[src$="/back-squat-v1.webp"]')).toBeVisible();
  await choice.getByRole("button", { name: media.motion, exact: true }).click();
  await expect(dialog.locator("svg[data-view]").first()).toBeVisible();
  await choice.getByRole("button", { name: media.video, exact: true }).click();
  await expect(choice.getByRole("button", { name: media.video, exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.locator("svg[data-view]")).toHaveCount(0);
  // Sans clé de signature Mux sur ce poste, la vidéo est annoncée mais pas lisible : la fiche le dit.
  await expect(dialog.getByRole("status").filter({ hasText: media.videoUnavailable })).toBeVisible();
  await inspect(page);
  if (info.project.name === "desktop")
    await page.screenshot({ path: info.outputPath("fiche-video.png"), fullPage: true });
  await choice.getByRole("button", { name: media.motion, exact: true }).click();
  await expect(dialog.getByText(media.videoUnavailable)).toHaveCount(0);
  await expect(dialog.locator("svg").first()).toBeVisible();
});
