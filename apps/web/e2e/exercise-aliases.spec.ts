import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

test("les noms contrôlés sont modifiables et recherchables sans créer une autre fiche", async ({ page }, info) => {
  await page.setViewportSize(
    info.project.name === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  );
  await createCoachSpace(page, "Alias");
  const me = await (await page.request.get("/api/v1/me")).json();
  const endpoint = `/api/v1/orgs/${me.spaces[0].organizationId}/exercises`;
  await page.goto("/exercices");
  await page.getByRole("button", { name: m.exercises.new, exact: true }).click();
  const dialog = page.getByRole("dialog");
  const name = "Soulevé roumain de recette";
  await dialog.getByLabel(m.exercises.name, { exact: true }).fill(name);
  await dialog.getByLabel(m.exercises.category, { exact: true }).selectOption("strength");
  await dialog
    .getByLabel(m.exercises.aliases, { exact: true })
    .fill("RDL recette\nRomanian deadlift recette\nrdl recette");
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await dialog.getByRole("button", { name: m.common.save, exact: true }).click();
  await expect(dialog).toBeHidden();
  const read = async () =>
    (await (await page.request.get(endpoint)).json()).filter((e: { name: string }) => e.name === name);
  expect(await read()).toMatchObject([{ aliases: ["RDL recette", "Romanian deadlift recette"] }]);
  expect(await read()).toHaveLength(1);
  await page.getByLabel(m.exercises.search, { exact: true }).fill("romanian deadlift recette");
  await page.getByRole("button", { name: `${m.common.edit} ${name}`, exact: true }).click();
  await expect(dialog.getByLabel(m.exercises.aliases, { exact: true })).toHaveValue(
    "RDL recette\nRomanian deadlift recette",
  );
  await dialog.getByLabel(m.exercises.aliases, { exact: true }).fill("a".repeat(121));
  await dialog.getByRole("button", { name: m.common.save, exact: true }).click();
  await expect(dialog.getByText(m.exercises.aliasesInvalid, { exact: true })).toBeVisible();
  expect((await read())[0].aliases).toEqual(["RDL recette", "Romanian deadlift recette"]);
  await dialog.getByLabel(m.exercises.aliases, { exact: true }).fill("");
  await dialog.getByRole("button", { name: m.common.save, exact: true }).click();
  await expect(dialog).toBeHidden();
  expect((await read())[0].aliases).toEqual([]);
  await page.reload();
  await page.getByLabel(m.exercises.search, { exact: true }).fill("romanian deadlift recette");
  await expect(page.getByRole("button", { name: `${m.common.edit} ${name}`, exact: true })).toHaveCount(0);
});
