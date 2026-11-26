import { expect, type Locator, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";

const voice = m.sessionVoice;

export async function record(page: Page, section: Locator) {
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
  await expect(section.getByRole("button", { name: `${m.sessionThread.play} · ${voice.preview}` })).toBeVisible();
}

export async function listen(player: Page | Locator, label: string) {
  await player.getByRole("button", { name: `${m.sessionThread.play} · ${label}`, exact: true }).click();
  await expect(player.getByRole("button", { name: `${m.sessionThread.pause} · ${label}`, exact: true })).toBeVisible();
}
