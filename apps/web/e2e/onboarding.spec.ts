import path from "node:path";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import {
  closeTour,
  expectAccessible,
  expectNoHorizontalScroll,
  expectNoMotion,
  nextOnboardingStep,
  savedOnboarding,
  signInWithPassword,
  signUp,
  sqlQuery,
  uniqueEmail,
} from "./helpers";
import { createExercise, groupLink, joinAsAthlete, publishSession } from "./journeys";

// Les premiers pas, de bout en bout. Coach : création de l'espace et invitation au dernier temps, tour de piste
// refermé puis rouvert, carte « Pour démarrer » suivie jusqu'à la première validation, fête de fin. Athlète : accords
// expliqués, accueil un jour sans séance puis un jour de séance (la séance d'abord), validation, carte facultative.
// L'état est en base : il suit la personne d'un navigateur à l'autre.
const o = w.onboarding;
const WIDTHS = [390, 768, 1440];

// Captures de relecture : dans `ONBOARDING_SHOTS` (hors dépôt) quand il est donné, sinon avec les résultats du test.
const shotPath = (info: TestInfo, name: string) =>
  process.env.ONBOARDING_SHOTS
    ? path.join(process.env.ONBOARDING_SHOTS, `${info.project.name}-${name}.png`)
    : info.outputPath(`${name}.png`);

// Chaque étape regardée à 390, 768 et 1440 px : sans débordement, sans erreur axe.
const atWidths = async (page: Page, info: TestInfo, name: string) => {
  const initial = page.viewportSize();
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    await page.screenshot({ path: shotPath(info, `${name}-${width}`), fullPage: true });
  }
  if (initial) await page.setViewportSize(initial);
};

