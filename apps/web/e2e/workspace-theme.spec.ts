import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { addDays, startOfWeek } from "@tartan/domain";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { today } from "./journeys";

test("le bureau clair conserve les contrôles, les dialogues et les groupes de 30 à 120 athlètes", async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: info.project.name === "desktop" ? 1440 : 390, height: 900 });
  await createCoachSpace(page, "Bureau");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId;
  const root = `/api/v1/orgs/${orgId}`;
  const groups = await (await page.request.get(`${root}/groups`)).json();
  const groupId = groups[0].id;
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    await sql.query("UPDATE groups SET name = 'Préparation athlé' WHERE id = $1", [groupId]);
    const exercises = await (await page.request.get(`${root}/exercises`)).json();
    const types = ["strength", "running", "plyo", "mobility", "jump"] as const;
    for (const [index, type] of types.entries()) {
      const exercise = exercises.find(
        (item: { category: string }) => item.category === (type === "running" ? "running_drill" : type),
      );
      expect(exercise).toBeDefined();
      const response = await page.request.post(`${root}/sessions`, {
        data: {
          date: addDays(startOfWeek(today()), index),
          startTime: "18:00",
          location: "Stade",
          publishAt: null,
          assignments: [{ targetType: "group", targetId: groupId }],
          overrides: [],
          draft: {
            title: `${m.sessionType[type]} du groupe`,
            type,
            durationMin: 45,
            coachNote: null,
            blocks: [
              {
                name: "Préparation",
                variant: "club",
                items: [{ exerciseId: exercise.id, prescription: { sets: 3, reps: 8 } }],
              },
            ],
          },
        },
      });
      expect(response.ok()).toBe(true);
      const created = await response.json();
      expect(
        (
          await page.request.post(`${root}/sessions/${created.id}/publish`, {
            data: { expectedVersion: created.version },
          })
        ).ok(),
      ).toBe(true);
    }
    let count = 0;
    for (const total of [30, 60, 120]) {
      while (count < total) {
        const athleteId = randomUUID();
        count++;
        await sql.query(
          "INSERT INTO athletes (id, organization_id, first_name, last_name, created_at, updated_at) VALUES ($1, $2, $3, 'Fictif', now(), now())",
          [athleteId, orgId, `Athlète ${String(count).padStart(3, "0")}`],
        );
        await sql.query(
          "INSERT INTO group_members (group_id, athlete_id, created_at, updated_at) VALUES ($1, $2, '2020-01-01', now())",
          [groupId, athleteId],
        );
      }
      await page.goto("/suivi", { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: m.coach.trackingTitle })).toBeVisible();
      await expect(
        page.getByText(`Athlète ${String(total).padStart(3, "0")} Fictif`, { exact: true }).first(),
      ).toBeAttached();
      await expectNoHorizontalScroll(page);
    }
    const heading = page.getByRole("heading", { name: m.coach.trackingTitle });
    expect(await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(32);
    expect(await page.locator(".world-work").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      "rgb(242, 243, 241)",
    );
    await expectAccessible(page);
    await page.screenshot({ path: `/tmp/tartan-workspace-tracking-${info.project.name}.png` });
    await page.goto("/exercices", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: m.exercises.new, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
    expect(await dialog.evaluate((el) => getComputedStyle(el).colorScheme)).toBe("light");
    await dialog.getByLabel(m.exercises.name, { exact: true }).fill("Mobilité cheville et contrôle");
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `/tmp/tartan-workspace-dialog-${info.project.name}.png` });
    await dialog.getByRole("button", { name: m.common.close, exact: true }).click();
    await page.goto("/calendrier", { waitUntil: "networkidle" });
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({
      path: `/tmp/tartan-workspace-calendar-${info.project.name}.png`,
      style: "nextjs-portal { visibility: hidden; }",
    });
    if (info.project.name === "desktop") {
      await page.setViewportSize({ width: 768, height: 900 });
      await expectAccessible(page);
      await expectNoHorizontalScroll(page);
    }
    await page.goto("/seances/nouvelle", { waitUntil: "networkidle" });
    await page.getByLabel("Titre", { exact: true }).fill("Préparation de la semaine");
    await expectAccessible(page);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expectNoHorizontalScroll(page);
    await page.getByLabel("Titre", { exact: true }).focus();
    await expect(page.getByLabel("Titre", { exact: true })).toBeFocused();
    await page.evaluate(() => {
      document.documentElement.style.zoom = "";
    });
    await page.goto("/videos", { waitUntil: "networkidle" });
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
  } finally {
    await sql.end();
  }
});
