import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import {
  PASSWORD,
  completeCoachOnboarding,
  createCoachSpace,
  expectAccessible,
  expectNoHorizontalScroll,
  signInWithPassword,
  signOutFromSettings,
  sqlQuery,
  uniqueEmail,
} from "./helpers";
import { groupLink } from "./journeys";
import { emailLink, subjectsFor } from "./mail";

// Le mot de passe, pour le coach comme pour l'athlète : le définir à l'inscription, après une invitation ou dans
// les réglages, puis revenir au choix par ce mot de passe ou par le lien reçu par e-mail.
// Les liens suivis ici sont ceux des vrais e-mails, relus dans le dossier que le serveur des parcours remplit.
// Tout se joue à 390 px, la largeur de conception, et chaque écran passe axe.
const PHONE = { width: 390, height: 844 };
test.use({ viewport: PHONE });
// Chaque parcours crée ses comptes et les mène de bout en bout : une fois suffit, sur le projet téléphone.
test.beforeEach(({}, info) => test.skip(info.project.name !== "mobile"));

const NEW_PASSWORD = "nouveau-mot-de-passe-e2e";
const s = w.auth.sent;
const c = w.settings.connexion;

// L'écran tient à 390 px, sans erreur axe.
const expectScreen = async (page: Page) => {
  expect(page.viewportSize()?.width).toBe(PHONE.width);
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
};

const phoneContext = (browser: Browser) =>
  browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris", viewport: PHONE, hasTouch: true, isMobile: true });

// Demande un lien de connexion depuis l'écran, puis l'ouvre : ce que fait la personne avec sa boîte mail.
const signInWithLink = async (page: Page, email: string, next = "/connexion", sentBefore = 0) => {
  await page.goto(next, { waitUntil: "networkidle" });
  await page.getByLabel(m.auth.emailLabel).fill(email);
  await page.getByRole("button", { name: w.auth.signIn.withLink, exact: true }).click();
  await expect(page.getByRole("heading", { name: s.magicTitle })).toBeVisible();
  // L'écran rappelle l'adresse à laquelle le lien est parti.
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  const link = await emailLink(email, m.email.subjects.magicLink, sentBefore + 1);
  await page.goto(link, { waitUntil: "networkidle" });
};

