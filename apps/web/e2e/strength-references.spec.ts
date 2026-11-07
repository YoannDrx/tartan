import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { strengthReferenceResponse } from "@tartan/contracts";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

test("le coach choisit une référence liée ; un nouveau test ne la remplace pas", async ({ page }, info) => {
  await page.setViewportSize(
    info.project.name === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  );
  await createCoachSpace(page, "References");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId as string;
  const root = `/api/v1/orgs/${orgId}`;
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    await sql.query("UPDATE organizations SET progression_enabled = true WHERE id = $1", [orgId]);
  } finally {
    await sql.end();
  }
  await page.goto("/exercices", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: m.exercises.new, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(m.exercises.name, { exact: true }).fill("Squat barre de référence");
  await dialog.getByLabel(m.exercises.category, { exact: true }).selectOption("strength");
  await dialog.getByLabel(m.strength.convention, { exact: true }).selectOption("external_total");
  await dialog.getByLabel(m.strength.step, { exact: true }).fill("2.5");
  await dialog.getByRole("button", { name: m.common.save, exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.goto("/athletes", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: m.athletes.new, exact: true }).click();
  await dialog.getByLabel("Prénom", { exact: true }).fill("Camille");
  await dialog.getByLabel("Nom", { exact: true }).fill("Force");
  await dialog.getByLabel("Date de naissance", { exact: true }).fill("2000-04-10");
  await dialog.getByRole("button", { name: m.common.save, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Camille Force" })).toBeVisible();
  const athleteId = new URL(page.url()).pathname.split("/").at(-1)!;
  const section = page.getByRole("region", { name: m.athletes.tests, exact: true });
  await section.getByRole("button", { name: m.common.add, exact: true }).click();
  await dialog.getByLabel("Exercice", { exact: true }).selectOption({ label: "Squat barre de référence" });
  await dialog.getByLabel("Charge (kg)", { exact: true }).fill("100");
  await dialog.getByRole("checkbox", { name: m.strength.selectReference }).check();
  await expectAccessible(page);
  await dialog.getByRole("button", { name: m.common.save, exact: true }).click();
  await expect(dialog).toBeHidden();
  const references = page.getByRole("region", { name: m.strength.referenceTitle, exact: true });
  await expect(references.getByText("100 kg", { exact: true })).toBeVisible();
  const context = await (await page.request.get(`${root}/session-builder`)).json();
  const exercise = context.exercises.find((e: { name: string }) => e.name === "Squat barre de référence");
  expect(context.testKeys).toContain(`exercise:${exercise.id}`);
  const added = await page.request.post(`${root}/athletes/${athleteId}/strength-tests`, {
    data: {
      exerciseId: exercise.id,
      exerciseKey: `exercise:${exercise.id}`,
      kind: "one_rm",
      value: 120,
      date: "2030-01-01",
    },
  });
  expect(added.ok()).toBe(true);
  const result = strengthReferenceResponse.parse(
    await (await page.request.get(`${root}/athletes/${athleteId}/strength/${exercise.id}`)).json(),
  );
  expect(result.reference?.valueKg).toBe(100);
  expect(result.tests).toHaveLength(2);
  await references.getByRole("button", { name: m.strength.workingReference, exact: true }).click();
  await dialog.getByLabel(m.strength.valueKg, { exact: true }).fill("90");
  await dialog.getByRole("button", { name: m.common.save, exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(references.getByText("90 kg", { exact: true })).toBeVisible();
  await expect(references.getByText(m.strength.referenceKinds.working, { exact: true })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});
