import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectNoHorizontalScroll } from "./helpers";

test("un brouillon garde son ordre et un onglet ancien ne peut pas écraser sa correction", async ({
  page,
  context,
}) => {
  await createCoachSpace(page, "Identites");
  await page.goto("/seances/nouvelle", { waitUntil: "networkidle" });
  await page.getByLabel("Titre", { exact: true }).fill("Force stable");
  await page.getByRole("button", { name: "Ajouter Accélérations à la séance", exact: true }).click();
  await page.getByRole("button", { name: "Ajouter Foulées bondissantes à la séance", exact: true }).click();
  await page.getByRole("button", { name: m.builder.saveDraft, exact: true }).click();
  await expect(page).toHaveURL(/\/seances\/[a-f0-9-]+$/);
  await page.reload({ waitUntil: "networkidle" });

  const stale = await context.newPage();
  await stale.goto(page.url(), { waitUntil: "networkidle" });
  const body = page.getByRole("region", { name: m.builder.body, exact: true });
  const second = body.getByRole("listitem").filter({ hasText: "Foulées bondissantes" });
  await second.getByRole("button", { name: "Monter", exact: true }).click();
  await page.getByLabel("Titre", { exact: true }).fill("Force corrigée");
  await page.getByRole("button", { name: m.builder.saveDraft, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Force corrigée", exact: true })).toBeVisible();

  await stale.getByLabel("Titre", { exact: true }).fill("Ancienne version");
  await stale.getByRole("button", { name: m.builder.saveDraft, exact: true }).click();
  await expect(stale.getByRole("alert").filter({ hasText: m.builder.versionConflict })).toBeVisible();
  await stale.close();

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByLabel("Titre", { exact: true })).toHaveValue("Force corrigée");
  await expect(body.getByRole("listitem").first()).toContainText("Foulées bondissantes");
  await expectNoHorizontalScroll(page);
  // Une nouvelle sauvegarde depuis ce même écran utilise bien la version retournée.
  await page.getByRole("button", { name: m.nativeBuilder.discardLocal, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: m.common.delete, exact: true }).click();
  await page.getByText(m.builder.sequence.advanced, { exact: true }).click();
  await page.getByLabel("Mot du coach", { exact: true }).fill("Prescriptions confirmées");
  await page.getByRole("button", { name: m.builder.saveDraft, exact: true }).click();
  await expect(page.getByText("Brouillon enregistré.", { exact: true })).toBeVisible();
});
