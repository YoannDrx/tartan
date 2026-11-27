import { expect, test, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll, expectNoMotion, sqlQuery } from "./helpers";
import { groupLink, joinAsAthlete, publishSession } from "./journeys";

// La photo de profil et les avatars : envoi, recadrage, enregistrement, puis la photo dans l'en-tête et le suivi ;
// un avatar animal ; le retour aux initiales ; le logo de l'espace. Le stockage Blob est simulé
// (`e2e/blob-server.mjs`) : le vrai SDK y envoie le fichier, et le parcours sert l'image au navigateur.
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
const BLOB_PORT = Number(process.env.E2E_BLOB_PORT ?? 3104);
const BLOB_HOST = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//;
const t = w.profile;

const serveBlobs = (page: Page) =>
  page.route(BLOB_HOST, async (route) => {
    const path = new URL(route.request().url()).pathname.slice(1);
    await route.fulfill({ response: await page.request.fetch(`http://127.0.0.1:${BLOB_PORT}/files/${path}`) });
  });

// Une photo en paysage, dessinée dans la page : 900 × 600, un disque citron à gauche pour voir le cadrage.
const landscapePhoto = async (page: Page) => {
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 600;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgb(43, 77, 255)";
    ctx.fillRect(0, 0, 900, 600);
    ctx.fillStyle = "rgb(198, 244, 50)";
    ctx.beginPath();
    ctx.arc(250, 300, 160, 0, Math.PI * 2);
    ctx.fill();
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  return { name: "portrait.png", mimeType: "image/png", buffer: Buffer.from(data, "base64") };
};

const crop = (page: Page) => page.getByTestId("crop-stage");
const cropState = async (page: Page) => {
  const [x, y, zoom, turns] = ((await crop(page).getAttribute("data-crop")) ?? "").split(",").map(Number);
  return { x: x!, y: y!, zoom: zoom!, turns: turns! };
};
// L'image d'un avatar est chargée : son adresse est celle du stockage, et le navigateur l'a décodée.
const expectLoaded = async (image: ReturnType<Page["locator"]>) => {
  await expect(image).toHaveAttribute("src", BLOB_HOST);
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0);
};

// Le « + » posé sur le bord du portrait ouvre le menu ; « Choisir un avatar » ouvre la galerie.
const openGallery = async (page: Page) => {
  await page.getByRole("button", { name: t.avatar.change }).click();
  await page.getByRole("menuitem", { name: t.avatar.choose }).click();
};

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "largeurs explicites et contexte tactile : un seul projet suffit");
});

