import { record, listen } from "./session-voice-recording";
import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { addFromLibrary, createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { groupLink, joinAsAthlete, today } from "./journeys";

const voice = m.sessionVoice;
test.use({ launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });

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
    await listen(athlete.page, voice.instruction);
    const exchange = athlete.page.getByRole("button", { name: m.sessionThread.exercise, exact: true });
    await exchange.click();
    await expect(athlete.page.getByLabel(m.sessionThread.write)).toBeVisible();
    await expect(athlete.page.getByRole("button", { name: m.sessionThread.transcribe })).toHaveCount(0);
    await exchange.click();
    await athlete.page.getByRole("button", { name: m.today.quickDone, exact: true }).click();
    const dialog = athlete.page.getByRole("dialog");
    const debrief = dialog.getByRole("group", { name: voice.debrief });
    await record(athlete.page, debrief);
    await expect(dialog.getByRole("button", { name: m.validation.finish, exact: true })).toBeDisabled();
    await debrief.getByRole("button", { name: voice.send }).click();
    await expect(debrief.getByText(voice.sent)).toBeVisible();
    await dialog.getByRole("button", { name: m.sessionThread.debrief, exact: true }).click();
    await dialog.getByRole("button", { name: m.sessionThread.transcribe, exact: true }).click();
    await expect(dialog.getByRole("button", { name: m.sessionThread.authorizeTranscription })).toBeDisabled();
    await dialog.getByRole("button", { name: m.common.cancel, exact: true }).click();
    await dialog.getByRole("button", { name: m.validation.finish, exact: true }).click();
    await expect(athlete.page).toHaveURL(/\/aujourdhui$/);
    await page.goto(`/seances/${id}/suivi`);
    await listen(page, voice.debrief);
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);

    await athlete.page.goto(`/seance/${id}`);
    await athlete.page.getByRole("button", { name: voice.remove, exact: true }).click();
    await expect(athlete.page.getByText(voice.removed)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: `${m.sessionThread.play} · ${voice.debrief}` })).toHaveCount(0);
  } finally {
    await athlete.context.close();
  }
});
