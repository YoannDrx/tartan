import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

test("garde le groupe et la période du calendrier jusqu'au brouillon, à la publication et au retour", async ({
  page,
}, info) => {
  await createCoachSpace(page, "Contexte");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId;
  const groupId = randomUUID();
  const athleteId = randomUUID();
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    await sql.query("INSERT INTO groups (id, organization_id, name, updated_at) VALUES ($1,$2,'Force sprint',now())", [
      groupId,
      orgId,
    ]);
    await sql.query(
      "INSERT INTO athletes (id, organization_id, first_name, last_name, updated_at) VALUES ($1,$2,'Camille','Contexte',now())",
      [athleteId, orgId],
    );
    await sql.query(
      "INSERT INTO group_members (group_id, athlete_id, created_at, updated_at) VALUES ($1,$2,'2020-01-01',now())",
      [groupId, athleteId],
    );
  } finally {
    await sql.end();
  }
  const root = `/api/v1/orgs/${orgId}`;
  const exercises = await (await page.request.get(`${root}/exercises`)).json();
  const exercise = exercises.find((item: { category: string }) => item.category === "strength");
  const week = "2026-12-07";
  const returnTo = `/calendrier?semaine=${week}&groupe=${groupId}`;
  await page.goto(returnTo, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: m.nav.calendrier, exact: true })).toBeVisible();
  await page.getByRole("link", { name: m.coach.newSession, exact: true }).click();
  await expect(page.getByLabel(m.builder.date, { exact: true })).toHaveValue("07/12/2026");
  await expect(page.getByRole("checkbox", { name: /Force sprint/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Hauteur Élite/ })).not.toBeChecked();
  await page.getByLabel("Titre", { exact: true }).fill("Force avec contexte conservé");
  await page.getByRole("button", { name: `Ajouter ${exercise.name} à la séance`, exact: true }).click();
  await page.getByRole("button", { name: m.builder.saveDraft, exact: true }).click();
  await expect(page).toHaveURL(/\/seances\/[a-f\d-]+\?retour=/);
  const sessionId = new URL(page.url()).pathname.split("/")[2]!;
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("checkbox", { name: /Force sprint/ })).toBeChecked();
  expect(new URL(page.url()).searchParams.get("retour")).toBe(returnTo);
  const saved = await (await page.request.get(`${root}/sessions/${sessionId}`)).json();
  expect(saved.assignments).toEqual([{ targetType: "group", targetId: groupId }]);
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: m.builder.publish, exact: true }).click();
  await expect(page).toHaveURL(/\/suivi\?retour=/);
  await page.getByRole("link", { name: m.common.edit, exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/seances/${sessionId}`);
  expect(new URL(page.url()).searchParams.get("retour")).toBe(returnTo);
  await page.getByRole("link", { name: m.calendar.backToContext, exact: true }).click();
  await expect(page).toHaveURL(new URL(returnTo, page.url()).href);
  const sessionLink = page.getByRole("link", { name: "Force avec contexte conservé", exact: true });
  await sessionLink.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => new URL(page.url()).searchParams.get("seance")).toBe(sessionId);
  const panel = page.getByRole("dialog", { name: m.calendar.sessionDetail, exact: true });
  await expect(panel).toBeVisible();
  const viewport = page.viewportSize()!;
  const bounds = (await panel.boundingBox())!;
  if (viewport.width >= 1024) {
    expect(bounds.width).toBeLessThan(viewport.width * 0.65);
    expect(bounds.x).toBeGreaterThan(viewport.width * 0.35);
  } else {
    expect(bounds.width).toBe(viewport.width);
    expect(bounds.x).toBe(0);
  }
  const attendance = panel.getByRole("group", { name: "Présence de Camille Contexte", exact: true });
  await attendance.getByRole("button", { name: "Présent", exact: true }).click();
  await panel.getByRole("button", { name: m.coach.rollCallSave, exact: true }).click();
  await expect
    .poll(async () => {
      const detail = await (await page.request.get(`${root}/sessions/${sessionId}/coach`)).json();
      return detail.athletes.find((athlete: { athleteId: string }) => athlete.athleteId === athleteId)?.attendance;
    })
    .toBe("present");
  await expect(panel).toBeVisible();
  await expect(page.getByRole("heading", { name: m.nav.calendrier, exact: true, includeHidden: true })).toHaveCount(1);
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await page.screenshot({
    path: `/tmp/tartan-calendar-panel-${info.project.name}.png`,
    style: "nextjs-portal { visibility: hidden; }",
  });
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(new URL(returnTo, page.url()).href);
  await expect(sessionLink).toBeFocused();
  await page.goForward();
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: m.common.close, exact: true }).click();
  await expect(panel).toHaveCount(0);
  await sessionLink.click();
  await expect(panel).toBeVisible();
  await panel.getByRole("link", { name: m.common.edit, exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/seances/${sessionId}`);
  await expect(panel).toHaveCount(0);
  await page.getByRole("link", { name: m.calendar.backToContext, exact: true }).click();
  await expect(page).toHaveURL(new URL(returnTo, page.url()).href);
  await sessionLink.click();
  await expect(panel).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: m.common.close, exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(new URL(returnTo, page.url()).href);
  await sessionLink.click();
  await panel.getByRole("link", { name: m.calendar.openSessionPage, exact: true }).click();
  await expect(page).toHaveURL(/\/suivi\?retour=/);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(panel).toHaveCount(0);
  await page.getByRole("link", { name: m.calendar.backToContext, exact: true }).click();
  await expect(page).toHaveURL(new URL(returnTo, page.url()).href);

  await page.getByRole("link", { name: m.calendar.month, exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("mois")).toBe("2026-12");

  // La vue mois conserve également son filtre et propose le premier jour du mois consulté.
  await page.goto(`/calendrier?vue=mois&mois=2027-01&groupe=${groupId}`);
  await page.getByRole("link", { name: m.coach.newSession, exact: true }).click();
  await expect(page.getByLabel(m.builder.date, { exact: true })).toHaveValue("01/01/2027");
  await page.getByRole("link", { name: m.calendar.backToContext, exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/calendrier");
  expect(new URL(page.url()).searchParams.get("mois")).toBe("2027-01");
  expect(new URL(page.url()).searchParams.get("groupe")).toBe(groupId);

  // Sur téléphone, le choix se limite à Liste et Mois : la semaine reste une vue de bureau.
  if (info.project.name === "desktop") {
    await page.getByRole("link", { name: m.calendar.week, exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("semaine")).toBe("2026-12-28");
  }

  // Un ancien groupe inaccessible ne présélectionne pas silencieusement un autre groupe.
  await page.goto(`/seances/nouvelle?groupe=${randomUUID()}&retour=${encodeURIComponent("https://example.org")}`);
  await expect(page.getByText(m.calendar.groupUnavailable, { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Force sprint/ })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Hauteur Élite/ })).not.toBeChecked();
  await expect(page.getByRole("link", { name: m.calendar.backToContext, exact: true })).toHaveCount(0);
});
