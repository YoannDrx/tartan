import { expect, test, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace } from "./helpers";
import { createExercise, groupLink, joinAsAthlete, publishSession } from "./journeys";

// Le service worker garde les pages en différé : on attend que celle qu'on veut soit là.
const keptOffline = async (page: Page, path: string) => {
  await page.evaluate(() => localStorage.removeItem("tartan.offline-sync"));
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(async (p) => Boolean(await caches.match(p)), path), { timeout: 45_000 })
    .toBe(true);
};

test("au stade sans réseau, l'athlète ouvre sa séance, valide, et le coach le voit au retour du réseau", async ({
  page,
  browser,
}) => {
  await createCoachSpace(page, "Thomas");
  await createExercise(page, "Bonds du terrain");
  const link = await groupLink(page);
  const { page: athlete, context } = await joinAsAthlete(browser, link, "Léa");
  await publishSession(page, "Séance du stade", "Bonds du terrain");
  const sessionId = /\/seances\/([^/]+)/.exec(page.url())?.[1] as string;

  await keptOffline(athlete, `/seance/${sessionId}`);
  await context.setOffline(true);

  await athlete.goto("/aujourdhui");
  await expect(athlete.getByRole("heading", { name: "Séance du stade" })).toBeVisible();
  await athlete.getByRole("button", { name: "J'ai fait la séance", exact: true }).click();
  await expect(athlete.getByText(m.validation.queued)).toBeVisible();
  await athlete.getByRole("dialog").getByRole("button", { name: "Terminé" }).click();
  await expect(athlete.getByText(m.offline.pending(1))).toBeVisible();

  // La séance se rouvre, et une page jamais enregistrée explique la situation au lieu d'une erreur du navigateur.
  await athlete.goto(`/seance/${sessionId}`);
  await expect(athlete.getByRole("heading", { name: "Séance du stade" })).toBeVisible();
  await expect(athlete.getByText(m.validation.waitingSend)).toBeVisible();
  await athlete.goto("/reglages");
  await expect(athlete.getByRole("heading", { name: m.offline.title })).toBeVisible();

  await athlete.goto("/aujourdhui").catch(() => undefined);
  await context.setOffline(false);
  await expect(athlete.getByText(m.offline.pending(1))).toBeHidden({ timeout: 45_000 });
  await page.goto("/suivi");
  await expect(page.getByRole("link", { name: "Léa Test, Fait" })).toBeVisible();
  await context.close();
});

test("sur téléphone, le coach fait l'appel sans réseau et l'appel part au retour du réseau", async ({
  page,
  browser,
  context,
}) => {
  await createCoachSpace(page, "Sarah");
  await createExercise(page, "Fentes du terrain");
  const link = await groupLink(page);
  const { context: athleteContext } = await joinAsAthlete(browser, link, "Hugo");
  await publishSession(page, "Appel au stade", "Fentes du terrain");
  await expect(page).toHaveURL(/\/seances\/[^/]+\/suivi/);
  await page.waitForLoadState("networkidle");

  await context.setOffline(true);
  await page.getByRole("group", { name: "Présence de Hugo Test" }).getByRole("button", { name: "Absent" }).click();
  await page.getByRole("button", { name: m.coach.rollCallSave }).click();
  await expect(page.getByText(m.offline.rollCallQueued)).toBeVisible();
  await expect(page.getByText(m.offline.pending(1))).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(m.offline.pending(1))).toBeHidden({ timeout: 45_000 });
  await page.reload();
  await expect(
    page.getByRole("group", { name: "Présence de Hugo Test" }).getByRole("button", { name: "Absent" }),
  ).toHaveAttribute("aria-pressed", "true");
  await athleteContext.close();
});
