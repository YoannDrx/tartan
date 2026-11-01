import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { createCoachSpace } from "./helpers";

const DB = process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e";
const clip = readFileSync(path.resolve(import.meta.dirname, "fixtures/saut-240-etire.webm"));

// Preuve de concept du § 11.5 côté web : ralenti et pas image par image sur un 240 i/s étiré ×8 avant l'envoi,
// comme le fait l'envoi réel : le fichier fait 16 s à 30 i/s pour 2 s réelles.
// iOS et Android restent à valider sur appareils réels avec une vraie vidéo Mux.
test("lecture image par image d'une vidéo à 240 i/s", async ({ page }, info) => {
  // Le clip de test passe par une variable réservée au développement : elle est inerte en production.
  test.skip(info.project.name !== "desktop" || Boolean(process.env.E2E_PROD));
  await createCoachSpace(page, "Analyse");
  const sql = new Client({ connectionString: DB });
  await sql.connect();
  const org = (await sql.query("select id, owner_id from organizations order by created_at desc limit 1")).rows[0];
  const athlete = (
    await sql.query(
      `insert into athletes (id, organization_id, user_id, first_name, last_name, updated_at) values (gen_random_uuid(), $1, $2, 'Léa', 'Test', now()) returning id`,
      [org.id, org.owner_id],
    )
  ).rows[0];
  // Sans accord vidéo, le lecteur reste fermé au coach.
  await sql.query(
    `insert into consents (id, user_id, kind, version, granted_at, updated_at) values (gen_random_uuid(), $1, 'video', '1', now(), now())`,
    [org.owner_id],
  );
  const video = (
    await sql.query(
      `insert into videos (id, organization_id, athlete_id, uploaded_by, status, fps, time_scale, duration_ms, updated_at)
       values (gen_random_uuid(), $1, $2, $3, 'ready', 240, 8, 2000, now()) returning id`,
      [org.id, athlete.id, org.owner_id],
    )
  ).rows[0];
  await sql.end();

  await page.route("**/dev-clip.webm", (route) => {
    const range = route.request().headers().range;
    const headers = { "Content-Type": "video/webm", "Accept-Ranges": "bytes" };
    if (!range)
      return route.fulfill({ status: 200, headers: { ...headers, "Content-Length": String(clip.length) }, body: clip });
    const [startText, endText] = range.replace("bytes=", "").split("-");
    const start = Number(startText);
    const end = endText ? Number(endText) : clip.length - 1;
    return route.fulfill({
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${clip.length}`,
        "Content-Length": String(end - start + 1),
      },
      body: clip.subarray(start, end + 1),
    });
  });
  await page.goto(`/videos/${video.id}`);
  const player = page.locator("video");
  await expect(player).toHaveAttribute("src", /dev-clip/);
  await expect.poll(() => player.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);

  const time = () => player.evaluate((v: HTMLVideoElement) => v.currentTime);
  const frames: number[] = [];
  for (let i = 0; i < 12; i += 1) {
    await page.getByRole("button", { name: "Image suivante" }).click();
    await expect.poll(() => player.evaluate((v: HTMLVideoElement) => !v.seeking)).toBe(true);
    frames.push(await time());
  }
  // Chaque pas avance d'une image : 1/240 s réelle, soit 8/240 s dans le fichier étiré, sans retour en arrière.
  for (let i = 1; i < frames.length; i += 1) {
    expect((frames[i] as number) - (frames[i - 1] as number)).toBeCloseTo(8 / 240, 2);
  }
  const before = await time();
  await page.getByRole("button", { name: "Image précédente" }).click();
  await expect.poll(time).toBeLessThan(before);

  // Ralenti réglable de 0,1× à 1× en temps réel : 0,1× réel vaut 0,8× pour le fichier étiré.
  await page.getByRole("button", { name: "0,1×" }).click();
  expect(await player.evaluate((v: HTMLVideoElement) => v.playbackRate)).toBeCloseTo(0.8);
  const start = await time();
  await page.getByRole("button", { name: "Lecture" }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Pause" }).click();
  const elapsed = (await time()) - start;
  expect(elapsed).toBeGreaterThan(0.24);
  expect(elapsed).toBeLessThan(2.4);

  // Commentaire placé à l'instant de la tête de lecture, classé par phase.
  await page.getByLabel("Phase du saut").selectOption("takeoff");
  await page.getByPlaceholder(/Remarque à/).fill("Pied d'appel posé à plat");
  await page.getByRole("button", { name: "Ajouter le commentaire" }).click();
  await expect(page.getByText("Pied d'appel posé à plat")).toBeVisible();
  await expect(page.getByText("Impulsion").first()).toBeVisible();
});
