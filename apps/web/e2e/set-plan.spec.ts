import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { addFromLibrary, createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

const plan = m.builder.setPlan;

test("une pyramide avec échauffement se prescrit série par série et se retrouve dans le mode séance", async ({
  page,
  browser,
}) => {
  const { groupLink, joinAsAthlete, today } = await import("./journeys");
  await createCoachSpace(page, "Pyramide");
  await page.goto("/seances/nouvelle", { waitUntil: "networkidle" });
  await page.getByLabel(m.builder.titleLabel, { exact: true }).fill("Force en pyramide");
  await addFromLibrary(page, "Développé couché");
  const phase = page.getByRole("region", { name: m.builder.blocks.main, exact: true });
  await phase.getByRole("button", { name: /^Développé couché/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(m.builder.load, { exact: true }).selectOption("kg");
  await dialog.getByRole("checkbox", { name: plan.toggle }).check();
  const rows = [
    { reps: "8", kg: "40", warmup: true },
    { reps: "5", kg: "60", warmup: false },
    { reps: "5", kg: "60", warmup: false },
    { reps: "3", kg: "80", warmup: false },
  ];
  await expect(dialog.getByRole("group", { name: /^Série \d+$/ })).toHaveCount(4);
  for (const [index, row] of rows.entries()) {
    const set = dialog.getByRole("group", { name: plan.set(index + 1), exact: true });
    if (row.warmup) await set.getByRole("checkbox", { name: plan.warmup }).check();
    await set.getByLabel(m.builder.reps, { exact: true }).fill(row.reps);
    await set.getByLabel(m.builder.sequence.loadKg, { exact: true }).fill(row.kg);
  }
  await expectAccessible(page);
  await dialog.getByRole("button", { name: m.common.close, exact: true }).last().click();
  const summary = "Échauffement 8 rép. à 40 kg · 2 × 5 rép. à 60 kg, 3 rép. à 80 kg";
  await expect(phase.getByText(summary, { exact: false })).toBeVisible();
  await page.getByRole("button", { name: m.builder.saveDraft, exact: true }).click();
  await expect(page).toHaveURL(/\/seances\/[a-f0-9-]+$/);
  await page.reload({ waitUntil: "networkidle" });
  await expect(phase.getByText(summary, { exact: false })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Côté athlète : chaque série porte ses répétitions, sa charge et son repère d'échauffement.
  const me = await (await page.request.get("/api/v1/me")).json();
  const root = `/api/v1/orgs/${me.spaces[0].organizationId}`;
  const { page: athlete, context } = await joinAsAthlete(browser, await groupLink(page), "Pia");
  try {
    const builder = await (await page.request.get(`${root}/session-builder`)).json();
    const bench = builder.exercises.find((e: { name: string }) => e.name === "Développé couché");
    const setPlan = rows.map((row) => ({
      reps: Number(row.reps),
      load: { type: "kg", value: Number(row.kg) },
      ...(row.warmup ? { warmup: true } : {}),
    }));
    const response = await page.request.post(`${root}/sessions`, {
      data: {
        date: today(),
        startTime: null,
        location: null,
        publishAt: null,
        assignments: [{ targetType: "group", targetId: builder.groups[0].id }],
        overrides: [],
        draft: {
          structureVersion: 2,
          title: "Pyramide du jour",
          type: "strength",
          durationMin: 30,
          coachNote: null,
          blocks: [
            {
              ref: "phase",
              name: "Force",
              variant: "club",
              items: [
                {
                  ref: "bench",
                  exerciseId: bench.id,
                  prescription: { sets: 4, reps: 5, load: { type: "kg", value: 60 }, rest_s: 90, setPlan },
                },
              ],
              sequence: [{ kind: "exercise", itemRef: "bench" }],
            },
          ],
        },
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    const saved = await response.json();
    const published = await page.request.post(`${root}/sessions/${saved.id}/publish`, {
      data: { expectedVersion: saved.version },
    });
    expect(published.ok()).toBe(true);
    await athlete.goto(`/seance/${saved.id}/mode`, { waitUntil: "networkidle" });
    await expect(athlete.getByRole("heading", { level: 1 })).toHaveText("Développé couché");
    const first = athlete.getByRole("button", { name: /Série 1.*8 rép\. à 40 kg.*Échauffement/ });
    await expect(first).toBeVisible();
    await expect(athlete.getByRole("button", { name: /Série 4.*3 rép\. à 80 kg/ })).toBeVisible();
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expectAccessible(athlete);
    await expectNoHorizontalScroll(athlete);
  } finally {
    await context.close();
  }
});
