import { expect, test, type Locator, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import { addFromLibrary, createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { groupLink, joinAsAthlete, today } from "./journeys";

const voice = m.sessionVoice;
test.use({ launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });

async function record(page: Page, section: Locator) {
  // Attendre le premier fragment du vrai MediaRecorder, y compris sur un navigateur lent.
  await page.evaluate(() => {
    const original = MediaRecorder.prototype.start;
    MediaRecorder.prototype.start = function (...args) {
      document.documentElement.removeAttribute("data-audio-captured");
      this.addEventListener("dataavailable", (event) => {
        if (event.data.size) document.documentElement.setAttribute("data-audio-captured", "");
      });
      MediaRecorder.prototype.start = original;
      return original.apply(this, args);
    };
  });
  await section.getByRole("button", { name: voice.record, exact: true }).click();
  await expect(section.getByText(voice.recording)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-audio-captured", "");
  await section.getByRole("button", { name: voice.stop, exact: true }).click();
  await expect(section.getByLabel(voice.preview)).toBeVisible();
}

async function listen(player: Locator) {
  await player.evaluate(async (audio: HTMLAudioElement) => {
    await audio.play();
  });
  await expect.poll(() => player.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0);
}

test("le coach dicte la consigne de l’exercice et écoute le débrief envoyé après la séance", async ({
  page,
  browser,
}, info) => {
  await createCoachSpace(page, "Vocaux");
  const athlete = await joinAsAthlete(browser, await groupLink(page), "Camille");
  try {
    await page.setViewportSize({ width: info.project.name === "desktop" ? 1440 : 390, height: 900 });
    await page.goto(`/seances/nouvelle?date=${today()}`, { waitUntil: "networkidle" });
    await page
      .getByLabel(m.builder.titleLabel, { exact: true })
      .locator("visible=true")
      .fill("Séance avec consigne vocale");
    await addFromLibrary(page, "Squat arrière");
    const body = page.getByRole("region", { name: m.builder.body, exact: true });
    await body.getByRole("button", { name: /^Squat arrière/ }).click();
    const editor = page.getByRole("dialog");
    const instruction = editor.getByRole("group", { name: voice.instruction });
    await editor.getByLabel(m.builder.strides, { exact: true }).fill("8");
    await editor.getByLabel(m.builder.coneSpacing, { exact: true }).fill("4.5");
    await record(page, instruction);
    await instruction.getByRole("button", { name: voice.attach }).click();
    await expect(instruction.getByText(voice.attached)).toBeVisible();
    await editor.getByRole("button", { name: m.common.close, exact: true }).last().click();
    await page.getByRole("tab", { name: "En autonomie" }).click();
    await page.getByRole("button", { name: "Générer depuis la version club" }).click();
    await page.getByRole("tab", { name: "Au club" }).click();
    await page.getByRole("button", { name: "Publier", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Séance avec consigne vocale" })).toBeVisible();
    const id = new URL(page.url()).pathname.match(/\/seances\/([\da-f-]{36})/)?.[1];
    expect(id).toBeTruthy();
    await athlete.page.goto(`/seance/${id}`);
    await expect(athlete.page.getByText(/8 foulées · 4,5 pieds entre deux plots/)).toBeVisible();
    await listen(athlete.page.getByLabel(voice.instruction, { exact: true }));
    await athlete.page.getByRole("button", { name: m.today.quickDone, exact: true }).click();
    const dialog = athlete.page.getByRole("dialog");
    const debrief = dialog.getByRole("group", { name: voice.debrief });
    await record(athlete.page, debrief);
    await expect(dialog.getByRole("button", { name: m.validation.finish, exact: true })).toBeDisabled();
    await debrief.getByRole("button", { name: voice.send }).click();
    await expect(debrief.getByText(voice.sent)).toBeVisible();
    await dialog.getByRole("button", { name: m.validation.finish, exact: true }).click();
    await expect(athlete.page).toHaveURL(/\/aujourdhui$/);
    await page.goto(`/seances/${id}/suivi`);
    await listen(page.getByLabel(voice.debrief, { exact: true }));
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);

    await athlete.page.goto(`/seance/${id}`);
    await athlete.page.getByRole("button", { name: voice.remove, exact: true }).click();
    await expect(athlete.page.getByText(voice.removed)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(voice.debrief, { exact: true })).toHaveCount(0);
  } finally {
    await athlete.context.close();
  }
});