// Un athlète invité qui entre par le lien reçu par e-mail, sans mot de passe.
const joinByLink = async (browser: Browser, invitation: string, firstName: string) => {
  const context = await phoneContext(browser);
  const page = await context.newPage();
  const email = uniqueEmail(firstName);
  await page.goto(new URL(invitation).pathname, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: /t'invite à rejoindre/ })).toBeVisible();
  await page.getByLabel(m.auth.emailLabel).fill(email);
  await page.getByRole("button", { name: w.auth.create.withLink, exact: true }).click();
  await expect(page.getByRole("heading", { name: s.magicTitle })).toBeVisible();
  // Le lien ramène à l'invitation, connecté.
  await page.goto(await emailLink(email, m.email.subjects.magicLink), { waitUntil: "networkidle" });
  await page.getByLabel("Prénom").fill(firstName);
  await page.getByLabel("Nom", { exact: true }).fill("Test");
  await page.getByLabel("Date de naissance").fill("2004-05-12");
  await page.getByRole("checkbox", { name: /conditions d'utilisation/ }).check();
  await page.getByRole("button", { name: "Rejoindre le groupe" }).click();
  await page.getByRole("button", { name: m.age.saveConfirmed, exact: true }).click();
  await expect(page.getByRole("heading", { name: `Salut ${firstName}` })).toBeVisible();
  return { context, page, email };
};

const promptCard = (page: Page) => page.getByRole("region", { name: w.auth.prompt.title });
const passwordRow = (page: Page) => page.locator("#moyens").getByRole("listitem").filter({ hasText: c.password });

const signedOut = async (context: BrowserContext) =>
  expect.poll(async () => (await context.request.get("/api/v1/me")).status()).toBe(401);

test("un coach s'inscrit avec un mot de passe, confirme son adresse, puis revient par mot de passe et par lien", async ({
  page,
}) => {
  const email = uniqueEmail("coach-mot-de-passe");

  // En mode création, l'adresse d'abord, puis deux chemins visibles ; l'action principale crée le compte.
  await page.goto("/connexion?creer=1", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Crée ton espace coach" })).toBeVisible();
  await expect(page.getByRole("button", { name: w.auth.create.withPassword, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: w.auth.create.withLink, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: w.auth.signIn.submit, exact: true })).toHaveCount(0);
  await expectScreen(page);

  // Une adresse mal écrite se corrige à côté du champ, sans rien envoyer.
  await page.getByLabel(m.auth.emailLabel).fill("camille");
  await page.getByRole("button", { name: w.auth.create.withPassword, exact: true }).click();
  await expect(page.getByText(w.auth.emailInvalid)).toBeVisible();
  await page.getByLabel(m.auth.emailLabel).fill(email);
  await page.getByRole("button", { name: w.auth.create.withPassword, exact: true }).click();

  // Un mot de passe trop court est refusé à côté du champ, et la saisie reste.
  const password = page.getByLabel(w.auth.create.passwordLabel, { exact: true });
  await expect(password).toBeFocused();
  await password.fill("court");
  await page.getByRole("button", { name: w.auth.create.submit, exact: true }).click();
  await expect(page.getByText(w.auth.passwordTooShort(10))).toBeVisible();
  await expect(password).toHaveValue("court");
  await expectScreen(page);
  await password.fill(PASSWORD);
  await page.getByRole("button", { name: w.auth.create.submit, exact: true }).click();

  // L'écran d'attente : l'adresse saisie, le renvoi, le changement d'adresse, quoi faire si rien n'arrive.
  await expect(page.getByRole("heading", { name: s.verifyTitle })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: s.changeEmail })).toBeVisible();
  await expect(page.getByRole("heading", { name: s.helpTitle })).toBeVisible();
  await expectScreen(page);

  // Tant que l'adresse n'est pas confirmée, le mot de passe n'ouvre rien : l'écran d'attente revient, avec le renvoi.
  await page.goto("/connexion", { waitUntil: "networkidle" });
  await page.getByLabel(m.auth.emailLabel).fill(email);
  await page.getByRole("button", { name: w.auth.signIn.withPassword, exact: true }).click();
  await page.getByLabel(w.auth.signIn.passwordLabel, { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: w.auth.signIn.submit, exact: true }).click();
  await expect(page.getByText(s.verifyFirst)).toBeVisible();
  expect((await page.request.get("/api/v1/me")).status()).toBe(401);

  // Le lien de confirmation, celui de l'e-mail, connecte et mène à la création de l'espace.
  await page.goto(await emailLink(email, m.email.subjects.verify), { waitUntil: "networkidle" });
  await completeCoachOnboarding(page, "Camille");

  // Déconnexion, puis une page de l'application : la connexion garde la page demandée.
  await signOutFromSettings(page);
  await page.goto("/calendrier");
  await expect(page).toHaveURL(/\/connexion\?next=%2Fcalendrier$/);
  await expect(page.getByRole("button", { name: w.auth.signIn.withPassword, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: w.auth.signIn.withLink, exact: true })).toBeVisible();
  await expectScreen(page);

  // Retour par mot de passe : on retrouve la page demandée.
  await signInWithPassword(page, email, "/connexion?next=%2Fcalendrier");
  await expect(page).toHaveURL(/\/calendrier$/);
  expect((await page.request.get("/api/v1/me")).status()).toBe(200);

  // Retour par le lien : même compte, même page demandée.
  await signOutFromSettings(page);
  await signInWithLink(page, email, "/connexion?next=%2Fcalendrier");
  await expect(page).toHaveURL(/\/calendrier$/);
  expect((await (await page.request.get("/api/v1/me")).json()).email).toBe(email);
});

test("un athlète invité entre par le lien, définit son mot de passe à l'accueil, puis revient des deux façons", async ({
  page,
  browser,
}) => {
  await createCoachSpace(page, "Thomas");
  const invitation = await groupLink(page);

  // L'invitation propose de créer un compte par mot de passe ou par lien, et de dire qu'on a déjà un compte.
  const visitor = await (await phoneContext(browser)).newPage();
  await visitor.goto(new URL(invitation).pathname, { waitUntil: "networkidle" });
  await expect(visitor.getByRole("button", { name: w.auth.create.withPassword, exact: true })).toBeVisible();
  await expect(visitor.getByRole("button", { name: w.auth.create.withLink, exact: true })).toBeVisible();
  await expectScreen(visitor);
  await visitor.getByRole("button", { name: w.auth.haveAccount }).click();
  await expect(visitor.getByRole("button", { name: w.auth.signIn.withPassword, exact: true })).toBeVisible();
  await visitor.context().close();

  const { page: athlete, context, email } = await joinByLink(browser, invitation, "Lina");

  // L'accueil est là tout de suite ; la proposition est une carte parmi les autres, pas un passage obligé.
  await expect(athlete.getByRole("dialog")).toHaveCount(0);
  await expect(promptCard(athlete)).toBeVisible();
  await expectScreen(athlete);

  await promptCard(athlete).getByRole("button", { name: w.auth.prompt.open }).click();
  const field = athlete.getByLabel(w.auth.prompt.field, { exact: true });
  await field.fill("court");
  await athlete.getByRole("button", { name: w.auth.prompt.submit }).click();
  await expect(athlete.getByText(w.auth.passwordTooShort(10))).toBeVisible();
  await expectScreen(athlete);
  await field.fill(PASSWORD);
  await athlete.getByRole("button", { name: w.auth.prompt.submit }).click();
  await expect(athlete.getByText(w.auth.prompt.done)).toBeVisible();
  await expect(promptCard(athlete)).toHaveCount(0);
  // Un e-mail prévient que le compte a maintenant un mot de passe.
  await emailLink(email, w.auth.emails.passwordSet.subject);

  // La proposition ne revient pas, et les réglages disent que le mot de passe est défini.
  await athlete.reload({ waitUntil: "networkidle" });
  await expect(athlete.getByRole("heading", { name: "Salut Lina" })).toBeVisible();
  await expect(promptCard(athlete)).toHaveCount(0);

  // Retour par mot de passe.
  await signOutFromSettings(athlete);
  await signInWithPassword(athlete, email);
  await expect(athlete.getByRole("heading", { name: "Salut Lina" })).toBeVisible();

  // Retour par le lien : le deuxième lien de connexion reçu par cette adresse.
  await signOutFromSettings(athlete);
  await signInWithLink(athlete, email, "/connexion", 1);
  await expect(athlete.getByRole("heading", { name: "Salut Lina" })).toBeVisible();
  await context.close();
});

test("la proposition refermée ne revient sur aucun appareil, et les réglages permettent de définir le mot de passe", async ({
  page,
  browser,
}) => {
  await createCoachSpace(page, "Thomas");
  const invitation = await groupLink(page);
  const { page: athlete, context, email } = await joinByLink(browser, invitation, "Nora");

  await promptCard(athlete).getByRole("button", { name: w.auth.prompt.dismiss }).click();
  await expect(athlete.getByText(w.auth.prompt.dismissed)).toBeVisible();
  await expect(promptCard(athlete)).toHaveCount(0);
  await athlete.reload({ waitUntil: "networkidle" });
  await expect(promptCard(athlete)).toHaveCount(0);

  // Un autre appareil, connecté par un nouveau lien : la proposition reste refermée.
  const other = await phoneContext(browser);
  const second = await other.newPage();
  await signInWithLink(second, email, "/connexion", 1);
  await expect(second.getByRole("heading", { name: "Salut Nora" })).toBeVisible();
  await expect(promptCard(second)).toHaveCount(0);

  // Les réglages montrent les moyens du compte : le lien, et aucun mot de passe.
  await second.goto("/reglages/connexion", { waitUntil: "networkidle" });
  await expect(second.getByRole("heading", { name: c.methods })).toBeVisible();
  await expect(passwordRow(second)).toContainText(c.passwordOff);
  await expect(second.getByRole("heading", { name: c.define.title })).toBeVisible();
  await expectScreen(second);

  // Session récente : le mot de passe se définit sur place.
  await second.getByLabel(c.define.field, { exact: true }).fill(PASSWORD);
  await second.getByRole("button", { name: c.define.submit }).click();
  await expect(second.getByText(c.define.done)).toBeVisible();
  await expect(passwordRow(second)).toContainText(c.passwordOn);
  await expect(second.getByRole("heading", { name: c.change.title })).toBeVisible();
  await expectScreen(second);
  await emailLink(email, w.auth.emails.passwordSet.subject);

  // Il ouvre bien le compte.
  await signOutFromSettings(second);
  await signInWithPassword(second, email);
  await expect(second.getByRole("heading", { name: "Salut Nora" })).toBeVisible();
  await other.close();
  await context.close();
});

test("session ancienne : définir un mot de passe demande d'abord une confirmation par e-mail", async ({
  page,
  browser,
}) => {
  await createCoachSpace(page, "Thomas");
  const invitation = await groupLink(page);
  const { page: athlete, context, email } = await joinByLink(browser, invitation, "Ines");

  // La connexion date de deux jours : ce n'est plus une preuve suffisante pour poser un accès durable.
  await sqlQuery(
    `update session set created_at = now() - interval '2 days' where user_id = (select id from "user" where email = $1)`,
    [email],
  );
  await athlete.goto("/reglages/connexion", { waitUntil: "networkidle" });
  await expect(athlete.getByText(c.define.confirmLead)).toBeVisible();
  // Aucun champ de mot de passe avant la confirmation : rien ne se saisit pour rien.
  await expect(athlete.getByLabel(c.define.field, { exact: true })).toHaveCount(0);
  await expectScreen(athlete);
  await athlete.getByRole("button", { name: c.define.confirmCta }).click();
  await expect(athlete.getByText(c.define.confirmSent(email))).toBeVisible();
  await expectScreen(athlete);

  // Le lien de confirmation rouvre une session fraîche, sur la rubrique, formulaire prêt.
  const link = await emailLink(email, w.auth.emails.confirmSetup.subject);
  await athlete.goto(link, { waitUntil: "networkidle" });
  await expect(athlete).toHaveURL(/\/reglages\/connexion\?definir=1$/);
  await expect(athlete.getByText(c.define.confirmed)).toBeVisible();
  await expectScreen(athlete);
  await athlete.getByLabel(c.define.field, { exact: true }).fill(PASSWORD);
  await athlete.getByRole("button", { name: c.define.submit }).click();
  await expect(athlete.getByText(c.define.done)).toBeVisible();
  await expect(passwordRow(athlete)).toContainText(c.passwordOn);

  // Un lien déjà utilisé ne sert pas deux fois : la rubrique le dit.
  await athlete.goto(link, { waitUntil: "networkidle" });
  await expect(athlete.getByText(w.auth.linkExpired)).toBeVisible();
  await context.close();
});

test("le mot de passe se change, un mauvais mot de passe actuel est refusé, les autres appareils sont déconnectés", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail("changer");
  await createCoachSpace(page, "Chloé", email);

  // Un deuxième appareil connecté au même compte.
  const other = await phoneContext(browser);
  const second = await other.newPage();
  await signInWithPassword(second, email);
  expect((await other.request.get("/api/v1/me")).status()).toBe(200);

  await page.goto("/reglages/connexion", { waitUntil: "networkidle" });
  await expect(passwordRow(page)).toContainText(c.passwordOn);
  await expect(page.getByRole("heading", { name: c.change.title })).toBeVisible();
  await expectScreen(page);

  // Mauvais mot de passe actuel : refus à côté du champ, rien ne change.
  await page.getByLabel(c.change.current, { exact: true }).fill("pas-le-bon-mot-de-passe");
  await page.getByLabel(c.change.next, { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: c.change.submit }).click();
  await expect(page.getByText(w.auth.errors.wrongCurrent)).toBeVisible();
  await expect(page.getByLabel(c.change.current, { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expectScreen(page);
  expect(await subjectsFor(email)).not.toContain(m.email.passwordChanged.subject);

  // Bon mot de passe actuel, avec la déconnexion des autres appareils.
  await page.getByLabel(c.change.current, { exact: true }).fill(PASSWORD);
  await page.getByRole("checkbox", { name: c.change.revoke }).check();
  await page.getByRole("button", { name: c.change.submit }).click();
  await expect(page.getByText(c.change.doneRevoked)).toBeVisible();
  await emailLink(email, m.email.passwordChanged.subject);
  // Cet appareil reste connecté, l'autre ne l'est plus.
  expect((await page.request.get("/api/v1/me")).status()).toBe(200);
  await signedOut(other);
  await other.close();

  // L'ancien mot de passe n'ouvre plus rien, le nouveau si.
  await signOutFromSettings(page);
  await page.goto("/connexion", { waitUntil: "networkidle" });
  await page.getByLabel(m.auth.emailLabel).fill(email);
  await page.getByRole("button", { name: w.auth.signIn.withPassword, exact: true }).click();
  await page.getByLabel(w.auth.signIn.passwordLabel, { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: w.auth.signIn.submit, exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: w.auth.invalidCredentials })).toBeVisible();
  await expectScreen(page);
  await signInWithPassword(page, email, "/connexion", NEW_PASSWORD);
  await expect(page.getByRole("heading", { name: "Suivi du groupe" })).toBeVisible();
});

test("les limites de débit sont tenues : cinq essais de changement, puis le refus dit d'attendre", async ({ page }) => {
  const email = uniqueEmail("limite");
  await createCoachSpace(page, "Hugo", email);
  await page.goto("/reglages/connexion", { waitUntil: "networkidle" });
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await page.getByLabel(c.change.current, { exact: true }).fill(`faux-mot-de-passe-${attempt}`);
    await page.getByLabel(c.change.next, { exact: true }).fill(NEW_PASSWORD);
    await page.getByRole("button", { name: c.change.submit }).click();
    await expect(page.getByText(w.auth.errors.wrongCurrent)).toBeVisible();
    await expect(page.getByRole("button", { name: c.change.submit })).toBeEnabled();
  }
  // Sixième essai, avec le bon mot de passe : refusé quand même, et le mot de passe n'a pas changé.
  await page.getByLabel(c.change.current, { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: c.change.submit }).click();
  await expect(page.getByRole("alert").filter({ hasText: w.auth.errors.tooManyAttempts })).toBeVisible();
  await expectScreen(page);
  // La même limite répond sur l'API que le mobile appellera.
  const api = await page.request.patch("/api/v1/me/password", {
    data: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
  });
  expect(api.status()).toBe(429);
  await signOutFromSettings(page);
  await signInWithPassword(page, email);
  await expect(page.getByRole("heading", { name: "Suivi du groupe" })).toBeVisible();
});

test("lien envoyé : le renvoi attend, repart vraiment, et un refus du serveur est dit clairement", async ({ page }) => {
  const email = uniqueEmail("renvoi");
  await page.clock.install();
  await page.goto("/connexion", { waitUntil: "networkidle" });
  await page.getByLabel(m.auth.emailLabel).fill(email);
  await page.getByRole("button", { name: w.auth.signIn.withLink, exact: true }).click();
  await expect(page.getByRole("heading", { name: s.magicTitle })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await emailLink(email, m.email.subjects.magicLink);

  // Le renvoi n'est pas disponible tout de suite : il dit combien de temps attendre.
  const resend = page.getByRole("button", { name: /^Renvoyer le lien/ });
  await expect(resend).toBeDisabled();
  await expect(resend).toHaveText(/dans \d+ s/);
  await expectScreen(page);
  await page.clock.runFor(31_000);
  await expect(resend).toBeEnabled();
  await expect(resend).toHaveText(s.resend);

  // Il envoie un deuxième vrai lien, puis attend de nouveau.
  await resend.click();
  await expect(page.getByText(s.resent)).toBeVisible();
  await emailLink(email, m.email.subjects.magicLink, 2);
  await expect(resend).toBeDisabled();

  // Le serveur refuse (limite de débit) : l'écran le dit et fait attendre la minute entière.
  await page.route("**/api/auth/sign-in/magic-link", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ message: "Too many requests" }),
    }),
  );
  await page.clock.runFor(31_000);
  await resend.click();
  await expect(page.getByText(s.resendLimited)).toBeVisible();
  await expect(resend).toBeDisabled();
  await page.clock.runFor(31_000);
  await expect(resend).toBeDisabled();
  await expectScreen(page);
  await page.unroute("**/api/auth/sign-in/magic-link");

  // Changer d'adresse ramène au formulaire, l'adresse saisie toujours là.
  await page.getByRole("button", { name: s.changeEmail }).click();
  await expect(page.getByLabel(m.auth.emailLabel)).toHaveValue(email);
  await expect(page.getByRole("button", { name: w.auth.signIn.withLink, exact: true })).toBeVisible();

  // Une limite atteinte dès la première demande se lit dans le formulaire.
  await page.route("**/api/auth/sign-in/magic-link", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ message: "Too many requests" }),
    }),
  );
  await page.getByRole("button", { name: w.auth.signIn.withLink, exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: w.auth.rateLimited })).toBeVisible();
});

