import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { today } from "./journeys";

test("le coach passe de la liste au mois complet et retrouve son choix", async ({ page }, info) => {
  await page.setViewportSize({ width: info.project.name === "desktop" ? 1440 : 390, height: 900 });
  await createCoachSpace(page, "Vues");
  const me = await (await page.request.get("/api/v1/me")).json();
  const root = `/api/v1/orgs/${me.spaces[0].organizationId}`;
  const groups = await (await page.request.get(`${root}/groups`)).json();
  const exercises = await (await page.request.get(`${root}/exercises`)).json();
  const exercise = exercises.find((item: { category: string }) => item.category === "strength");
  const created = await page.request.post(`${root}/sessions`, {
    data: {
      date: today(),
      startTime: "18:00",
      location: "Stade",
      publishAt: null,
      assignments: [{ targetType: "group", targetId: groups[0].id }],
      overrides: [],
      draft: {
        title: "Force bas du corps",
        type: "strength",
        durationMin: 60,
        coachNote: null,
        blocks: [
          { name: "Corps", variant: "club", items: [{ exerciseId: exercise.id, prescription: { sets: 4, reps: 5 } }] },
        ],
      },
    },
  });
  expect(created.ok()).toBe(true);

  const month = today().slice(0, 7);
  await page.goto(`/calendrier?vue=mois&mois=${month}`, { waitUntil: "networkidle" });
  await expect(
    page
      .getByRole("link", { name: /Force bas du corps/ })
      .locator("visible=true")
      .first(),
  ).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);

  const saved = page.waitForResponse((res) => res.request().method() === "POST" && res.url().includes("/calendrier"));
  await page.getByRole("link", { name: m.calendar.list, exact: true }).click();
  await saved;
  await expect(page).toHaveURL(/vue=liste/);
  await expect(page.getByText("Force bas du corps").locator("visible=true").first()).toBeVisible();

  await page.goto("/calendrier", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: m.calendar.list, exact: true })).toHaveAttribute("aria-current", "true");
  await expectNoHorizontalScroll(page);
});
