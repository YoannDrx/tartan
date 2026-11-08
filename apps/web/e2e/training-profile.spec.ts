import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { expectAccessible, expectNoHorizontalScroll, signUp, uniqueEmail } from "./helpers";
import { groupLink, joinAsAthlete } from "./journeys";

test("le coach choisit son contexte sportif, le retrouve et le modifie sur web et API native", async ({
  page,
  browser,
}, info) => {
  await page.setViewportSize({ width: info.project.name === "desktop" ? 1440 : 390, height: 900 });
  await signUp(page, uniqueEmail("profil-sportif"));
  await expect(page.getByRole("heading", { name: "Crée ton espace coach" })).toBeVisible();
  await page.getByLabel("Prénom", { exact: true }).fill("Coach");
  await page.getByLabel("Nom", { exact: true }).fill("Athlé");
  await page.getByLabel("Date de naissance").fill("1985-03-14");
  await page.getByLabel(m.onboarding.orgName).fill("Préparation athlé");
  await page.getByLabel(m.onboarding.firstGroup, { exact: true }).fill("Sprint U18");
  await page.getByLabel(m.trainingProfile.firstGroupGoal).fill("Préparer la saison estivale");
  await page
    .locator("summary")
    .filter({ hasText: /^Disciplines/ })
    .click();
  await expect(page.getByRole("checkbox", { name: "Saut en hauteur", exact: true })).not.toBeChecked();
  await page.getByRole("checkbox", { name: "Sprint", exact: true }).check();
  await page.getByRole("checkbox", { name: "Demi-fond", exact: true }).check();
  await page
    .locator("summary")
    .filter({ hasText: /^Objectifs de préparation/ })
    .click();
  await page.getByRole("checkbox", { name: "Force", exact: true }).check();
  await page.getByRole("checkbox", { name: "Vitesse", exact: true }).check();
  await page
    .locator("summary")
    .filter({ hasText: /^Matériel disponible/ })
    .click();
  await page.getByRole("checkbox", { name: "Barres et disques", exact: true }).check();
  await page.getByRole("checkbox", { name: "Piste", exact: true }).check();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  for (const title of [/^Disciplines/, /^Objectifs de préparation/, /^Matériel disponible/])
    await page.locator("summary").filter({ hasText: title }).click();
  await page.screenshot({ path: `/tmp/tartan-training-onboarding-${info.project.name}.png`, fullPage: true });
  await page.getByRole("checkbox", { name: /conditions d'utilisation/ }).check();
  await page.getByRole("button", { name: m.onboarding.createSpace, exact: true }).click();
  await page.getByRole("button", { name: m.age.saveConfirmed, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Suivi du groupe" })).toBeVisible();
  const me = await (await page.request.get("/api/v1/me")).json();
  const url = `/api/v1/orgs/${me.spaces[0].organizationId}`;
  const read = async () => (await page.request.get(url)).json();
  expect(await read()).toMatchObject({
    disciplines: ["sprint", "middle_distance"],
    trainingObjectives: ["strength", "speed"],
    availableEquipment: ["barbell", "track"],
  });
  expect(await (await page.request.get(`${url}/groups`)).json()).toMatchObject([
    { name: "Sprint U18", goal: "Préparer la saison estivale" },
  ]);
  await page.goto("/reglages");
  const section = page.getByRole("region", { name: "Espace", exact: true });
  await section
    .locator("summary")
    .filter({ hasText: /^Objectifs de préparation/ })
    .click();
  await expect(section.getByRole("checkbox", { name: "Force", exact: true })).toBeChecked();
  await section.getByRole("checkbox", { name: "Force", exact: true }).uncheck();
  await section.getByRole("checkbox", { name: "Endurance", exact: true }).check();
  await section.getByRole("button", { name: m.common.save, exact: true }).click();
  await expect(page.getByText("Espace enregistré.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(section.locator("summary").filter({ hasText: /^Objectifs de préparation/ })).toContainText(
    "Vitesse, Endurance",
  );
  const current = await read();
  expect(current.trainingObjectives).toEqual(["speed", "endurance"]);
  // Transport utilisé par le natif : ancien client, refus d'une valeur inconnue, mise à jour partielle explicite.
  expect(
    (await page.request.patch(url, { data: { name: current.name, overdueReminders: current.overdueReminders } })).ok(),
  ).toBe(true);
  expect((await read()).trainingObjectives).toEqual(["speed", "endurance"]);
  expect(
    (
      await page.request.patch(url, {
        data: { name: current.name, overdueReminders: true, availableEquipment: ["unknown"] },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.patch(url, {
        data: { name: current.name, overdueReminders: true, availableEquipment: ["bands"] },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await expect(section.locator("summary").filter({ hasText: /^Matériel disponible/ })).toContainText("Élastiques");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalScroll(page);
  }
  await page.setViewportSize({ width: info.project.name === "desktop" ? 1440 : 390, height: 900 });
  await expectAccessible(page);
  await page.screenshot({ path: `/tmp/tartan-training-settings-${info.project.name}.png`, fullPage: true });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expectNoHorizontalScroll(page);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  const athlete = await joinAsAthlete(browser, await groupLink(page), "Profil athlète", { groupName: "Sprint U18" });
  try {
    expect((await athlete.page.request.patch(url, { data: { name: "Pirate", overdueReminders: true } })).status()).toBe(
      403,
    );
  } finally {
    await athlete.context.close();
  }
});