test("créer un compte sur une adresse déjà inscrite ne révèle rien à l'écran", async ({ page, browser }) => {
  const email = uniqueEmail("deja-inscrit");
  await createCoachSpace(page, "Élise", email);

  // Un visiteur tente de créer un compte avec la même adresse : même écran d'attente qu'une adresse neuve.
  const visitor = await (await phoneContext(browser)).newPage();
  await visitor.goto("/connexion?creer=1", { waitUntil: "networkidle" });
  await visitor.getByLabel(m.auth.emailLabel).fill(email);
  await visitor.getByRole("button", { name: w.auth.create.withPassword, exact: true }).click();
  await visitor.getByLabel(w.auth.create.passwordLabel, { exact: true }).fill("mot-de-passe-d-un-inconnu");
  await visitor.getByRole("button", { name: w.auth.create.submit, exact: true }).click();
  await expect(visitor.getByRole("heading", { name: s.verifyTitle })).toBeVisible();
  // C'est l'e-mail qui le dit, à la seule personne qui lit la boîte.
  await emailLink(email, w.auth.emails.accountExists.subject);

  // Le mot de passe de l'inconnu n'ouvre pas le compte ; celui du titulaire, toujours.
  await visitor.goto("/connexion", { waitUntil: "networkidle" });
  await visitor.getByLabel(m.auth.emailLabel).fill(email);
  await visitor.getByRole("button", { name: w.auth.signIn.withPassword, exact: true }).click();
  await visitor.getByLabel(w.auth.signIn.passwordLabel, { exact: true }).fill("mot-de-passe-d-un-inconnu");
  await visitor.getByRole("button", { name: w.auth.signIn.submit, exact: true }).click();
  await expect(visitor.getByRole("alert").filter({ hasText: w.auth.invalidCredentials })).toBeVisible();
  await signInWithPassword(visitor, email);
  await expect(visitor.getByRole("heading", { name: "Suivi du groupe" })).toBeVisible();
  await visitor.context().close();
});
