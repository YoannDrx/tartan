import { expect, test } from "@playwright/test";
import { createApiClient } from "../../../packages/api-client/src/index";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

test("publie une sélection et rejoue sans doublon ; un conflit conserve tous les brouillons", async ({
  page,
}, info) => {
  await createCoachSpace(page, "PublicationLot");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId;
  const api = createApiClient({
    baseUrl: new URL(page.url()).origin,
    headers: async () => ({ Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") }),
  });
  const context = await api.sessionBuilder(orgId);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const input = (title: string) => ({
    date: today,
    startTime: null,
    location: null,
    publishAt: null,
    overrides: [],
    assignments: [{ targetType: "group" as const, targetId: context.groups[0]!.id }],
    draft: {
      title,
      type: "strength" as const,
      durationMin: 40,
      coachNote: null,
      blocks: [
        {
          name: "Force",
          variant: "club" as const,
          items: [{ exerciseId: context.exercises[0]!.id, prescription: { sets: 3, reps: 4 } }],
        },
      ],
    },
  });
  const one = await api.createSession(orgId, input("Lot force A")),
    two = await api.createSession(orgId, input("Lot force B"));
  await page.goto(`/calendrier?semaine=${today}`);
  await page.getByRole("button", { name: m.batchPublication.open, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: m.batchPublication.title });
  await dialog.getByRole("checkbox", { name: /Lot force A/ }).check();
  await dialog.getByRole("checkbox", { name: /Lot force B/ }).check();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `/tmp/tartan-batch-${info.project.name}.png` });
  await dialog.getByRole("button", { name: m.batchPublication.confirm(2), exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const replay = await api.publishSessions(orgId, {
    sessions: [one, two].map((s) => ({ id: s.id, expectedVersion: s.version })),
  });
  expect(replay.sessions.map((s) => s.version)).toEqual([2, 2]);
  const third = await api.createSession(orgId, input("Lot conflit A")),
    fourth = await api.createSession(orgId, input("Lot conflit B"));
  await page.reload();
  await page.getByRole("button", { name: m.batchPublication.open, exact: true }).click();
  await dialog.getByRole("checkbox", { name: /Lot conflit A/ }).check();
  await dialog.getByRole("checkbox", { name: /Lot conflit B/ }).check();
  const latest = await api.editSession(orgId, fourth.id);
  await api.updateSession(orgId, fourth.id, {
    ...input("Lot conflit B corrigé"),
    draft: { ...latest.draft, title: "Lot conflit B corrigé" },
    expectedVersion: latest.version,
  });
  await dialog.getByRole("button", { name: m.batchPublication.confirm(2), exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(m.builder.versionConflict);
  const calendar = await api.calendar(orgId, today, today);
  expect(
    calendar.sessions.filter((s) => [third.id, fourth.id].includes(s.id)).every((s) => s.publishedAt === null),
  ).toBe(true);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalScroll(page);
  }
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "1";
  });
  await dialog.getByRole("button", { name: m.batchPublication.refresh, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: m.batchPublication.open, exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: /Lot conflit B corrigé/ })).toBeVisible();
});
