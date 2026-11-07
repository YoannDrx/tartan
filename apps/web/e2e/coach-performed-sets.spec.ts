import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { groupLink, joinAsAthlete, today } from "./journeys";

test("le coach saisit deux athlètes sans mélanger leurs brouillons et relit une correction concurrente", async ({
  page,
  browser,
}, info) => {
  await createCoachSpace(page, "CoachSeries");
  await page.setViewportSize({ width: info.project.name === "desktop" ? 1440 : 390, height: 900 });
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId;
  const root = `/api/v1/orgs/${orgId}`;
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  const link = await groupLink(page);
  const first = await joinAsAthlete(browser, link, "Alice");
  const second = await joinAsAthlete(browser, link, "Basile");
  try {
    await sql.query("UPDATE organizations SET progression_enabled = true WHERE id = $1", [orgId]);
    const a = (await (await first.page.request.get("/api/v1/me")).json()).spaces[0].athleteId;
    const b = (await (await second.page.request.get("/api/v1/me")).json()).spaces[0].athleteId;
    const builder = await (await page.request.get(`${root}/session-builder`)).json();
    const exerciseResponse = await page.request.post(`${root}/exercises`, {
      data: { name: "Squat coach", category: "strength", strengthLoadKind: "external_total" },
    });
    expect(exerciseResponse.ok()).toBe(true);
    const exercise = await exerciseResponse.json();
    const created = await page.request.post(`${root}/sessions`, {
      data: {
        date: today(),
        startTime: null,
        location: null,
        publishAt: null,
        assignments: [{ targetType: "group", targetId: builder.groups[0].id }],
        overrides: [],
        draft: {
          title: "Force du groupe",
          type: "strength",
          durationMin: 30,
          coachNote: null,
          blocks: [
            {
              name: "Force",
              variant: "club",
              items: [{ exerciseId: exercise.id, prescription: { sets: 2, reps: 4, load: { type: "kg", value: 40 } } }],
            },
          ],
        },
      },
    });
    expect(created.ok()).toBe(true);
    const session = await created.json();
    const endpoint = `${root}/sessions/${session.id}`;
    expect((await page.request.post(`${endpoint}/publish`, { data: { expectedVersion: session.version } })).ok()).toBe(
      true,
    );
    expect(
      (
        await first.page.request.post(`${endpoint}/log`, {
          data: {
            clientId: randomUUID(),
            variantDone: "club",
            status: "partial",
            rpe: 7,
            durationMin: 35,
            comment: "Retour Alice",
          },
        })
      ).ok(),
    ).toBe(true);
    const url = (athleteId: string) => `/seances/${session.id}/athletes/${athleteId}/series`;
    const readA = async () => (await first.page.request.get(`${endpoint}/me`)).json();
    const readB = async () => (await second.page.request.get(`${endpoint}/me`)).json();
    await page.goto(`/seances/${session.id}/suivi`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: `${m.progression.coachSetsTitle} · Alice Test`, exact: true }).click();
    const row = page.getByRole("group", { name: m.progression.setNumber(1), exact: true });
    const load = row.getByLabel(m.progression.fields.loadKg, { exact: true });
    const save = page.getByRole("button", { name: m.progression.saveCoachSets, exact: true });
    await load.fill("44");
    await row.getByRole("checkbox").check();
    await page.goto(url(b), { waitUntil: "networkidle" });
    await expect(page.getByText("Basile Test", { exact: true })).toBeVisible();
    await expect(load).toHaveValue("40");
    await expect(row.getByRole("checkbox")).not.toBeChecked();
    await load.fill("50");
    await row.getByRole("checkbox").check();
    await save.click();
    await expect(page.getByText(m.progression.savedSets, { exact: true })).toBeVisible();
    expect((await readB()).log.detailedSets[0].loadKg).toBe(50);
    await page.goto(url(a), { waitUntil: "networkidle" });
    await expect(load).toHaveValue("44");
    await expect(row.getByRole("checkbox")).toBeChecked();
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await page.context().setOffline(true);
    await save.click();
    await expect(page.getByText(m.progression.queuedSets, { exact: true })).toBeVisible();
    const current = await readA();
    expect(
      (
        await first.page.request.post(`${endpoint}/log`, {
          data: {
            clientId: randomUUID(),
            writeScope: "sets",
            expectedVersion: current.log.version,
            expectedSessionVersion: current.sessionVersion,
            status: "partial",
            variantDone: "club",
            detailedSets: [
              {
                itemRef: current.blocks[0].items[0].ref,
                setIndex: 0,
                done: true,
                reps: 4,
                loadKg: 42,
                setKind: "work",
                loadKind: "external",
                repetitionScope: "total",
                sideCount: 1,
              },
            ],
          },
        })
      ).ok(),
    ).toBe(true);
    await page.context().setOffline(false);
    await expect(page.getByText(m.offline.reviewPending(1), { exact: true })).toBeVisible();
    // Un conflit pour Alice n'empêche pas la correction de Basile.
    await page.goto(url(b), { waitUntil: "networkidle" });
    await load.fill("55");
    await save.click();
    await expect(page.getByText(m.progression.savedSets, { exact: true })).toBeVisible();
    expect((await readB()).log.detailedSets[0].loadKg).toBe(55);
    expect((await readA()).log.detailedSets[0].loadKg).toBe(42);
    await page.getByRole("link", { name: m.syncReview.open, exact: true }).click();
    await expect(page.getByText(`Alice Test · ${m.syncReview.batch(1)}`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: m.syncReview.compare, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Alice Test · Force du groupe", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: m.syncReview.server, exact: true })).toContainText("42 kg");
    await expect(page.getByRole("region", { name: m.syncReview.local, exact: true })).toContainText("44 kg");
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const bar = document.querySelector(".offline-bar")!.getBoundingClientRect();
          const header = document.querySelector(".app-header")!.getBoundingClientRect();
          return header.top >= bar.bottom;
        }),
      )
      .toBe(true);
    await page.getByRole("button", { name: m.syncReview.apply, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: m.syncReview.apply, exact: true }).click();
    await expect.poll(async () => (await readA()).log.version).toBe(3);
    expect((await readA()).log).toMatchObject({
      rpe: 7,
      durationMin: 35,
      comment: "Retour Alice",
      detailedSets: [{ loadKg: 44 }],
    });
    expect((await readB()).log).toMatchObject({ version: 2, detailedSets: [{ loadKg: 55 }] });
    const author = await sql.query(
      "SELECT recorded_by FROM session_logs WHERE scheduled_session_id = $1 AND athlete_id = $2",
      [session.id, a],
    );
    expect(author.rows[0].recorded_by).toBe(me.id);
    await page.goto(url(a), { waitUntil: "networkidle" });
    await expect(load).toHaveValue("44");
    await expect(page.getByText(m.progression.draftStale, { exact: true })).toHaveCount(0);
    await expect(save).toBeEnabled();
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expectNoHorizontalScroll(page);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "";
    });
    await page.screenshot({ path: `/tmp/tartan-coach-sets-${info.project.name}.png`, fullPage: true });
  } finally {
    await page.context().setOffline(false);
    await first.context.close();
    await second.context.close();
    await sql.end();
  }
});
