import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { createExercise, groupLink, joinAsAthlete, publishSession } from "./journeys";

// La série de régularité : la séance rendue lance la série chez l'athlète, et le coach la lit sur sa fiche.
test("une séance rendue lance la série de régularité, que le coach lit sur la fiche", async ({ page, browser }, info) => {
  test.setTimeout(180_000);
  await createCoachSpace(page, `Serie${info.project.name === "desktop" ? "Bureau" : "Mobile"}`);
  const link = await groupLink(page);
  const athlete = await joinAsAthlete(browser, link, "Yanis");
  try {
    await createExercise(page, "Gainage série");
    await publishSession(page, "Séance série", "Gainage série");

    await athlete.page.goto("/aujourdhui", { waitUntil: "networkidle" });
    const streak = athlete.page.getByRole("region", { name: m.today.regularity.title });
    await expect(streak).toContainText(m.today.regularity.weeks(0));
    await expect(streak.getByRole("progressbar", { name: m.today.regularity.lap(0, 1) })).toBeVisible();

    await athlete.page.getByRole("button", { name: m.today.quickDone, exact: true }).first().click();
    // La séance est enregistrée quand le dialogue des précisions s'ouvre.
    const dialog = athlete.page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: m.validation.finish, exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await athlete.page.reload({ waitUntil: "networkidle" });
    await expect(streak).toContainText(`1 ${m.today.regularity.weeks(1)}`);
    await expect(streak.getByRole("progressbar", { name: m.today.regularity.lap(1, 1) })).toBeVisible();
    await expectNoHorizontalScroll(athlete.page);
    await expectAccessible(athlete.page);

    await page.goto("/athletes", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /Yanis/ }).first().click();
    await expect(page.getByText(m.athletes.streak, { exact: true })).toBeVisible();
    await expect(page.getByText(m.athletes.streakWeeks(1), { exact: true })).toBeVisible();
  } finally {
    await athlete.context.close();
  }
});
