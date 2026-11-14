import { expect, test, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import type { ExerciseSummary } from "@tartan/contracts";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { groupLink, joinAsAthlete, today } from "./journeys";

test("catalogue : recherche, guide figé et consultation de la séance attribuée", async ({ page, browser }, info) => {
  test.setTimeout(240_000);
  const inspect = async (target: Page, screen: string) => {
    await target.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [390, 768, 1440]) {
      await target.setViewportSize({ width, height: 900 });
      for (const theme of ["tartan", "light", "dark"]) {
        await target.evaluate(
          (value) => document.querySelector("[data-theme]")?.setAttribute("data-theme", value),
          theme,
        );
        await expectNoHorizontalScroll(target);
        await expectAccessible(target);
        if (info.project.name === "desktop")
          await target.screenshot({ path: `/tmp/tartan-guide-${screen}-${theme}-${width}.png`, fullPage: true });
      }
    }
  };
  await createCoachSpace(page, "Guides");
  const me = await (await page.request.get("/api/v1/me")).json();
  const root = `/api/v1/orgs/${me.spaces[0].organizationId}`;
  const library: ExerciseSummary[] = await (await page.request.get(`${root}/exercises`)).json();
  expect(library.filter((e) => e.guide)).toHaveLength(150);
  expect(library.filter((e) => e.guide).every((e) => e.guide?.technicalReview === "approved")).toBe(true);
  const snatch = library.find((e) => e.name === "Arraché")!;
  await page.goto("/exercices", { waitUntil: "networkidle" });
  await page.getByLabel(m.exerciseGuide.family, { exact: true }).selectOption("weightlifting");
  await page.getByLabel(m.exercises.search, { exact: true }).fill("Squat snatch");
  await page.getByRole("button", { name: /^Arraché Bibliothèque/ }).click();
  await expect(page.getByRole("dialog").getByText(m.exerciseGuide.approved)).toBeVisible();
  await expect(page.getByRole("dialog").getByText(snatch.guide!.loadExplanation)).toBeVisible();
  // Le geste animé tourne ; une pastille l'arrête sur la ligne choisie du guide, affichée sous l'image.
  const motion = m.exerciseGuide.motion;
  await expect(page.getByRole("dialog").getByRole("button", { name: motion.pause })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: motion.show(motion.position(2)) }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: motion.play })).toBeVisible();
  await expect(page.getByRole("dialog").getByText(`${motion.position(2)} :`)).toBeVisible();
  await inspect(page, "library");
  // En mouvement réduit, la frise des quatre positions remplace la lecture.
  await expect(page.getByRole("dialog").getByRole("list", { name: motion.positions }).getByRole("img")).toHaveCount(4);
  await page.keyboard.press("Escape");
  const link = await groupLink(page);
  const athlete = await joinAsAthlete(browser, link, "GuideAthlete");
  try {
    const groups = await (await page.request.get(`${root}/groups`)).json();
    const response = await page.request.post(`${root}/sessions`, {
      data: {
        date: today(),
        startTime: null,
        location: null,
        publishAt: null,
        assignments: [{ targetType: "group", targetId: groups[0].id }],
        overrides: [],
        draft: {
          title: "Apprendre l'arraché",
          type: "strength",
          durationMin: 30,
          coachNote: null,
          blocks: [
            {
              name: "Technique",
              variant: "club",
              items: [{ exerciseId: snatch.id, prescription: { sets: 2, reps: 3 } }],
            },
          ],
        },
      },
    });
    expect(response.ok()).toBe(true);
    const session = await response.json();
    expect(
      (
        await page.request.post(`${root}/sessions/${session.id}/publish`, {
          data: { expectedVersion: session.version },
        })
      ).ok(),
    ).toBe(true);
    await athlete.page.goto(`/seance/${session.id}`, { waitUntil: "networkidle" });
    await athlete.page.getByText(m.exerciseGuide.open, { exact: true }).click();
    await expect(athlete.page.getByText(snatch.guide!.loadExplanation)).toBeVisible();
    await expect(athlete.page.getByText(m.exerciseGuide.approved)).toBeVisible();
    await inspect(athlete.page, "session");
    // Le guide figé dans la séance reçoit le geste, lu d'après la fiche commune.
    await expect(
      athlete.page.getByRole("list", { name: m.exerciseGuide.motion.positions }).first().getByRole("img"),
    ).toHaveCount(4);
    await athlete.page.goto(`/seance/${session.id}/mode`, { waitUntil: "networkidle" });
    await athlete.page.getByText(m.exerciseGuide.open, { exact: true }).click();
    await expect(
      athlete.page
        .getByRole("region", { name: m.exerciseGuide.title })
        .getByText(snatch.guide!.steps[0]!, { exact: true }),
    ).toBeVisible();
    await inspect(athlete.page, "mode");
    expect((await athlete.page.request.get(`${root}/exercises`)).status()).toBe(403);
  } finally {
    await athlete.context.close();
  }
});
