import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { m, historyDate } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

test("historique réel, référence manuelle, calculateur et courbes accessibles", async ({ page }, info) => {
  await createCoachSpace(page, "Historique");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId;
  const root = `/api/v1/orgs/${orgId}`;
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    await sql.query("UPDATE organizations SET progression_enabled = true WHERE id = $1", [orgId]);
    await page.goto("/athletes");
    await page.getByRole("button", { name: m.athletes.new, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Prénom", { exact: true }).fill("Camille");
    await dialog.getByLabel("Nom", { exact: true }).fill("Historique");
    await dialog.getByLabel("Date de naissance", { exact: true }).fill("2000-04-10");
    await dialog.getByRole("button", { name: m.common.save, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Camille Historique" })).toBeVisible();
    const athleteId = new URL(page.url()).pathname.split("/").at(-1)!;
    const builder = await (await page.request.get(`${root}/session-builder`)).json();
    const exercise = builder.exercises.find((item: { name: string }) => item.name === "Squat arrière");
    const historyRoot = `${root}/athletes/${athleteId}/exercise-history`;
    const selected = await page.request.put(`${root}/athletes/${athleteId}/strength/${exercise.id}`, {
      data: { source: "working", valueKg: 80 },
    });
    expect(selected.ok()).toBe(true);
    await page.getByRole("link", { name: m.exerciseHistory.title, exact: true }).click();
    await expect(page.getByText(m.exerciseHistory.noSessions)).toBeVisible();
    await expect(page.locator(".world-work")).toBeVisible();
    const context = await (await page.request.get(`${historyRoot}/context`)).json();
    expect(context.exercises).toHaveLength(1);
    const dates = [12, 9, 6, 3, 1].map((days) =>
      new Date(Date.parse(context.today) - days * 86400000).toISOString().slice(0, 10),
    );
    for (const [i, date] of dates.entries()) {
      const response = await page.request.post(`${root}/sessions`, {
        data: {
          date,
          startTime: null,
          location: null,
          publishAt: null,
          assignments: [{ targetType: "athlete", targetId: athleteId }],
          overrides: [],
          draft: {
            title: `Force ${i + 1}`,
            type: "strength",
            durationMin: 30,
            coachNote: "NOTE_PRIVEE_HISTORIQUE",
            blocks: [
              {
                name: "Force",
                variant: "club",
                items: [
                  { exerciseId: exercise.id, prescription: { sets: 3, reps: 4, load: { type: "kg", value: 100 } } },
                ],
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
      const detail = await (await page.request.get(`${root}/sessions/${session.id}/athletes/${athleteId}/log`)).json();
      const ref = detail.blocks[0].items[0].ref;
      const logged = await page.request.post(`${root}/sessions/${session.id}/athletes/${athleteId}/log`, {
        data: {
          clientId: randomUUID(),
          expectedVersion: 0,
          expectedSessionVersion: detail.sessionVersion,
          status: "partial",
          variantDone: "club",
          detailedSets: [0, 1, 2].map((setIndex) => ({
            itemRef: ref,
            setIndex,
            reps: 4,
            loadKg: 40,
            done: i !== 2 && setIndex < 2,
            setKind: "work",
            loadKind: "external",
            repetitionScope: "total",
            sideCount: 1,
          })),
        },
      });
      expect(logged.ok(), await logged.text()).toBe(true);
    }
    const targetResponse = await page.request.post(`${root}/sessions`, {
      data: {
        date: context.today,
        startTime: "18:00",
        location: null,
        publishAt: null,
        assignments: [{ targetType: "athlete", targetId: athleteId }],
        overrides: [],
        draft: {
          title: "Rappel sans remplacement",
          type: "strength",
          durationMin: 30,
          coachNote: null,
          blocks: [
            {
              name: "Force",
              variant: "club",
              items: [
                { exerciseId: exercise.id, prescription: { sets: 1, reps: 4, load: { type: "kg", value: 100 } } },
              ],
            },
          ],
        },
      },
    });
    expect(targetResponse.ok()).toBe(true);
    const target = await targetResponse.json();
    expect(
      (
        await page.request.post(`${root}/sessions/${target.id}/publish`, { data: { expectedVersion: target.version } })
      ).ok(),
    ).toBe(true);
    await sql.query("UPDATE exercises SET name = 'Squat archivé', deleted_at = now() WHERE id = $1", [exercise.id]);
    await page.reload();
    await expect(page.getByLabel(m.exerciseHistory.exercise, { exact: true })).toContainText("Squat archivé");
    await expect(page.getByText(m.exerciseHistory.summary(4, "1 280"))).toBeVisible();
    await page.getByLabel(m.exerciseHistory.metric, { exact: true }).selectOption("distanceM");
    await expect(page.getByText(m.exerciseHistory.noMeasurements)).toBeVisible();
    await page.getByLabel(m.exerciseHistory.metric, { exact: true }).selectOption("tonnageKg");
    await page.getByText(m.exerciseHistory.table, { exact: true }).click();
    const table = page.getByRole("table", { name: m.exerciseHistory.metrics.tonnageKg });
    await expect(table.getByRole("row")).toHaveCount(6);
    await expect(table.getByRole("row").filter({ hasText: historyDate(dates[2]!) })).toContainText(
      m.exerciseHistory.missing,
    );
    await expect(table.getByRole("row").filter({ hasText: historyDate(dates[0]!) })).toContainText("320");
    await page.getByText(`${historyDate(dates[4]!)} · Force 5`, { exact: true }).click();
    await expect(page.locator("details[open]").getByText("Prescription conservée :", { exact: false })).toContainText(
      "100 kg",
    );
    await expect(page.getByRole("heading", { name: "Squat arrière", exact: true })).toBeVisible();
    await expect(
      page.locator("details[open]").getByText(m.exerciseHistory.notConfirmed, { exact: true }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText("NOTE_PRIVEE_HISTORIQUE");
    await page.getByText(m.exerciseHistory.calculator, { exact: true }).click();
    await expect(page.getByLabel(m.calculator.reference, { exact: true })).toHaveValue("80");
    await page.getByLabel(m.calculator.reference, { exact: true }).fill("90");
    expect(
      (await (await page.request.get(`${root}/athletes/${athleteId}/strength/${exercise.id}`)).json()).reference
        .valueKg,
    ).toBe(80);
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(page);
    }
    await expectAccessible(page);
    await page.setViewportSize({ width: info.project.name === "desktop" ? 1440 : 390, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `/tmp/tartan-exercise-history-${info.project.name}.png`, fullPage: true });
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "1";
    });
    await page.getByLabel(m.exerciseHistory.period, { exact: true }).selectOption("84");
    await expect(page).toHaveURL(/days=84/);
    await expect(page.getByLabel(m.exerciseHistory.exercise, { exact: true })).toHaveValue(exercise.id);
    await page.goto(`/seances/${target.id}/athletes/${athleteId}/series`);
    const reminder = page.getByRole("complementary");
    await expect(reminder.getByRole("heading", { name: m.exerciseHistory.lastTime, exact: true })).toBeVisible();
    await expect(reminder).toContainText("40 kg");
    await expect(reminder).toContainText(historyDate(dates[4]!));
    const row = page.getByRole("group", { name: m.progression.setNumber(1), exact: true });
    await expect(row.getByLabel(m.progression.fields.loadKg, { exact: true })).toHaveValue("100");
    await row.getByText(m.progression.advancedSet, { exact: true }).click();
    await row.getByLabel(m.progression.repetitionScope, { exact: true }).selectOption("per_side");
    await expect(reminder.getByText(m.exerciseHistory.noComparable)).toBeVisible();
    await row.getByLabel(m.progression.repetitionScope, { exact: true }).selectOption("total");
    await expect(reminder).toContainText("40 kg");
    await expect(row.getByLabel(m.progression.fields.loadKg, { exact: true })).toHaveValue("100");
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `/tmp/tartan-reminder-${info.project.name}.png`, fullPage: true });
    await reminder.getByRole("link", { name: m.exerciseHistory.openExercise }).click();
    await expect(page).toHaveURL(new RegExp(`to=${dates[4]}`));
    await expect(page.getByLabel(m.exerciseHistory.exercise, { exact: true })).toHaveValue(exercise.id);
    await page.getByRole("button", { name: m.exerciseHistory.untilToday }).click();
    await expect(page).toHaveURL(new RegExp(`to=${context.today}`));
    await sql.query("UPDATE organizations SET progression_enabled = false WHERE id = $1", [orgId]);
    await page.reload();
    await expect(page.getByText(m.progression.disabled)).toBeVisible();
    expect((await page.request.get(`${historyRoot}/context`)).status()).toBe(409);
  } finally {
    await sql.end();
  }
});
