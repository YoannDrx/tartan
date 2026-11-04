import { expect, test, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, signUp, uniqueEmail } from "./helpers";
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
  // En développement, le service worker n'a pas tous les fichiers de la page : hors ligne, elle ne s'hydrate pas.
  test.skip(!process.env.E2E_PROD, "Parcours réservé au build de production, comme en CI.");
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
  // La file se relit après le chargement : sans cette attente, « disparu » serait vrai trop tôt.
  await expect(athlete.getByText(m.offline.pending(1))).toBeVisible();
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

test("un mineur est refusé, et le lien d'invitation reste valable", async ({ page }) => {
  await createCoachSpace(page, "Thomas");
  const link = await groupLink(page);
  await page.context().clearCookies();
  await page.goto(link);
  await signUp(page, uniqueEmail("jeune"), new URL(link).pathname);
  await page.getByLabel("Prénom").fill("Jeune");
  await page.getByLabel("Nom", { exact: true }).fill("Test");
  const year = new Date().getFullYear() - 13;
  await page.getByLabel("Date de naissance").fill(`${year}-05-12`);
  await expect(page.getByLabel(m.invite.guardianEmail)).toHaveCount(0);
  await page.getByRole("checkbox", { name: /conditions d'utilisation/ }).check();
  await page.getByRole("button", { name: "Rejoindre le groupe" }).click();
  await expect(page.getByRole("alert").filter({ hasText: m.age.restricted })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Salut Jeune" })).toHaveCount(0);
  // L'invitation n'est pas consommée : le lien marche encore pour quelqu'un d'autre.
  await page.context().clearCookies();
  await page.goto(link);
  await expect(page.getByRole("heading", { name: /t'invite à rejoindre/ })).toBeVisible();
});

test("un compte sans date confirme son âge avant d'entrer", async ({ page }) => {
  await signUp(page, uniqueEmail("sans-date"));
  await page.goto("/confirmer-age");
  await expect(page.getByRole("heading", { name: m.age.title })).toBeVisible();
  await page.getByRole("button", { name: m.age.confirm }).click();
  await expect(page.getByText(m.invite.birthRequired)).toBeVisible();
  await page.getByLabel("Date de naissance").fill("1985-03-14");
  await page.getByRole("button", { name: m.age.confirm }).click();
  await expect(page.getByRole("heading", { name: "Crée ton espace coach" })).toBeVisible({ timeout: 30_000 });
});

test("un titre tapé dès l'affichage du formulaire n'est pas perdu", async ({ page }) => {
  await createCoachSpace(page, "Thomas");
  for (let round = 0; round < 25; round += 1) {
    await page.goto("/seances/nouvelle", { waitUntil: "commit" });
    await page.getByLabel("Titre").locator("visible=true").fill(`Essai ${round}`);
    await page.waitForLoadState("networkidle");
    const field = page.getByLabel("Titre").locator("visible=true");
    await expect(field).toHaveValue(`Essai ${round}`);
    // Un identifiant « _r_ » trahit un formulaire refait côté client après coup.
    await expect(field).toHaveAttribute("id", /^_R_/);
  }
});
