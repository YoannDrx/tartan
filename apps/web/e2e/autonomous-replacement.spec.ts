import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { groupLink, joinAsAthlete, today } from "./journeys";

const labels = m.builder.sequence;

test("un exercice d'un bloc commun se remplace en autonomie, et l'absent reçoit le remplacement", async ({
  page,
  browser,
}) => {
  await createCoachSpace(page, "Remplacement");
  const { page: athlete, context } = await joinAsAthlete(browser, await groupLink(page), "Noa");
  try {
    await page.goto(`/seances/nouvelle?date=${today()}`, { waitUntil: "networkidle" });
    await page.getByLabel(m.builder.titleLabel, { exact: true }).fill("Force partagée");
    await page.getByRole("button", { name: "Ajouter Développé couché à la séance", exact: true }).click();
    const phase = page.getByRole("region", { name: m.builder.blocks.main, exact: true });
    await phase.getByLabel(labels.sharedPhase, { exact: true }).check();
    await phase.getByRole("button", { name: labels.moreActions("Développé couché"), exact: true }).click();
    await page.getByRole("menuitem", { name: labels.replaceAutonomous, exact: true }).click();
    const picker = page.getByRole("dialog", { name: labels.replaceTitle("Développé couché") });
    await picker.getByRole("button", { name: labels.add("Pompes"), exact: true }).click();
    const line = phase.getByRole("button", { name: new RegExp(labels.autonomousLine("Pompes")) });
    await expect(line).toBeVisible();
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    // La ligne ouvre la prescription du remplacement, pas celle de l'exercice du club.
    await line.click();
    await expect(page.getByRole("dialog", { name: labels.autonomousLine("Pompes") })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: m.common.close, exact: true }).last().click();

    // L'aperçu montre chaque version.
    await page.getByRole("button", { name: m.builder.preview, exact: true }).click();
    const preview = page.getByRole("dialog");
    await preview.getByRole("button", { name: m.variant.autonomous, exact: true }).click();
    await expect(preview.getByText("Pompes", { exact: true })).toBeVisible();
    await expect(preview.getByText("Développé couché", { exact: true })).toHaveCount(0);
    await preview.getByRole("button", { name: m.variant.club, exact: true }).click();
    await expect(preview.getByText("Développé couché", { exact: true })).toBeVisible();
    await expect(preview.getByText("Pompes", { exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Publier", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Force partagée" })).toBeVisible();
    await page.getByRole("button", { name: "Absent" }).click();
    await page.getByRole("button", { name: "Valider l'appel" }).click();
    await expect(page.getByText(/1 absent basculé en autonomie/)).toBeVisible();
    await athlete.reload({ waitUntil: "networkidle" });
    await expect(athlete.getByText("Pompes", { exact: true }).first()).toBeVisible();
    await expect(athlete.getByText("Développé couché", { exact: true })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
