import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

test("garde le groupe et la période du calendrier jusqu'au brouillon, à la publication et au retour", async ({
  page,
}) => {
  await createCoachSpace(page, "Contexte");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId;
  const groupId = randomUUID();
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    await sql.query("INSERT INTO groups (id, organization_id, name, updated_at) VALUES ($1,$2,'Force sprint',now())", [
      groupId,
      orgId,
    ]);
  } finally {
    await sql.end();
  }
  const root = `/api/v1/orgs/${orgId}`;
  const exercises = await (await page.request.get(`${root}/exercises`)).json();
  const exercise = exercises.find((item: { category: string }) => item.category === "strength");
  const week = "2026-12-07";
  const returnTo = `/calendrier?semaine=${week}&groupe=${groupId}`;
  await page.goto(returnTo, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: m.coach.newSession, exact: true }).click();
  await expect(page.getByLabel(m.builder.date, { exact: true })).toHaveValue(week);
  await expect(page.getByRole("checkbox", { name: /Force sprint/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Hauteur Élite/ })).not.toBeChecked();
  await page.getByLabel("Titre", { exact: true }).fill("Force avec contexte conservé");
  await page.getByRole("button", { name: `Ajouter ${exercise.name} à la séance`, exact: true }).click();
  await page.getByRole("button", { name: m.builder.saveDraft, exact: true }).click();
  await expect(page).toHaveURL(/\/seances\/[a-f\d-]+\?retour=/);
  const sessionId = new URL(page.url()).pathname.split("/")[2]!;
  await page.reload({ waitUntil: "networkidle" });
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
  await page.getByRole("link", { name: "Force avec contexte conservé", exact: true }).click();
  await expect(page).toHaveURL(/\/suivi\?retour=/);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("link", { name: m.calendar.backToContext, exact: true }).click();
  await expect(page).toHaveURL(new URL(returnTo, page.url()).href);

  await page.getByRole("link", { name: m.calendar.month, exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("mois")).toBe("2026-12");

  // La vue mois conserve également son filtre et propose le premier jour du mois consulté.
  await page.goto(`/calendrier?vue=mois&mois=2027-01&groupe=${groupId}`);
  await page.getByRole("link", { name: m.coach.newSession, exact: true }).click();
  await expect(page.getByLabel(m.builder.date, { exact: true })).toHaveValue("2027-01-01");
  await page.getByRole("link", { name: m.calendar.backToContext, exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/calendrier");
  expect(new URL(page.url()).searchParams.get("mois")).toBe("2027-01");
  expect(new URL(page.url()).searchParams.get("groupe")).toBe(groupId);

  await page.getByRole("link", { name: m.calendar.week, exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("semaine")).toBe("2026-12-28");

  // Un ancien groupe inaccessible ne présélectionne pas silencieusement un autre groupe.
  await page.goto(`/seances/nouvelle?groupe=${randomUUID()}&retour=${encodeURIComponent("https://example.org")}`);
  await expect(page.getByText(m.calendar.groupUnavailable, { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Force sprint/ })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Hauteur Élite/ })).not.toBeChecked();
  await expect(page.getByRole("link", { name: m.calendar.backToContext, exact: true })).toHaveCount(0);
});
