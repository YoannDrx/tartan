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

// La vidéo d'une fiche commune : le fondateur la dépose depuis la console, puis toute fiche du catalogue propose le
// geste animé ou la vidéo.
test("le fondateur dépose la vidéo d'une fiche commune, que la fiche propose à côté du geste animé", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  await createCoachSpace(page, "Catalogue vidéo", `catalogue-${info.project.name}@e2e.tartan.test`);
  await page.goto("/admin/exercices", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: m.admin.nav.exercises, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: m.admin.nav.exercises, exact: true })).toHaveAttribute(
    "aria-current",
    "true",
  );
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
        .setInputFiles(path.join(__dirname, "fixtures", "saut-240-etire.webm"));
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
  await page.getByRole("button", { name: new RegExp(`^${NAME} Bibliothèque`) }).click();
  const dialog = page.getByRole("dialog");
  const choice = dialog.getByRole("group", { name: media.choice });
  await expect(choice.getByRole("button", { name: media.motion, exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.locator("svg[data-view]")).toBeVisible();
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