test("une photo recadrée au clavier s'affiche partout ; un avatar animal, puis les initiales ; le logo", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize(PHONE);
  await serveBlobs(page);
  await createCoachSpace(page, "Avatar");
  const link = await groupLink(page);

  // L'athlète, sur son téléphone : elle envoie sa photo et la recadre.
  const athlete = await joinAsAthlete(browser, link, "Lison");
  const phone = athlete.page;
  await serveBlobs(phone);
  await phone.goto("/reglages/profil", { waitUntil: "networkidle" });
  await expect(phone.getByRole("img", { name: t.alt.initials("Lison Test") })).toBeVisible();
  await expectAccessible(phone);

  await phone.getByLabel(t.avatar.upload, { exact: true }).setInputFiles(await landscapePhoto(phone));
  const dialog = phone.getByRole("dialog", { name: t.crop.title });
  await expect(dialog).toBeVisible();
  await expect(crop(phone)).toHaveAttribute("data-crop", "0,0,100,0");
  await expectNoHorizontalScroll(phone);
  await expectAccessible(phone);

  // Au clavier : la photo en paysage se déplace de côté, jamais au point de laisser un vide.
  await crop(phone).focus();
  await phone.keyboard.press("ArrowLeft");
  await phone.keyboard.press("ArrowLeft");
  expect(await cropState(phone)).toMatchObject({ x: -16, y: 0 });
  await phone.keyboard.press("ArrowUp");
  expect((await cropState(phone)).y).toBe(0);
  await phone.keyboard.press("+");
  await phone.keyboard.press("+");
  expect((await cropState(phone)).zoom).toBe(120);
  // Le zoom, au curseur.
  await dialog.getByRole("slider", { name: t.crop.zoom }).fill("150");
  expect((await cropState(phone)).zoom).toBe(150);
  // Un quart de tour à droite : le même point de l'image reste au centre.
  const before = await cropState(phone);
  await dialog.getByRole("button", { name: t.crop.rotateRight }).click();
  expect(before).toMatchObject({ x: -24, y: 0 });
  expect(await cropState(phone)).toMatchObject({ x: 0, y: before.x, turns: 1 });
  await expect(phone.locator("#crop-status")).toHaveText(t.crop.status(150, 1));
  await dialog.getByRole("button", { name: t.crop.save }).click();
  await expect(phone.getByText(t.avatar.photoSaved)).toBeVisible();
  await expect(dialog).toBeHidden();

  // La photo dans la rubrique, puis dans l'en-tête de chaque écran.
  const photo = phone.getByRole("img", { name: t.alt.photo("Lison Test") });
  await expectLoaded(photo);
  const photoUrl = (await photo.getAttribute("src"))!;
  await expectLoaded(phone.getByTestId("account-menu").locator("img"));
  await phone.goto("/aujourdhui", { waitUntil: "networkidle" });
  await expect(phone.getByTestId("account-menu").locator("img")).toHaveAttribute("src", photoUrl);
  // Ce que le serveur a gardé : un carré de 512 pixels en WebP, jamais le fichier d'origine.
  const stored = await phone.request.fetch(
    `http://127.0.0.1:${BLOB_PORT}/files/${new URL(photoUrl).pathname.slice(1)}`,
  );
  expect(stored.headers()["content-type"]).toBe("image/webp");
  const size = await phone.evaluate(async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  }, photoUrl);
  expect(size).toEqual([512, 512]);

  // Le coach la voit dans son suivi, une fois une séance publiée pour le groupe.
  await page.setViewportSize(DESKTOP);
  await publishSession(page, "Séance du jour", "Accélérations");
  await page.goto("/suivi", { waitUntil: "networkidle" });
  const row = page.getByRole("row").filter({ hasText: "Lison Test" });
  await expect(row.locator("img")).toHaveAttribute("src", photoUrl);

  // Le coach choisit un animal. Sur téléphone, la galerie tient en une colonne de quatre.
  await page.setViewportSize(PHONE);
  await page.goto("/reglages/profil", { waitUntil: "networkidle" });
  await openGallery(page);
  const gallery = page.getByRole("dialog", { name: t.gallery.title });
  await expect(gallery.getByRole("group", { name: t.gallery.animals }).getByRole("radio")).toHaveCount(12);
  await expect(gallery.getByRole("group", { name: t.gallery.group }).getByRole("radio")).toHaveCount(6);
  // On touche la vignette, comme au doigt : le bouton radio qu'elle porte se coche.
  await gallery.locator("label").filter({ hasText: t.gallery.animal.fox }).click();
  await expect(gallery.getByRole("radio", { name: t.gallery.animal.fox })).toBeChecked();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
  await gallery.getByRole("button", { name: t.gallery.save }).click();
  await expect(page.getByText(t.avatar.presetSaved)).toBeVisible();
  await expect(page.getByRole("img", { name: t.alt.preset("Avatar Coach", t.gallery.animal.fox) })).toBeVisible();
  await expect(page.getByTestId("account-menu").locator('svg[viewBox="0 0 100 100"]')).toBeVisible();

  // Sur l'invitation, le coach qui invite se reconnaît à son avatar.
  await page.goto(new URL(link).pathname, { waitUntil: "networkidle" });
  await expect(page.getByText("Avatar Coach", { exact: true })).toBeVisible();
  await expect(page.locator("main p").filter({ hasText: "Avatar Coach" }).locator("svg")).toHaveCount(1);

  // Retour aux initiales par la poubelle : l'aperçu change tout de suite, le serveur après cinq secondes.
  await page.goto("/reglages/profil", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: t.avatar.removePreset }).click();
  await expect(page.getByText(t.avatar.presetRemoved)).toBeVisible();
  await expect(page.getByRole("button", { name: t.avatar.undo })).toBeFocused();
  await expect(page.getByRole("img", { name: t.alt.initials("Avatar Coach") })).toHaveAttribute("data-initials", "AC");
  await expect(page.getByText(t.avatar.initialsSaved)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: t.avatar.undo })).toHaveCount(0);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("img", { name: t.alt.initials("Avatar Coach") })).toBeVisible();
  await expect(page.getByRole("button", { name: t.avatar.removePreset })).toHaveCount(0);

  // L'athlète touche sa photo pour la recadrer, puis renonce.
  await phone.goto("/reglages/profil", { waitUntil: "networkidle" });
  await phone.getByRole("button", { name: t.avatar.recrop }).click();
  await expect(phone.getByRole("dialog", { name: t.crop.title })).toBeVisible();
  await phone.getByRole("button", { name: t.crop.cancel }).click();
  // Elle supprime sa photo puis se ravise : rien n'est parti, la photo reste.
  await phone.getByRole("button", { name: t.avatar.removePhoto }).click();
  await expect(phone.getByText(t.avatar.photoRemoved)).toBeVisible();
  await expect(phone.getByRole("img", { name: t.alt.initials("Lison Test") })).toBeVisible();
  await phone.getByRole("button", { name: t.avatar.undo }).click();
  await expect(phone.getByRole("button", { name: t.avatar.removePhoto })).toBeFocused();
  await expectLoaded(phone.getByRole("img", { name: t.alt.photo("Lison Test") }));
  await phone.waitForTimeout(6000);
  await phone.reload({ waitUntil: "networkidle" });
  await expectLoaded(phone.getByRole("img", { name: t.alt.photo("Lison Test") }));
  expect(await sqlQuery("SELECT 1 FROM external_deletions WHERE external_ref = $1", [photoUrl])).toEqual([]);

  // L'athlète passe de sa photo à un animal : l'ancienne photo part en file de suppression.
  await openGallery(phone);
  await phone
    .getByRole("dialog", { name: t.gallery.title })
    .locator("label")
    .filter({ hasText: t.gallery.animal.owl })
    .click();
  await phone.getByRole("button", { name: t.gallery.save }).click();
  await expect(phone.getByRole("img", { name: t.alt.preset("Lison Test", t.gallery.animal.owl) })).toBeVisible();
  const queued = await sqlQuery<{ provider: string }>(
    "SELECT provider FROM external_deletions WHERE external_ref = $1",
    [photoUrl],
  );
  expect(queued).toEqual([{ provider: "blob" }]);

  // En mouvement réduit, le recadrage et la galerie s'ouvrent sans rien animer.
  await phone.emulateMedia({ reducedMotion: "reduce" });
  await phone.reload({ waitUntil: "networkidle" });
  await phone.getByLabel(t.avatar.upload, { exact: true }).setInputFiles(await landscapePhoto(phone));
  await expect(phone.getByRole("dialog", { name: t.crop.title })).toBeVisible();
  await expectNoMotion(phone);
  await phone.getByRole("button", { name: t.crop.cancel }).click();
  await openGallery(phone);
  await expect(phone.getByRole("dialog", { name: t.gallery.title })).toBeVisible();
  await expectNoMotion(phone);
  await athlete.context.close();

  // Le logo de l'espace passe par le même recadrage, dans un carré.
  await page.goto("/reglages/espace", { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').setInputFiles(await landscapePhoto(page));
  const logoDialog = page.getByRole("dialog", { name: t.crop.titleLogo });
  await expect(logoDialog).toBeVisible();
  await logoDialog.getByRole("button", { name: t.crop.saveLogo }).click();
  await expect(page.getByText(t.logo.saved)).toBeVisible();
  await expectLoaded(page.getByRole("img", { name: w.settings.espace.logoAlt("Coaching Avatar") }));
  await expect(page.getByRole("button", { name: t.logo.replace })).toBeVisible();
  await expect(page.getByRole("heading", { name: m.settings.logo })).toBeVisible();
});

test("le portrait mobile renvoie la photo détourée après confirmation", async ({ page }) => {
  await page.addInitScript(() => {
    const portraitMessages: { kind: string; image?: string }[] = [];
    Object.assign(window, {
      portraitMessages,
      ReactNativeWebView: { postMessage: (raw: string) => portraitMessages.push(JSON.parse(raw)) },
    });
  });
  await page.goto("/mobile/portrait");
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "portraitMessages").length)).toBe(1);
  await page.evaluate(async () => {
    const img = await createImageBitmap(await (await fetch("/exercise-photos/seated-dumbbell-press-v1.webp")).blob());
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    window.dispatchEvent(new MessageEvent("message", { data: canvas.toDataURL("image/jpeg") }));
  });
  const dialog = page.getByRole("dialog", { name: t.crop.title });
  await dialog.getByLabel(t.crop.background).selectOption({ label: t.crop.track });
  await expect(dialog.getByRole("button", { name: t.crop.save, exact: true })).toBeEnabled({ timeout: 45000 });
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: t.crop.save, exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "portraitMessages").at(-1)?.kind)).toBe("save");
});
