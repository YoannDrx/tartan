import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { createExercise, groupLink, joinAsAthlete, publishSession } from "./journeys";

// L'athlète dit qu'il ne viendra pas, puis pourquoi ; le coach l'apprend par une notification et le lit dans le suivi.
test("une absence signalée par l'athlète arrive au coach, avec son motif dans le suivi", async ({ page, browser }, info) => {
  test.setTimeout(180_000);
  await createCoachSpace(page, `Absence${info.project.name === "desktop" ? "Bureau" : "Mobile"}`);
  const link = await groupLink(page);
  const athlete = await joinAsAthlete(browser, link, "Nora");
  try {
    await createExercise(page, "Fentes absence");
    await publishSession(page, "Séance absence", "Fentes absence");
    const followup = page.url();

    await athlete.page.goto("/aujourdhui", { waitUntil: "networkidle" });
    await athlete.page.getByRole("button", { name: m.today.notComing, exact: true }).click();
    const reasons = athlete.page.getByRole("group", { name: m.today.absenceReasonLegend });
    await expect(reasons).toBeVisible();
    await expectNoHorizontalScroll(athlete.page);
    await expectAccessible(athlete.page);
    await reasons.getByRole("button", { name: m.today.absenceReasons.transport, exact: true }).click();
    await expect(reasons.getByRole("button", { name: m.today.absenceReasons.transport, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(athlete.page.getByText(m.today.absenceReasonSaved)).toBeVisible();

    await page.goto("/notifications", { waitUntil: "networkidle" });
    await expect(page.getByText(/Nora ne viendra pas/)).toHaveCount(1);
    await page.goto(followup.includes("/suivi") ? followup : `${followup.replace(/\/$/, "")}/suivi`);
    await expect(page.getByText(m.coach.absentBecause(m.today.absenceReasons.transport))).toBeVisible();
  } finally {
    await athlete.context.close();
  }
});
