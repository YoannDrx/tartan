import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { groupLink, joinAsAthlete, publishSession } from "./journeys";

test("une validation en conflit reste sur l'appareil après rechargement et n'est pas rejouée automatiquement", async ({
  page,
  browser,
}, info) => {
  await createCoachSpace(page, "Conflits");
  const link = await groupLink(page);
  const { page: athlete, context } = await joinAsAthlete(browser, link, "Lea");
  try {
    await athlete.setViewportSize({ width: info.project.name === "desktop" ? 1440 : 390, height: 844 });
    await publishSession(page, "Séance conservée", "Accélérations");
    const sessionId = /\/seances\/([^/]+)/.exec(page.url())?.[1];
    let writes = 0;
    await context.route(`**/sessions/${sessionId}/log`, async (route) => {
      writes += 1;
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ message: "Version modifiée" }),
      });
    });
    await athlete.goto(`/seance/${sessionId}`, { waitUntil: "networkidle" });
    await athlete.getByRole("button", { name: "J'ai fait la séance", exact: true }).click();
    await expect(athlete.getByText(m.offline.needsReview, { exact: true })).toBeVisible();
    await expect(athlete.getByText(m.offline.reviewPending(1), { exact: true })).toBeVisible();
    expect(writes).toBe(1);
    await athlete.reload({ waitUntil: "networkidle" });
    await expect(athlete.getByText(m.offline.reviewPending(1), { exact: true })).toBeVisible();
    await expect(athlete.getByText(m.validation.waitingSend)).toHaveCount(0);
    await athlete.getByRole("button", { name: "J'ai fait la séance", exact: true }).click();
    await expect(athlete.getByText(m.offline.needsReview, { exact: true })).toBeVisible();
    expect(writes).toBe(1);
    await expect(athlete.getByText(m.offline.reviewPending(1), { exact: true })).toBeVisible();
    await expectAccessible(athlete);
    await expectNoHorizontalScroll(athlete);
    await athlete.screenshot({ path: `/tmp/tartan-offline-conflicts-${info.project.name}.png`, fullPage: true });
  } finally {
    await context.close();
  }
});
