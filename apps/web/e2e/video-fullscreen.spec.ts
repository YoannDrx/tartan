import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll, expectNoMotion } from "./helpers";
import { groupLink, joinAsAthlete } from "./journeys";

const DB = process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e";
const clip = readFileSync(path.resolve(import.meta.dirname, "fixtures/saut-240-etire.webm"));
// Captures de recette, hors dépôt : `E2E_SHOTS_DIR=/chemin corepack pnpm test:e2e e2e/video-fullscreen.spec.ts`.
const SHOTS = process.env.E2E_SHOTS_DIR;
const t = w.video;

// Le clip de test passe par une variable réservée au développement, inerte sur un build de production :
// ce parcours tourne donc sans `E2E_PROD`, comme `video-poc`.
test.skip(Boolean(process.env.E2E_PROD), "le clip local n'est servi qu'en développement");
test.setTimeout(240_000);

const serveClip = (page: Page) =>
  page.route("**/dev-clip.webm", (route) => {
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

// Une vidéo prête, à 240 i/s étirée huit fois, comme l'envoi réel la range.
const insertVideo = async (sql: Client, organizationId: string, athleteId: string, uploadedBy: string) =>
  (
    await sql.query(
      `insert into videos (id, organization_id, athlete_id, uploaded_by, status, fps, time_scale, duration_ms, shared_with_athlete, updated_at)
       values (gen_random_uuid(), $1, $2, $3, 'ready', 240, 8, 2000, true, now()) returning id`,
      [organizationId, athleteId, uploadedBy],
    )
  ).rows[0].id as string;

const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

const box = async (locator: Locator) => {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
};
const paused = (player: Locator) => player.evaluate((v: HTMLVideoElement) => v.paused);
const time = (player: Locator) => player.evaluate((v: HTMLVideoElement) => v.currentTime);
const ready = async (player: Locator) => {
  await expect(player).toHaveAttribute("src", /dev-clip/);
  await expect.poll(() => player.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
};
const settled = (player: Locator) => expect.poll(() => player.evaluate((v: HTMLVideoElement) => !v.seeking)).toBe(true);
const immersive = (page: Page) => page.locator("[data-immersive]");
// Sur le serveur de développement, avec le clip local, la réponse d'un envoi met parfois plusieurs secondes à
// revenir à la page (mesuré sur `video-poc`, avant ce parcours). L'affichage d'une remarque envoyée a donc une marge.
const SAVED = { timeout: 45_000 };
const annotations = async (sql: Client, videoId: string) =>
  (await sql.query("select kind, text, shape from video_annotations where video_id=$1 order by created_at", [videoId]))
    .rows;

test("plein écran sur ordinateur : éditeur à droite, raccourcis, remarque et tracés", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await page.setViewportSize({ width: 1440, height: 900 });
  await createCoachSpace(page, "Plein écran");
  const me = await (await page.request.get("/api/v1/me")).json();
  const sql = new Client({ connectionString: DB });
  await sql.connect();
  try {
    const org = (await sql.query("select id, owner_id from organizations where id=$1", [me.spaces[0].organizationId]))
      .rows[0];
    const athlete = (
      await sql.query(
        "insert into athletes (id, organization_id, user_id, first_name, last_name, updated_at) values (gen_random_uuid(), $1, $2, 'Léa', 'Test', now()) returning id",
        [org.id, org.owner_id],
      )
    ).rows[0];
    await sql.query(
      "insert into athlete_consents (athlete_id, kind, version, granted_at) values ($1, 'video', '1', now())",
      [athlete.id],
    );
    const videoId = await insertVideo(sql, org.id, athlete.id, org.owner_id);
    await serveClip(page);
    await page.goto(`/videos/${videoId}`);
    const player = page.locator("video");
    await ready(player);
    const remark = page.getByPlaceholder(/Remarque à/);
    const editor = page.getByRole("complementary", { name: t.editor });
    const enter = page.getByRole("button", { name: t.fullscreen.enter, exact: true });
    const leave = page.getByRole("button", { name: t.fullscreen.exit, exact: true });

    await expectAccessible(page);
    await shot(page, "1440-hors-plein-ecran");

    // Les quatre raccourcis, hors plein écran. Espace : lecture puis pause.
    await page.keyboard.press("Space");
    await expect.poll(() => paused(player)).toBe(false);
    await page.keyboard.press("Space");
    await expect.poll(() => paused(player)).toBe(true);
    // Flèches : une image, soit 1/240 s réelle et 8/240 s dans le fichier étiré.
    await settled(player);
    const origin = await time(player);
    await page.keyboard.press("ArrowRight");
    await settled(player);
    expect((await time(player)) - origin).toBeCloseTo(8 / 240, 2);
    await page.keyboard.press("ArrowLeft");
    await settled(player);
    expect(await time(player)).toBeCloseTo(origin, 2);

    // Dans un champ, les mêmes touches écrivent : ni lecture, ni pas, ni plein écran.
    const before = await time(player);
    for (const field of [remark, page.getByPlaceholder(m.comments.placeholder)]) {
      await field.click();
      await page.keyboard.type("fm f");
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowRight");
      await expect(field).toHaveValue("fm f ");
      await expect(immersive(page)).toHaveCount(0);
      expect(await paused(player)).toBe(true);
      expect(await time(player)).toBe(before);
      await field.fill("");
    }
    // Sur un bouton, la barre d'espace reste au bouton.
    await page.getByRole("button", { name: "0,5×", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "0,5×", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await paused(player)).toBe(true);

    // L'aide annonce les raccourcis, et les touches s'y taisent aussi.
    await page.getByRole("button", { name: t.shortcuts.title, exact: true }).click();
    const help = page.getByRole("dialog", { name: t.shortcuts.title });
    await expect(help.getByText(t.shortcuts.actions.remark, { exact: true })).toBeVisible();
    await expect(help.getByText(t.shortcuts.note, { exact: true })).toBeVisible();
    await page.keyboard.press("f");
    await expect(immersive(page)).toHaveCount(0);
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();

    // Un tracé annulé au clavier : Échap rend la main au bouton de l'outil.
    await page.getByRole("button", { name: m.video.drawing.kinds.circle, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("application", { name: t.drawingKeyboard.area(m.video.drawing.kinds.circle) }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    const circle = page.getByRole("button", { name: m.video.drawing.kinds.circle, exact: true });
    await expect(circle).toHaveAttribute("aria-pressed", "false");
    await expect(circle).toBeFocused();
    await page.locator("body").click({ position: { x: 5, y: 5 } });

    // F : tout l'espace d'analyse passe en plein écran, l'éditeur à droite de l'image.
    await page.keyboard.press("f");
    await expect(immersive(page)).toHaveAttribute("data-immersive", "side");
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
    await expect(leave).toBeVisible();
    const image = await box(player);
    const panel = await box(editor);
    expect(panel.x).toBeGreaterThanOrEqual(image.x + image.width - 1);
    // La frise et les contrôles restent sous l'image.
    const timeline = await box(page.getByLabel(t.timelinePosition));
    expect(timeline.y).toBeGreaterThanOrEqual(image.y + image.height - 1);
    expect((await box(page.getByRole("button", { name: m.video.play, exact: true }))).y).toBeGreaterThanOrEqual(
      image.y + image.height - 1,
    );
    await expectAccessible(page);
    await shot(page, "1440-plein-ecran");

    // Le panneau se replie en rail fin, se déplie, s'élargit.
    await page.getByRole("button", { name: t.panel.collapse, exact: true }).click();
    await expect.poll(async () => (await box(editor)).width).toBeLessThan(60);
    await expect(remark).toBeHidden();
    await shot(page, "1440-plein-ecran-rail");
    await page.getByRole("button", { name: t.panel.expand, exact: true }).click();
    await expect(remark).toBeVisible();
    const narrow = (await box(editor)).width;
    await page.getByRole("button", { name: t.panel.widen, exact: true }).click();
    await expect.poll(async () => (await box(editor)).width).toBeGreaterThan(narrow + 100);
    await page.getByRole("button", { name: t.panel.narrow, exact: true }).click();
    await page.getByRole("button", { name: t.panel.collapse, exact: true }).click();

    // M : la lecture s'arrête, le panneau se rouvre, le champ de remarque prend le focus.
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Space");
    await expect.poll(() => paused(player)).toBe(false);
    await page.keyboard.press("m");
    await expect.poll(() => paused(player)).toBe(true);
    await expect(remark).toBeFocused();
    await page.keyboard.type("Genou qui s'ouvre");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Genou qui s'ouvre", { exact: true })).toBeVisible(SAVED);

    // Un tracé au pointeur, en plein écran : une ligne, deux touchers sur l'image.
    await page.getByRole("button", { name: m.video.drawing.kinds.line, exact: true }).click();
    const layer = page.getByRole("application");
    const area = await box(layer);
    await page.mouse.click(area.x + area.width * 0.4, area.y + area.height * 0.4);
    await page.mouse.click(area.x + area.width * 0.6, area.y + area.height * 0.6);
    await expect(page.getByText(m.video.drawing.ready, { exact: true })).toBeVisible();
    await shot(page, "1440-plein-ecran-trace");
    await page.getByRole("button", { name: m.video.addComment, exact: true }).click();
    await expect(page.getByRole("button", { name: m.video.drawing.kinds.line, exact: true })).toHaveAttribute(
      "aria-pressed",
      "false",
      SAVED,
    );

    // Un tracé au clavier, toujours en plein écran : un angle, trois points posés aux flèches.
    await page.getByRole("button", { name: m.video.drawing.kinds.angle, exact: true }).focus();
    await page.keyboard.press("Enter");
    const angle = page.getByRole("application", { name: t.drawingKeyboard.area(m.video.drawing.kinds.angle) });
    await expect(angle).toBeFocused();
    const status = page.getByTestId("drawing-status");
    const before2 = await time(player);
    await page.keyboard.press("Shift+ArrowLeft");
    await expect(page.getByTestId("drawing-cursor")).toBeVisible();
    await expect(status).toHaveText(t.drawingKeyboard.cursor(40, 50));
    await page.keyboard.press("Enter");
    await expect(status).toHaveText(t.drawingKeyboard.placed(1, 3, 40, 50));
    // Deux points au même endroit ne font pas un tracé.
    await page.keyboard.press("Enter");
    await expect(status).toHaveText(t.drawingKeyboard.moveFirst);
    await page.keyboard.press("Shift+ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    await page.keyboard.press("Space");
    await expect(status).toHaveText(t.drawingKeyboard.placed(2, 3, 50, 60));
    await page.keyboard.press("Shift+ArrowRight");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(status).toHaveText(t.drawingKeyboard.ready);
    // Tous les points posés, les flèches déplacent le dernier ; Retour arrière le reprend.
    await page.keyboard.press("ArrowUp");
    await expect(status).toHaveText(t.drawingKeyboard.cursor(60, 58));
    await page.keyboard.press("Backspace");
    await expect(status).toHaveText(t.drawingKeyboard.undone(3));
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(status).toHaveText(t.drawingKeyboard.ready);
    // Les flèches étaient au tracé : la vidéo n'a pas bougé, et le plein écran est resté.
    expect(await time(player)).toBe(before2);
    await expect(immersive(page)).toHaveAttribute("data-immersive", "side");
    await shot(page, "1440-plein-ecran-trace-clavier");
    // Entrée valide le tracé : la main passe au champ de remarque, puis Entrée l'envoie.
    await page.keyboard.press("Enter");
    await expect(remark).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(editor.getByText(/^Angle de \d+°$/).last()).toBeVisible(SAVED);
    const saved = await annotations(sql, videoId);
    expect(saved.map((row) => [row.kind, row.text])).toEqual([
      ["comment", "Genou qui s'ouvre"],
      ["line", null],
      ["angle", null],
    ]);
    expect(saved[1].shape.points).toHaveLength(2);
    expect(saved[2].shape.points).toEqual([
      { x: 0.4, y: 0.5 },
      { x: 0.5, y: 0.6 },
      { x: 0.6, y: 0.57 },
    ]);

    // Sortie : le bouton, puis F pour revenir, puis Échap.
    await leave.click();
    await expect(immersive(page)).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
    await expect(enter).toBeVisible();
    await enter.click();
    await expect(immersive(page)).toHaveAttribute("data-immersive", "side");
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Escape");
    await expect(immersive(page)).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();

    // En mouvement réduit, rien ne bouge, hors et en plein écran.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expectNoMotion(page);
    await page.keyboard.press("f");
    await expect(immersive(page)).toHaveAttribute("data-immersive", "side");
    await expectNoMotion(page);
    await page.keyboard.press("f");
    await expect(immersive(page)).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: null });

    // À 768 px, hors plein écran puis dedans : en portrait, l'éditeur est une feuille.
    await page.setViewportSize({ width: 768, height: 1024 });
    await expectNoHorizontalScroll(page);
    await shot(page, "768-hors-plein-ecran");
    await enter.click();
    await expect(immersive(page)).toHaveAttribute("data-immersive", "sheet");
    await page.getByRole("button", { name: t.sheet.grow, exact: true }).click();
    await expectAccessible(page);
    await shot(page, "768-plein-ecran");
    await leave.click();
  } finally {
    await sql.end();
  }
});

test("sans l'API de plein écran, le même agencement se déploie sur toute la fenêtre", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, "fullscreenEnabled", { get: () => false });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await createCoachSpace(page, "Surcouche");
  const me = await (await page.request.get("/api/v1/me")).json();
  const sql = new Client({ connectionString: DB });
  await sql.connect();
  try {
    const org = (await sql.query("select id, owner_id from organizations where id=$1", [me.spaces[0].organizationId]))
      .rows[0];
    const athlete = (
      await sql.query(
        "insert into athletes (id, organization_id, user_id, first_name, last_name, updated_at) values (gen_random_uuid(), $1, $2, 'Léa', 'Test', now()) returning id",
        [org.id, org.owner_id],
      )
    ).rows[0];
    await sql.query(
      "insert into athlete_consents (athlete_id, kind, version, granted_at) values ($1, 'video', '1', now())",
      [athlete.id],
    );
    const videoId = await insertVideo(sql, org.id, athlete.id, org.owner_id);
    await serveClip(page);
    await page.goto(`/videos/${videoId}`);
    const player = page.locator("video");
    await ready(player);
    await page.keyboard.press("f");
    await expect(immersive(page)).toHaveAttribute("data-immersive", "side");
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    // La surcouche couvre la fenêtre entière, l'éditeur à droite de l'image.
    const overlay = await box(immersive(page));
    expect([overlay.x, overlay.y, overlay.width, overlay.height]).toEqual([0, 0, 1440, 900]);
    const image = await box(player);
    expect((await box(page.getByRole("complementary", { name: t.editor }))).x).toBeGreaterThanOrEqual(
      image.x + image.width - 1,
    );
    await expectAccessible(page);
    // Échap sort, même depuis le champ de remarque.
    await page.getByPlaceholder(/Remarque à/).click();
    await page.keyboard.press("Escape");
    await expect(immersive(page)).toHaveCount(0);
  } finally {
    await sql.end();
  }
});

test("plein écran sur téléphone : la feuille à trois hauteurs, puis le panneau en paysage", async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await createCoachSpace(page, "Feuille");
  const link = await groupLink(page);
  const athlete = await joinAsAthlete(browser, link, "Lina");
  const phone = athlete.page;
  const sql = new Client({ connectionString: DB });
  await sql.connect();
  try {
    const me = await (await phone.request.get("/api/v1/me")).json();
    const organizationId = me.spaces[0].organizationId;
    const row = (
      await sql.query("select id from athletes where organization_id=$1 and user_id=$2", [organizationId, me.id])
    ).rows[0];
    const videoId = await insertVideo(sql, organizationId, row.id, me.id);
    await serveClip(phone);
    await phone.goto(`/mes-videos/${videoId}`);
    const player = phone.locator("video");
    await ready(player);
    const remark = phone.getByPlaceholder(/Remarque à/);
    const sheet = phone.getByRole("complementary", { name: t.editor });
    const grow = phone.getByRole("button", { name: t.sheet.grow, exact: true });
    const shrink = phone.getByRole("button", { name: t.sheet.shrink, exact: true });
    const height = 844;

    // Hors plein écran, sous 1024 px : l'image reste collée en haut pendant qu'on écrit plus bas.
    await expectAccessible(phone);
    await expectNoHorizontalScroll(phone);
    await shot(phone, "390-portrait-hors-plein-ecran");
    const comment = phone.getByPlaceholder(m.comments.placeholder);
    await comment.scrollIntoViewIfNeeded();
    await comment.click();
    await expect.poll(() => phone.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    const stuck = await box(player);
    expect(stuck.y).toBeGreaterThanOrEqual(0);
    expect(stuck.y).toBeLessThan(16);
    const field = await box(comment);
    expect(field.y).toBeGreaterThanOrEqual(stuck.y + stuck.height);
    await shot(phone, "390-portrait-hors-plein-ecran-saisie");

    // Le mode immersif est une surcouche : sur téléphone, le navigateur ne passe pas la page en plein écran.
    await phone.getByRole("button", { name: t.fullscreen.enter, exact: true }).click();
    await expect(immersive(phone)).toHaveAttribute("data-immersive", "sheet");
    expect(await phone.evaluate(() => document.fullscreenElement)).toBeNull();
    const overlay = await box(immersive(phone));
    expect([overlay.x, overlay.y, overlay.width, overlay.height]).toEqual([0, 0, 390, height]);

    // Première hauteur : la feuille repliée, la frise juste au-dessus, l'image au-dessus encore.
    await expect(remark).toBeHidden();
    await expect.poll(async () => (await box(sheet)).height).toBeLessThan(80);
    const timeline = await box(phone.getByLabel(t.timelinePosition));
    expect(timeline.y + timeline.height).toBeLessThanOrEqual((await box(sheet)).y + 1);
    expect((await box(player)).y + (await box(player)).height).toBeLessThanOrEqual(timeline.y + 1);
    await expect(shrink).toBeDisabled();
    await expectAccessible(phone);
    await shot(phone, "390-portrait-plein-ecran-rail");

    // Deuxième hauteur : la moitié de l'écran, l'image toujours visible au-dessus.
    await grow.click();
    await expect.poll(async () => Math.round((await box(sheet)).height)).toBe(height / 2);
    await expect(remark).toBeVisible();
    expect((await box(player)).height).toBeGreaterThan(120);
    await expectAccessible(phone);
    await shot(phone, "390-portrait-plein-ecran-moitie");

    // Troisième hauteur : la feuille en entier, sous le titre.
    await grow.click();
    await expect.poll(async () => (await box(sheet)).height).toBeGreaterThan(height - 80);
    await expect(player).toBeHidden();
    await expect(grow).toBeDisabled();
    await expectAccessible(phone);
    await shot(phone, "390-portrait-plein-ecran-entier");

    // Écrire une remarque ramène la feuille à moitié : l'instant commenté reste sous les yeux.
    await remark.click();
    await expect.poll(async () => Math.round((await box(sheet)).height)).toBe(height / 2);
    await expect(player).toBeVisible();
    await shrink.click();
    await expect.poll(async () => (await box(sheet)).height).toBeLessThan(80);

    // « Ajouter une remarque » : pause, feuille à moitié, champ prêt, image visible.
    await phone.getByRole("button", { name: m.video.play, exact: true }).click();
    await expect.poll(() => paused(player)).toBe(false);
    await phone.getByRole("button", { name: t.addRemark, exact: true }).click();
    await expect.poll(() => paused(player)).toBe(true);
    await expect(remark).toBeFocused();
    await expect.poll(async () => Math.round((await box(sheet)).height)).toBe(height / 2);
    const image = await box(player);
    expect(image.height).toBeGreaterThan(120);
    expect(image.y + image.height).toBeLessThanOrEqual((await box(sheet)).y + 1);
    // Le clavier du téléphone réduit la hauteur visible : la surcouche la suit, l'image et le champ restent là.
    await phone.setViewportSize({ width: 390, height: 520 });
    await expect.poll(async () => Math.round((await box(sheet)).height)).toBe(260);
    expect((await box(player)).height).toBeGreaterThan(80);
    const typed = await box(remark);
    expect(typed.y + typed.height).toBeLessThanOrEqual(520);
    await shot(phone, "390-portrait-plein-ecran-clavier");
    await phone.setViewportSize({ width: 390, height });
    await expect.poll(async () => Math.round((await box(sheet)).height)).toBe(height / 2);
    await remark.fill("Regard trop bas");
    await phone.getByRole("button", { name: m.video.addComment, exact: true }).click();
    await expect(phone.getByText("Regard trop bas", { exact: true })).toBeVisible(SAVED);
    await shot(phone, "390-portrait-plein-ecran-remarque");

    // La poignée se glisse aussi : lâchée près du haut, la feuille s'ouvre en entier ; un toucher la replie.
    const handle = await box(phone.getByTestId("sheet-handle"));
    await phone.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await phone.mouse.down();
    await phone.mouse.move(handle.x + handle.width / 2, 200, { steps: 4 });
    await phone.mouse.move(handle.x + handle.width / 2, 90, { steps: 4 });
    await phone.mouse.up();
    await expect.poll(async () => (await box(sheet)).height).toBeGreaterThan(height - 80);
    await phone.getByTestId("sheet-handle").click();
    await expect.poll(async () => (await box(sheet)).height).toBeLessThan(80);

    // En mouvement réduit, la feuille change de hauteur sans animation.
    await phone.emulateMedia({ reducedMotion: "reduce" });
    await grow.click();
    await expectNoMotion(phone);
    await phone.emulateMedia({ reducedMotion: null });

    // En paysage, l'éditeur passe à droite de l'image, comme sur ordinateur.
    await phone.setViewportSize({ width: height, height: 390 });
    await expect(immersive(phone)).toHaveAttribute("data-immersive", "side");
    const landscape = await box(player);
    expect((await box(sheet)).x).toBeGreaterThanOrEqual(landscape.x + landscape.width - 1);
    expect(landscape.height).toBeGreaterThan(180);
    await expectAccessible(phone);
    await shot(phone, "390-paysage-plein-ecran");
    await phone.getByRole("button", { name: t.fullscreen.exit, exact: true }).click();
    await expect(immersive(phone)).toHaveCount(0);
    await expectNoHorizontalScroll(phone);
    await shot(phone, "390-paysage-hors-plein-ecran");
  } finally {
    await sql.end();
    await athlete.context.close();
  }
});
