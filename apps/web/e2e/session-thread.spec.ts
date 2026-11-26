import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll, expectNoMotion, sqlQuery } from "./helpers";
import { groupLink, joinAsAthlete, publishSession } from "./journeys";
import { record, listen } from "./session-voice-recording";

const t = m.sessionThread;
test.use({ launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });

test("l’athlète et son coach se répondent dans deux fils privés, avec transcription à la demande", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120_000);
  await createCoachSpace(page, "Échanges privés");
  const athlete = await joinAsAthlete(browser, await groupLink(page), "Lina");
  const width = info.project.name === "desktop" ? 1440 : 390;
  try {
    await page.setViewportSize({ width, height: 900 });
    await athlete.page.setViewportSize({ width, height: 900 });
    await athlete.page.emulateMedia({ reducedMotion: "reduce" });
    await publishSession(page, "Échanges sur la séance", "Goblet squat");
    const path = new URL(page.url()).pathname;
    const id = path.match(/\/seances\/([\da-f-]{36})/)?.[1];
    expect(id).toBeTruthy();
    const athletePage = athlete.page;
    await athletePage.goto(`/seance/${id}/mode`);
    await athletePage.getByRole("button", { name: t.exercise, exact: true }).click();
    const question = "Je garde les pieds à cette largeur ?";
    await athletePage.getByLabel(t.write, { exact: true }).fill(question);
    await athletePage.getByRole("button", { name: t.send, exact: true }).click();
    await expect(athletePage.getByText(question, { exact: true })).toBeVisible();
    const athleteRecording = athletePage.getByRole("group", { name: t.attachAudio, exact: true });
    await record(athletePage, athleteRecording);
    await athleteRecording.getByRole("button", { name: t.sendAudio, exact: true }).click();
    await expect(athletePage.getByText(t.sent, { exact: true })).toBeVisible();
    await page.getByRole("link", { name: `${t.coachThreads} · Lina Test`, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/seances/${id}/athletes/[a-f0-9-]{36}/echanges`));
    await expect(page.getByRole("heading", { name: t.coachThreads })).toBeVisible();
    await page.getByRole("button", { name: t.exercise, exact: true }).click();
    await expect(page.getByText(question, { exact: true })).toBeVisible();
    await listen(page, t.voiceReply);
    await expect(page.getByRole("button", { name: t.transcribe, exact: true })).toHaveCount(0);
    const response = "Oui, reprends le même placement au deuxième passage.";
    await page.getByLabel(t.write, { exact: true }).fill(response);
    await page.getByRole("button", { name: t.send, exact: true }).click();
    await expect(page.getByText(response, { exact: true })).toBeVisible();
    const coachRecording = page.getByRole("group", { name: t.attachAudio, exact: true });
    await record(page, coachRecording);
    await coachRecording.getByRole("button", { name: t.sendAudio, exact: true }).click();
    await expect(page.getByText(t.sent, { exact: true })).toBeVisible();

    const transcript = "Garde le même placement.";
    let transcriptions = 0;
    await page.route("**/thread/*/transcript?*", async (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({
        consent: true,
        version: expect.stringMatching(/^[\da-f-]{36}$/),
      });
      // Le résultat synthétique devient lisible par l’autre compte via la vraie route du fil.
      const replyId = new URL(route.request().url()).pathname.split("/").at(-2);
      const changed = await sqlQuery<{ id: string }>(
        "UPDATE session_thread_messages SET transcript=$1 WHERE id=$2 AND scheduled_session_id=$3 AND bytes IS NOT NULL RETURNING id",
        [transcript, replyId, id],
      );
      expect(changed).toHaveLength(1);
      transcriptions++;
      await route.fulfill({ json: { transcript } });
    });
    await page.getByRole("button", { name: t.transcribe, exact: true }).click();
    const authorize = page.getByRole("button", { name: t.authorizeTranscription, exact: true });
    await expect(authorize).toBeDisabled();
    expect(transcriptions).toBe(0);
    await page.getByRole("checkbox", { name: t.agreeTranscription, exact: true }).check();
    await authorize.click();
    await expect(page.getByText(transcript, { exact: true })).toBeVisible();
    expect(transcriptions).toBe(1);
    await page.getByRole("button", { name: t.hideTranscript, exact: true }).click();
    await expect(page.getByText(transcript, { exact: true })).toBeHidden();
    await page.getByRole("button", { name: t.showTranscript, exact: true }).click();
    expect(transcriptions).toBe(1);
    for (const viewport of width === 1440 ? [768, 1440] : [390]) {
      await page.setViewportSize({ width: viewport, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expectAccessible(page);
      await expectNoHorizontalScroll(page);
      await expectNoMotion(page);
      if (process.env.TARTAN_THREAD_CAPTURES)
        await page.screenshot({ path: `/tmp/tartan-session-thread-${viewport}.png`, fullPage: true });
    }
    await athletePage.goto(`/seance/${id}`);
    await athletePage.getByRole("button", { name: t.exercise, exact: true }).click();
    await expect(athletePage.getByText(response, { exact: true })).toBeVisible();
    await athletePage.getByRole("button", { name: t.showTranscript, exact: true }).click();
    await expect(athletePage.getByText(transcript, { exact: true })).toBeVisible();
    await expect(athletePage.getByRole("checkbox", { name: t.agreeTranscription })).toHaveCount(0);
    await athletePage.getByRole("button", { name: m.today.quickDone, exact: true }).click();
    const dialog = athletePage.getByRole("dialog");
    await dialog.getByRole("button", { name: t.debrief, exact: true }).click();
    const debrief = "Merci, j’ai pu faire toute la séance.";
    await dialog.getByLabel(t.write, { exact: true }).fill(debrief);
    await dialog.getByRole("button", { name: t.send, exact: true }).click();
    await expect(dialog.getByText(debrief, { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: m.validation.finish, exact: true }).click();
    await expect(athletePage).toHaveURL(/\/aujourdhui$/);
    await page.reload();
    await page.getByRole("button", { name: t.debrief, exact: true }).click();
    await expect(page.getByText(debrief, { exact: true })).toBeVisible();
    await expect(page.getByText(question, { exact: true })).toHaveCount(0);
  } finally {
    await athlete.context.close();
  }
});
