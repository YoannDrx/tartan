import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { groupLink, joinAsAthlete, today } from "./journeys";

for (const reduced of [false, true]) {
  test(`la célébration des records reste unique, y compris hors ligne — animations ${reduced ? "réduites" : "actives"}`, async ({
    page,
    browser,
  }, info) => {
    await createCoachSpace(page, "Records");
    const me = await (await page.request.get("/api/v1/me")).json();
    const orgId = me.spaces[0].organizationId;
    const root = `/api/v1/orgs/${orgId}`;
    const sql = new Client({
      connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
    });
    await sql.connect();
    await sql.query("UPDATE organizations SET progression_enabled = true WHERE id = $1", [orgId]);
    await sql.end();
    const { page: athlete, context } = await joinAsAthlete(browser, await groupLink(page), "Camille");
    try {
      await athlete.setViewportSize({ width: info.project.name === "desktop" ? 1440 : 390, height: 900 });
      await athlete.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
      await athlete.addInitScript(() => {
        const state = window as unknown as { celebrationCount: number };
        state.celebrationCount = 0;
        new MutationObserver((changes) => {
          for (const change of changes)
            for (const node of change.addedNodes)
              if (node instanceof Element && node.matches(".victory")) state.celebrationCount++;
        }).observe(document, { childList: true, subtree: true });
      });
      const count = () => athlete.evaluate(() => (window as unknown as { celebrationCount: number }).celebrationCount);
      const builder = await (await page.request.get(`${root}/session-builder`)).json();
      const exercise = builder.exercises.find((value: { name: string }) => value.name === "Squat arrière");
      const athleteId = builder.athletes[0].id;
      const create = async (hour: string, loadKg: number, status: "partial" | "done") => {
        const created = await page.request.post(`${root}/sessions`, {
          data: {
            date: today(),
            startTime: hour,
            location: null,
            publishAt: null,
            assignments: [{ targetType: "athlete", targetId: athleteId }],
            overrides: [],
            draft: {
              title: `Force ${hour}`,
              type: "strength",
              durationMin: 30,
              coachNote: null,
              blocks: [
                {
                  name: "Force",
                  variant: "club",
                  items: [
                    {
                      exerciseId: exercise.id,
                      prescription: { sets: 1, reps: 4, load: { type: "kg", value: loadKg } },
                    },
                  ],
                },
              ],
            },
          },
        });
        expect(created.ok()).toBe(true);
        const session = await created.json();
        expect(
          (
            await page.request.post(`${root}/sessions/${session.id}/publish`, {
              data: { expectedVersion: session.version },
            })
          ).ok(),
        ).toBe(true);
        const detail = await (await athlete.request.get(`${root}/sessions/${session.id}/me`)).json();
        const logged = await athlete.request.post(`${root}/sessions/${session.id}/log`, {
          data: {
            clientId: randomUUID(),
            status,
            variantDone: "club",
            writeScope: "sets",
            expectedVersion: 0,
            expectedSessionVersion: detail.sessionVersion,
            detailedSets: [
              {
                itemRef: detail.blocks[0].items[0].ref,
                setIndex: 0,
                reps: 4,
                loadKg,
                done: true,
                setKind: "work",
                loadKind: "external",
                repetitionScope: "total",
                sideCount: 1,
              },
            ],
          },
        });
        expect(logged.ok()).toBe(true);
        return session.id as string;
      };
      await create("08:00", 40, "done");
      const id = await create("09:00", 60, "partial");
      await athlete.goto(`/seance/${id}/mode`, { waitUntil: "networkidle" });
      await athlete.getByRole("button", { name: m.today.quickDone, exact: true }).click();
      const dialog = athlete.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { name: m.strengthRecords.confirmed, exact: true })).toBeVisible();
      await expect(dialog).toContainText("60 kg");
      await expect.poll(count).toBe(reduced ? 0 : 1);
      await expect(athlete.locator(".victory")).toHaveCount(0);
      await expectAccessible(athlete);
      await expectNoHorizontalScroll(athlete);
      await dialog.screenshot({
        path: `/tmp/tartan-celebration-${info.project.name}-${reduced ? "reduced" : "normal"}.png`,
      });
      await dialog.getByRole("button", { name: m.validation.finish, exact: true }).click();
      await athlete.reload({ waitUntil: "networkidle" });
      await athlete.getByRole("button", { name: m.today.quickDone, exact: true }).click();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { name: m.strengthRecords.confirmed, exact: true })).toHaveCount(0);
      expect(await count()).toBe(0);
      await dialog.getByRole("button", { name: m.validation.finish, exact: true }).click();

      // La validation depuis les séries utilise le même moment, pas une animation de record séparée.
      const detailed = await create("10:00", 80, "partial");
      await athlete.goto(`/seance/${detailed}/series`, { waitUntil: "networkidle" });
      await athlete.getByLabel(m.progression.sessionStatus, { exact: true }).selectOption("done");
      await athlete.getByRole("button", { name: m.progression.saveSets, exact: true }).click();
      await expect(athlete.getByRole("heading", { name: m.strengthRecords.confirmed, exact: true })).toBeVisible();
      await expect.poll(count).toBe(reduced ? 0 : 1);
      await expect(athlete.locator(".victory")).toHaveCount(0);
      await expectAccessible(athlete);

      const offline = await create("11:00", 90, "partial");
      await athlete.goto(`/seance/${offline}/mode`, { waitUntil: "networkidle" });
      await context.setOffline(true);
      await athlete.getByRole("button", { name: m.today.quickDone, exact: true }).click();
      await expect(dialog).toBeVisible();
      await expect(athlete.getByText(m.validation.queued, { exact: true })).toBeVisible();
      expect(await count()).toBe(0);
      await dialog.getByRole("button", { name: m.validation.finish, exact: true }).click();
      await context.setOffline(false);
      await expect
        .poll(async () => (await (await athlete.request.get(`${root}/sessions/${offline}/me`)).json()).log.status)
        .toBe("done");
      expect(await count()).toBe(0);
      await expect(athlete.getByRole("heading", { name: m.strengthRecords.confirmed, exact: true })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}
