import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

test("l’analyse générique reste sans phase imposée et conserve les annotations de saut", async ({ page }, info) => {
  await page.setViewportSize({ width: info.project.name === "desktop" ? 1440 : 390, height: 900 });
  await createCoachSpace(page, "Vidéo générique");
  const me = await (await page.request.get("/api/v1/me")).json();
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    const org = (await sql.query("select id, owner_id from organizations where id=$1", [me.spaces[0].organizationId]))
      .rows[0];
    const athlete = (
      await sql.query(
        "insert into athletes (id, organization_id, user_id, first_name, last_name, updated_at) values (gen_random_uuid(), $1, $2, 'Sprint', 'Test', now()) returning id",
        [org.id, org.owner_id],
      )
    ).rows[0];
    await sql.query(
      "insert into athlete_consents (athlete_id, kind, version, granted_at) values ($1, 'video', '1', now())",
      [athlete.id],
    );
    const video = (
      await sql.query(
        "insert into videos (id, organization_id, athlete_id, uploaded_by, status, fps, time_scale, duration_ms, updated_at) values (gen_random_uuid(), $1, $2, $3, 'ready', 30, 1, 1000, now()) returning id",
        [org.id, athlete.id, org.owner_id],
      )
    ).rows[0];
    await page.goto(`/videos/${video.id}`);
    const toggle = page.getByLabel("Outils de saut en hauteur");
    const phase = page.getByLabel("Phase du saut", { exact: true });
    await expect(toggle).not.toBeChecked();
    await expect(phase).toHaveCount(0);
    await toggle.check();
    await phase.selectOption("takeoff");
    // Fermer les outils ne doit pas envoyer une ancienne sélection devenue invisible.
    await toggle.uncheck();
    await expect(phase).toHaveCount(0);
    await page.getByPlaceholder(/Remarque à/).fill("Appuis sous le bassin");
    await page.getByRole("button", { name: "Ajouter le commentaire" }).click();
    await expect(page.getByText("Appuis sous le bassin", { exact: true })).toBeVisible();
    expect(
      (
        await sql.query("select phase from video_annotations where video_id=$1 and text=$2", [
          video.id,
          "Appuis sous le bassin",
        ])
      ).rows,
    ).toEqual([{ phase: null }]);
    await page.reload();
    await expect(toggle).not.toBeChecked();
    await expect(page.getByText("Appuis sous le bassin", { exact: true })).toBeVisible();
    await toggle.check();
    await phase.selectOption("takeoff");
    await page.getByPlaceholder(/Remarque à/).fill("Impulsion historique conservée");
    await page.getByRole("button", { name: "Ajouter le commentaire" }).click();
    await expect(page.getByText("Impulsion historique conservée", { exact: true })).toBeVisible();
    await page.reload();
    await expect(toggle).toBeChecked();
    await expect(phase).toBeVisible();
    expect(
      (await sql.query("select phase from video_annotations where video_id=$1 order by created_at", [video.id])).rows,
    ).toEqual([{ phase: null }, { phase: "takeoff" }]);
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await toggle.uncheck();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(page);
      await expect(page.getByRole("button", { name: "Ajouter le commentaire" })).toBeVisible();
    }
    await page.setViewportSize({ width: info.project.name === "desktop" ? 1440 : 390, height: 900 });
    await page.screenshot({ path: `/tmp/tartan-video-generic-${info.project.name}.png`, fullPage: true });
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expectNoHorizontalScroll(page);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "";
    });
    await page.goto("/videos");
    await expect(page.getByText("Barre non renseignée", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Importer", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Importer une vidéo", exact: true })).toBeVisible();
  } finally {
    await sql.end();
  }
});
