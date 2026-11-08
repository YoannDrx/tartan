import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { createApiClient } from "../../../packages/api-client/src/index";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

test("le constructeur demande le contexte multi-groupes avant publication et respecte l'individuel", async ({
  page,
}, info) => {
  const t = m.trainingPhases;
  await createCoachSpace(page, "Contexte");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId;
  const native = createApiClient({
    baseUrl: new URL(page.url()).origin,
    headers: async () => ({
      Cookie: (await page.context().cookies()).map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    }),
  });
  const first = (await native.sessionBuilder(orgId)).groups[0]!;
  const second = randomUUID(),
    athleteId = randomUUID();
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    await sql.query("UPDATE organizations SET phases_enabled = true WHERE id = $1", [orgId]);
    await sql.query(
      "INSERT INTO groups (id, organization_id, name, updated_at) VALUES ($1, $2, 'Prépa physique', now())",
      [second, orgId],
    );
    await sql.query(
      "INSERT INTO athletes (id, organization_id, first_name, last_name, updated_at) VALUES ($1, $2, 'Camille', 'Contexte', now())",
      [athleteId, orgId],
    );
    for (const groupId of [first.id, second])
      await sql.query("INSERT INTO group_members (group_id, athlete_id, updated_at) VALUES ($1, $2, now())", [
        groupId,
        athleteId,
      ]);
  } finally {
    await sql.end();
  }
  const body = {
    expectedVersion: 0,
    kind: "development" as const,
    startDate: "2030-01-01",
    endDate: "2030-03-31",
    objective: "Objectif sportif",
    description: "",
    privateNote: "NOTE_INTERDITE_DANS_LE_CONTEXTE",
  };
  await native.saveTrainingPhase(orgId, {
    ...body,
    id: randomUUID(),
    name: "Force",
    target: { type: "group", id: first.id },
  });
  await native.saveTrainingPhase(orgId, {
    ...body,
    id: randomUUID(),
    name: "Vitesse",
    target: { type: "group", id: second },
  });
  await page.goto("/seances/nouvelle?date=2030-01-15");
  await page.getByLabel("Titre", { exact: true }).fill("Séance contextualisée");
  await page.getByRole("checkbox", { name: /Hauteur Élite/ }).check();
  const panel = page.getByRole("region", { name: t.planning, exact: true });
  await expect(panel.getByText(t.chooseGroup)).toBeVisible();
  await page.getByRole("button", { name: "Ajouter Accélérations à la séance", exact: true }).click();
  await page.getByRole("button", { name: m.builder.publish, exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: t.reviewRequired })).toBeVisible();
  await panel.getByLabel(t.referenceFor("Camille Contexte"), { exact: true }).selectOption(second);
  await expect(panel.getByText(t.chooseGroup)).toHaveCount(0);
  await panel.getByText(t.planningAthletes(1), { exact: true }).click();
  await expect(panel.getByText("Camille Contexte", { exact: true })).toBeVisible();
  await expect(panel.getByText(/Camille Contexte/).locator("..")).toContainText("Vitesse");
  expect(await panel.textContent()).not.toContain("NOTE_INTERDITE_DANS_LE_CONTEXTE");
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await panel.screenshot({ path: `/tmp/tartan-phase-planning-${info.project.name}.png` });
  await page.getByRole("button", { name: m.builder.publish, exact: true }).click();
  await expect(page).toHaveURL(/\/seances\/[a-f0-9-]+\/suivi$/);
  const editUrl = page.url().replace(/\/suivi$/, "");
  const sessionId = editUrl.split("/").at(-1)!;
  expect((await native.editSession(orgId, sessionId)).phaseReview?.choices).toEqual([{ athleteId, groupId: second }]);
  await page.goto(editUrl);
  await expect(panel.getByText(t.planningAthletes(1), { exact: true })).toBeVisible();
  await expect(panel.getByText(t.chooseGroup)).toHaveCount(0);
  await panel.getByText(t.planningAthletes(1), { exact: true }).click();
  await expect(panel.getByText(/Camille Contexte/).locator("..")).toContainText("Vitesse");
  const personal = await native.saveTrainingPhase(orgId, {
    ...body,
    id: randomUUID(),
    name: "Cycle individuel",
    target: { type: "athlete", id: athleteId },
  });
  const result = await native.phasePlanning(orgId, {
    date: "2030-01-15",
    groupIds: [first.id],
    athleteIds: [],
    choices: [],
  });
  expect(result.athletes[0]?.result).toMatchObject({ kind: "phase", phase: { id: personal.id } });
  expect(JSON.stringify(result)).not.toContain("privateNote");
  await page.goto(editUrl);
  await expect(panel.getByText(t.chooseGroup)).toHaveCount(0);
  await panel.getByText(t.planningAthletes(1), { exact: true }).click();
  await expect(panel.getByText(t.individualPriority)).toBeVisible();
  await expect(panel.getByText(/Camille Contexte/).locator("..")).toContainText("Cycle individuel");
});
