import { expect, test, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import { ATHLETE_IDS } from "@tartan/mascot/athletes";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll, expectNoMotion } from "./helpers";

const board = m.admin.mascot;
const HURDLES = m.group.events.hurdles;

const openBoard = async (page: Page, project: string) => {
  await createCoachSpace(page, "Mascotte", `mascotte-${project}@e2e.tartan.test`);
  await page.goto("/admin/mascotte", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: m.admin.nav.mascot, exact: true })).toBeVisible();
};

// La scène affichée : celle du téléphone, cadrée sur l'athlète, ou la scène entière au-delà.
const scene = (page: Page) => page.locator('[data-gesture="hurdles"]:visible');
const slider = (page: Page) => page.getByRole("slider", { name: board.scrub(HURDLES), exact: true });
const setTime = (page: Page, value: number) =>
  slider(page).evaluate((input: HTMLInputElement, next) => {
    // Le champ est contrôlé par React : on passe par le mutateur natif, puis on prévient React.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, String(next));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

// Un seul compte administrateur par écran : tout le parcours de la planche tient dans un test.
test("la planche présente le groupe, ses gestes et les motifs, et se relit sans mouvement", async ({ page }, info) => {
  test.setTimeout(240_000);
  await openBoard(page, info.project.name);

  // Les six athlètes, nommés, puis alignés sur chacun des trois fonds.
  for (const id of ATHLETE_IDS) {
    await expect(page.getByText(m.group.athletes[id], { exact: true }).first()).toBeVisible();
  }
  for (const surface of ["piste", "ink", "chalk"] as const) {
    const lineUp = page.getByRole("img", { name: board.surfaceLabel(board.surfaces[surface]), exact: true });
    await expect(lineUp).toBeVisible();
    await expect(lineUp.locator("[data-athlete]")).toHaveCount(ATHLETE_IDS.length);
  }
  for (const face of ["neutral", "effort", "joy"] as const) {
    await expect(page.getByRole("img", { name: board.facesLabel(m.group.faces[face]), exact: true })).toBeVisible();
  }

  // Chaque geste a sa scène, une seule visible à la fois, et s'ouvre sur son image la plus parlante.
  for (const id of ATHLETE_IDS) {
    await expect(page.locator(`[data-gesture="${id}"]:visible`)).toHaveCount(1);
  }
  await expect(scene(page)).toHaveAttribute(
    "aria-label",
    m.group.gesture(m.group.athletes.hurdles, HURDLES, m.group.phases.clearance),
  );

  // Les motifs de la piste : la progression se dit en toutes lettres.
  await expect(page.getByRole("progressbar", { name: board.lapLabel(2, 5), exact: true }).first()).toHaveAttribute(
    "aria-valuenow",
    "40",
  );

  await expectNoHorizontalScroll(page);
  await expectAccessible(page);

  // Le curseur mène du départ à la réussite : le libellé de la scène suit.
  await setTime(page, 0);
  await expect(slider(page)).toHaveAttribute("aria-valuetext", m.group.phases.ready);
  const still = await scene(page).innerHTML();
  await setTime(page, 1);
  await expect(slider(page)).toHaveAttribute("aria-valuetext", m.group.phases.celebrate);
  await expect(scene(page)).toHaveAttribute(
    "aria-label",
    m.group.gesture(m.group.athletes.hurdles, HURDLES, m.group.phases.celebrate),
  );
  expect(await scene(page).innerHTML()).not.toBe(still);

  // Rien ne joue sans qu'on le demande.
  await setTime(page, 0.2);
  const before = await slider(page).inputValue();
  await page.waitForTimeout(400);
  expect(await slider(page).inputValue()).toBe(before);

  await page.getByRole("button", { name: board.playLabel(HURDLES), exact: true }).click();
  const pause = page.getByRole("button", { name: board.pauseLabel(HURDLES), exact: true });
  await expect(pause).toBeVisible();
  await expect.poll(async () => Number(await slider(page).inputValue())).toBeGreaterThan(Number(before) + 0.05);
  await pause.click();
  const stopped = await slider(page).inputValue();
  await page.waitForTimeout(400);
  expect(await slider(page).inputValue()).toBe(stopped);

  // En mouvement réduit : plus de lecture, le curseur reste.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: board.playLabel(HURDLES), exact: true })).toHaveCount(0);
  await expect(page.getByText(board.reducedMotion, { exact: true })).toHaveCount(ATHLETE_IDS.length);
  await expectNoMotion(page);
  await setTime(page, 1);
  await expect(slider(page)).toHaveAttribute("aria-valuetext", m.group.phases.celebrate);
});

test("un coach ordinaire ne voit pas la planche", async ({ page }) => {
  await createCoachSpace(page, "Hors planche");
  await page.goto("/admin/mascotte");
  await expect(page).toHaveURL(/\/(accueil|suivi|aujourdhui)/);
});
