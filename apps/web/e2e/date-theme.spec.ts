import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

test("la date se lit en JJ/MM/AAAA, se choisit au calendrier et le thème sombre s'applique", async ({ page }) => {
  test.setTimeout(90_000);
  await createCoachSpace(page, "Datation");
  await page.goto("/seances/nouvelle", { waitUntil: "networkidle" });
  const date = page.getByLabel(m.builder.date, { exact: true });
  await expect(date).toHaveValue(/^\d{2}\/\d{2}\/\d{4}$/);

  await date.fill("15032031");
  await expect(date).toHaveValue("15/03/2031");
  await page.getByRole("button", { name: m.datePicker.open }).first().click();
  const calendar = page.getByRole("dialog", { name: m.datePicker.open });
  await expect(calendar.getByText("Mars 2031")).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press("ArrowRight");
  await expect(calendar.locator('[data-day="2031-03-16"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(calendar).toBeHidden();
  await expect(date).toHaveValue("16/03/2031");

  await page.goto("/reglages", { waitUntil: "networkidle" });
  await page.getByText(m.appearance.dark, { exact: true }).click();
  await page.goto("/calendrier", { waitUntil: "networkidle" });
  expect(
    await page
      .locator(".world-work")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(21, 22, 26)");
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
});