const phoneContext = (browser: Browser) =>
  browser.newContext({
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

const tourDialog = (page: Page) => page.getByRole("dialog", { name: o.tour.title });
const guideCard = (page: Page) => page.getByRole("region", { name: m.home.guidedTitle });
const lap = (page: Page) => guideCard(page).getByRole("progressbar");

test("un coach neuf crée son espace, invite, fait le tour et suit ses premiers pas jusqu'à la fête", async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== "desktop", "un parcours complet, largeurs posées à la main");
  test.setTimeout(300_000);
  const email = uniqueEmail("premierspas");
  await signUp(page, email);

  // Création de l'espace en trois temps, puis le dernier, facultatif : inviter le groupe sur place.
  await expect(page.getByRole("heading", { name: "Crée ton espace coach" })).toBeVisible({ timeout: 60_000 });
  await page.getByLabel("Prénom").fill("Camille");
  await page.getByLabel("Nom", { exact: true }).fill("Coach");
  await page.getByLabel("Date de naissance").fill("1985-03-14");
  await nextOnboardingStep(page);
  await page.getByLabel("Nom du club ou de ton coaching").fill("Coaching Camille");
  await page.getByLabel("Premier groupe", { exact: true }).fill("Hauteur Élite");
  await nextOnboardingStep(page);
  await page.getByRole("checkbox", { name: /conditions d'utilisation/ }).check();
  await page.getByRole("button", { name: "Créer mon espace" }).click();
  await page.getByRole("button", { name: m.age.saveConfirmed, exact: true }).click();

  await expect(page.getByRole("heading", { name: o.invite.title })).toBeFocused({ timeout: 60_000 });
  const link = page.getByLabel(o.invite.linkLabel);
  await expect(link).toHaveValue(/\/i\//);
  await page.getByRole("button", { name: o.invite.showQr }).click();
  await expect(page.getByRole("img", { name: w.settings.groupes.qrLabel("Hauteur Élite") })).toBeVisible();
  await page.getByLabel(o.invite.emailsLabel).fill("pas-une-adresse");
  await page.getByRole("button", { name: o.invite.send }).click();
  await expect(page.getByText(o.invite.invalid("pas-une-adresse"))).toBeVisible();
  await page.getByLabel(o.invite.emailsLabel).fill(`${uniqueEmail("lea")}, ${uniqueEmail("noe")}`);
  await page.getByRole("button", { name: o.invite.send }).click();
  await expect(page.getByText(o.invite.sent(2))).toBeVisible();
  await atWidths(page, info, "coach-1-inviter");
  await page.getByRole("button", { name: o.invite.finish, exact: true }).click();

  // L'arrivée : le tour de piste s'ouvre seul, une étape par fonction, au clavier comme au clic.
  // Le dialogue garde le focus : sous lui, le suivi est inerte (aria-hidden), mais déjà là.
  await page.waitForURL(/\/suivi$/, { timeout: 60_000 });
  const tour = tourDialog(page);
  await expect(tour).toBeVisible({ timeout: 60_000 });
  await expect(tour.getByRole("heading", { name: o.tour.features.suivi.title })).toBeVisible();
  await atWidths(page, info, "coach-2-tour");
  await tour.getByRole("button", { name: o.tour.next }).click();
  await expect(tour.getByRole("heading", { name: o.tour.features.calendrier.title })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(tour.getByRole("heading", { name: o.tour.features.exercices.title })).toBeVisible();
  await expect(tour.getByRole("img", { name: o.tour.features.exercices.alt })).toBeVisible();
  await tour.getByRole("button", { name: o.tour.goToStep(7, o.tour.features.annonces.title) }).click();
  await expect(tour.getByText(o.tour.progress(7, 7))).toBeVisible();
  await expect(tour.getByRole("button", { name: o.tour.finish })).toBeVisible();
  // Le focus reste dans le dialogue ; Échap le referme à tout moment.
  await page.keyboard.press("Tab");
  expect(await tour.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await closeTour(page);
  // Le repère de l'écran, une phrase sous le bandeau, à la première visite seulement.
  const hint = page.getByRole("note", { name: o.hint.label });
  await expect(hint).toContainText(m.help.screens.suivi[0]!);
  await atWidths(page, info, "coach-3-repere");

  // Refermé une fois, il ne revient pas seul, même rechargé ; il se rouvre depuis l'aide.
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Suivi du groupe" })).toBeVisible();
  await expect(tour).toHaveCount(0);
  await page.getByRole("button", { name: m.nav.reglages, exact: true }).click();
  await page.getByRole("menuitem", { name: m.help.screen.open, exact: true }).click();
  await page.getByRole("button", { name: o.tour.reopen }).click();
  await expect(tour).toBeVisible();
  await tour.getByRole("button", { name: m.common.close }).click();
  await expect(tour).toBeHidden();

  // La carte : la part courue en tour de piste et en toutes lettres. L'invitation du dernier temps compte déjà.
  const card = guideCard(page);
  await expect(card).toBeVisible();
  await expect(lap(page)).toHaveAccessibleName(o.guide.lap(1, 5));
  await expect(card.getByText(o.guide.lap(1, 5))).toBeVisible();
  await expect(card.locator("[aria-current=step]")).toContainText(m.firstSteps.steps.profile);
  // Pas de grille vide : un état qui dit quoi faire.
  await expect(page.getByText(o.emptyGroup)).toBeVisible();
  await atWidths(page, info, "coach-4-carte");

  // L'invitation est faite ; « essaie avec ton propre téléphone » ouvre sur place le lien et le QR code du groupe.
  await card.getByRole("button", { name: o.guide.steps.validate.action }).click();
  await expect(card.getByLabel(o.invite.linkLabel)).toHaveValue(/\/i\//);
  await expect(card.getByRole("img", { name: w.settings.groupes.qrLabel("Hauteur Élite") })).toBeVisible();

  // Refermer la carte, la retrouver dans le menu et sur la page des premiers pas, la remettre.
  await card.getByRole("button", { name: o.guide.closeLabel }).click();
  await expect(page.getByText(o.guide.closed)).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(guideCard(page)).toHaveCount(0);
  await page.getByRole("button", { name: m.nav.reglages, exact: true }).click();
  await page.getByRole("menuitem", { name: o.menu }).click();
  await expect(page.getByRole("heading", { level: 1, name: o.page.title })).toBeVisible();
  await expect(page.getByRole("region", { name: o.page.featuresTitle }).getByRole("listitem")).toHaveCount(7);
  await atWidths(page, info, "coach-5-premiers-pas");
  await page.getByRole("button", { name: o.guide.reopen }).click();
  await expect(page.getByText(o.guide.reopened)).toBeVisible();

  // Écarter une étape facultative, puis la reprendre.
  const optional = page.getByRole("region", { name: o.guide.optionalTitle });
  await optional.getByRole("button", { name: o.guide.skipLabel(m.firstSteps.optional.phase) }).click();
  await expect(optional.getByRole("button", { name: o.guide.unskipLabel(m.firstSteps.optional.phase) })).toBeVisible();

  // Créer, publier : la carte avance d'après les faits.
  await createExercise(page, "Bonds des premiers pas");
  await publishSession(page, "Séance des premiers pas", "Bonds des premiers pas");
  await page.goto("/suivi", { waitUntil: "networkidle" });
  await expect(lap(page)).toHaveAccessibleName(o.guide.lap(3, 5));
  await expect(guideCard(page).locator("[aria-current=step]")).toContainText(m.firstSteps.steps.profile);

  // La photo se dépose dans le stockage des fichiers, absent des parcours : la base la reçoit directement.
  await sqlQuery(
    `update profiles set avatar_url = 'https://exemple.test/photo.png' where id = (select id from "user" where email = $1)`,
    [email],
  );
  await page.reload({ waitUntil: "networkidle" });
  await expect(guideCard(page).locator("[aria-current=step]")).toContainText(m.firstSteps.steps.validate);
  await expect(guideCard(page)).toContainText(o.guide.steps.validate.detail);

  // « Essaie avec ton propre téléphone » : l'athlète rejoint par le lien, valide la séance du jour.
  const athlete = await joinAsAthlete(browser, await groupLink(page), "Essai");
  try {
    await athlete.page.getByRole("button", { name: m.today.quickDone, exact: true }).click();
    await expect(athlete.page.getByRole("dialog", { name: m.today.validated })).toBeVisible();
  } finally {
    await athlete.context.close();
  }

  // La fin des premiers pas se fête une fois, puis la carte s'efface.
  const celebrated = savedOnboarding(page, "celebrated");
  await page.goto("/suivi", { waitUntil: "networkidle" });
  const party = page.getByRole("dialog", { name: o.celebration.title });
  await celebrated;
  await expect(party).toBeVisible();
  await atWidths(page, info, "coach-6-fete");
  await party.getByRole("button", { name: o.celebration.action }).click();
  await expect(party).toBeHidden();
  await expect(guideCard(page)).toHaveCount(0);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("dialog", { name: o.celebration.title })).toHaveCount(0);

  // Un autre navigateur : rien ne revient, ni le tour, ni la fête, ni le repère déjà vu.
  const other = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
  try {
    const second = await other.newPage();
    await signInWithPassword(second, email);
    await second.goto("/suivi", { waitUntil: "networkidle" });
    await expect(second.getByRole("heading", { name: "Suivi du groupe" })).toBeVisible();
    await expect(tourDialog(second)).toHaveCount(0);
    await expect(second.getByRole("dialog", { name: o.celebration.title })).toHaveCount(0);
    await expect(second.getByRole("note", { name: o.hint.label })).toHaveCount(0);
    await expect(guideCard(second)).toHaveCount(0);
  } finally {
    await other.close();
  }
});

test("le tour de piste, en mouvement réduit, ne bouge pas et garde le focus", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "le téléphone suffit : le dialogue devient une feuille");
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUp(page, uniqueEmail("mouvement"));
  await expect(page.getByRole("heading", { name: "Crée ton espace coach" })).toBeVisible({ timeout: 60_000 });
  await page.getByLabel("Prénom").fill("Sacha");
  await page.getByLabel("Nom", { exact: true }).fill("Coach");
  await page.getByLabel("Date de naissance").fill("1985-03-14");
  await nextOnboardingStep(page);
  await page.getByLabel("Nom du club ou de ton coaching").fill("Coaching Sacha");
  await page.getByLabel("Premier groupe", { exact: true }).fill("Hauteur Élite");
  await nextOnboardingStep(page);
  await page.getByRole("checkbox", { name: /conditions d'utilisation/ }).check();
  await page.getByRole("button", { name: "Créer mon espace" }).click();
  await page.getByRole("button", { name: m.age.saveConfirmed, exact: true }).click();
  await expect(page.getByRole("heading", { name: o.invite.title })).toBeVisible({ timeout: 60_000 });
  await expectNoMotion(page);
  await page.getByRole("button", { name: o.invite.finish, exact: true }).click();
  const tour = tourDialog(page);
  await expect(tour).toBeVisible({ timeout: 60_000 });
  await expectNoMotion(page);
  await tour.getByRole("button", { name: o.tour.next }).click();
  await tour.getByRole("button", { name: o.tour.next }).click();
  await expectNoMotion(page);
  await expectAccessible(page);
  await closeTour(page);
  await expect(guideCard(page)).toBeVisible();
  await expectNoMotion(page);
});

test("un athlète neuf rejoint, est accueilli sans que rien ne retarde sa séance, puis voit la carte facultative", async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== "desktop", "l'athlète est sur téléphone dans son propre contexte");
  test.setTimeout(300_000);
  // Le coach, rapidement : son espace et le lien du groupe.
  await signUp(page, uniqueEmail("coachaccueil"));
  await expect(page.getByRole("heading", { name: "Crée ton espace coach" })).toBeVisible({ timeout: 60_000 });
  await page.getByLabel("Prénom").fill("Jules");
  await page.getByLabel("Nom", { exact: true }).fill("Coach");
  await page.getByLabel("Date de naissance").fill("1985-03-14");
  await nextOnboardingStep(page);
  await page.getByLabel("Nom du club ou de ton coaching").fill("Coaching Jules");
  await page.getByLabel("Premier groupe", { exact: true }).fill("Hauteur Élite");
  await nextOnboardingStep(page);
  await page.getByRole("checkbox", { name: /conditions d'utilisation/ }).check();
  await page.getByRole("button", { name: "Créer mon espace" }).click();
  await page.getByRole("button", { name: m.age.saveConfirmed, exact: true }).click();
  await page.getByRole("button", { name: o.invite.finish, exact: true }).click({ timeout: 60_000 });
  await closeTour(page);
  const invitation = await groupLink(page);

  // Les accords, expliqués en une phrase chacun, sur la page d'invitation.
  const context = await phoneContext(browser);
  const athlete = await context.newPage();
  const email = uniqueEmail("nina");
  try {
    await athlete.goto(new URL(invitation).pathname, { waitUntil: "networkidle" });
    await signUp(athlete, email, new URL(invitation).pathname);
    await expect(athlete.getByText(m.invite.consentsTitle)).toBeVisible();
    await expect(athlete.getByText(m.invite.consentHealthWhy)).toBeVisible();
    await expect(athlete.getByText(m.invite.consentVideoWhy)).toBeVisible();
    await athlete.getByLabel("Prénom").fill("Nina");
    await athlete.getByLabel("Nom", { exact: true }).fill("Test");
    await athlete.getByLabel("Date de naissance").fill("2004-05-12");
    await athlete.getByRole("checkbox", { name: /conditions d'utilisation/ }).check();
    await athlete.getByRole("checkbox", { name: /informations de santé/ }).check();
    await atWidths(athlete, info, "athlete-1-accords");
    await athlete.getByRole("button", { name: "Rejoindre le groupe" }).click();
    await athlete.getByRole("button", { name: m.age.saveConfirmed, exact: true }).click();
    await expect(athlete.getByRole("heading", { name: "Salut Nina" })).toBeVisible();

    // Un jour sans séance : l'accueil en trois panneaux, signé du coach.
    const welcome = athlete.getByRole("region", { name: m.athleteWelcome.title("Hauteur Élite") });
    await expect(welcome).toBeVisible();
    await expect(welcome.getByRole("list", { name: m.athleteWelcome.panelsLabel }).getByRole("listitem")).toHaveCount(
      3,
    );
    await expect(welcome).toContainText(m.athleteWelcome.panels.videos.body("Jules"));
    await atWidths(athlete, info, "athlete-2-accueil-sans-seance");

    // Refermé d'un geste, il ne revient sur aucun appareil.
    const welcomeSaved = savedOnboarding(athlete, "welcomeSeen");
    await welcome.getByRole("button", { name: m.athleteWelcome.dismiss }).click();
    await expect(welcome).toHaveCount(0);
    await welcomeSaved;
    const other = await phoneContext(browser);
    try {
      const second = await other.newPage();
      await signInWithPassword(second, email);
      await second.goto("/aujourdhui", { waitUntil: "networkidle" });
      await expect(second.getByRole("heading", { name: "Salut Nina" })).toBeVisible();
      await expect(second.getByRole("region", { name: m.athleteWelcome.title("Hauteur Élite") })).toHaveCount(0);
    } finally {
      await other.close();
    }
  } finally {
    await context.close();
  }

  // Un autre athlète neuf, un jour de séance : la séance d'abord, l'accueil n'est qu'une ligne dessous.
  await createExercise(page, "Bonds de l'accueil");
  await publishSession(page, "Séance de l'accueil", "Bonds de l'accueil");
  const malo = await joinAsAthlete(browser, invitation, "Malo");
  const runner = malo.page;
  try {
    const validate = runner.getByRole("button", { name: m.today.quickDone, exact: true });
    const discover = runner.getByRole("button", { name: m.athleteWelcome.discover });
    await expect(validate).toBeVisible();
    await expect(discover).toBeVisible();
    await expect(runner.getByRole("region", { name: m.athleteWelcome.title("Hauteur Élite") })).toHaveCount(0);
    // Dans l'ordre de lecture, la ligne vient après la carte de séance et son bouton de validation.
    expect(
      await validate.evaluate((button, label) => {
        const buttons = [...document.querySelectorAll("button")];
        return buttons.findIndex((node) => node.textContent === label) > buttons.indexOf(button as HTMLButtonElement);
      }, m.athleteWelcome.discover),
    ).toBe(true);
    // L'installation est proposée dès ce jour de séance.
    await expect.poll(() => runner.evaluate(() => localStorage.getItem("tartan.install-ready"))).toBe("true");
    await atWidths(runner, info, "athlete-3-jour-de-seance");
    await discover.click();
    await expect(runner.getByRole("region", { name: m.athleteWelcome.title("Hauteur Élite") })).toBeVisible();
    await atWidths(runner, info, "athlete-4-decouvrir");

    // La validation, mesurée depuis l'arrivée sur l'écran : un seul geste, sous dix secondes, sans étape de plus.
    const started = Date.now();
    await runner.goto("/aujourdhui", { waitUntil: "domcontentloaded" });
    let gestures = 0;
    await validate.click();
    gestures += 1;
    await expect(runner.getByRole("dialog", { name: m.today.validated })).toBeVisible();
    const elapsed = Date.now() - started;
    console.log(`Arrivée sur /aujourdhui jusqu'à la validation confirmée : ${elapsed} ms, ${gestures} geste`);
    expect(gestures).toBe(1);
    expect(elapsed).toBeLessThan(10_000);
    await runner.getByRole("button", { name: m.validation.finish }).click();

    // Après la première validation : la carte facultative, refermée pour de bon.
    await runner.reload({ waitUntil: "networkidle" });
    const extras = runner.getByRole("region", { name: m.athleteExtras.title });
    await expect(extras).toBeVisible();
    await expect(extras).toContainText(m.athleteExtras.photoTitle);
    await atWidths(runner, info, "athlete-5-carte-facultative");
    const extrasSaved = savedOnboarding(runner, "dismissed");
    await extras.getByRole("button", { name: m.athleteExtras.close }).click();
    await expect(extras).toHaveCount(0);
    await extrasSaved;
    await runner.reload({ waitUntil: "networkidle" });
    await expect(runner.getByRole("region", { name: m.athleteExtras.title })).toHaveCount(0);

    // En mouvement réduit, rien ne bouge sur l'accueil.
    await runner.emulateMedia({ reducedMotion: "reduce" });
    await runner.goto("/aujourdhui", { waitUntil: "networkidle" });
    await expectNoMotion(runner);
  } finally {
    await malo.context.close();
  }
});
