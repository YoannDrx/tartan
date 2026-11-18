import { expect, test, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { rubricPath, visibleRubrics, type SettingsRubric } from "../src/features/settings/sections";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll, expectNoMotion } from "./helpers";
import { groupLink, joinAsAthlete } from "./journeys";

// Les réglages : un sommaire et une page par rubrique. Sur téléphone, la liste puis la rubrique, avec un retour ;
// sur ordinateur, la barre latérale à gauche et la rubrique à droite. Les largeurs sont posées à la main.
const PHONE = { width: 390, height: 844 };
const TABLET = { width: 768, height: 900 };
const DESKTOP = { width: 1440, height: 900 };

const t = w.settings;
const title = (rubric: SettingsRubric) => t.rubrics[rubric].title;
const rubricsNav = (page: Page) => page.getByRole("navigation", { name: m.settings.sectionsNav });
// Le bandeau porte deux titres, un par largeur : on lit celui qui est affiché, par son nom accessible.
const band = (page: Page) => page.getByRole("heading", { level: 1 });
const backLink = (page: Page) =>
  page.locator("header.page-band").getByRole("link", { name: m.settings.title, exact: true });

// Ce que chaque rubrique doit montrer, pour savoir qu'on y est bien arrivé.
const LANDMARK: Record<SettingsRubric, string> = {
  profil: t.profil.section,
  connexion: t.connexion.devices,
  notifications: m.inbox.categories,
  apparence: t.apparence.section,
  confidentialite: m.settings.blocked,
  espace: t.espace.section,
  groupes: t.groupes.section,
  membres: t.membres.invite,
  abonnement: m.settings.referral,
  aide: t.aide.section,
};

const expectFits = async (page: Page) => {
  for (const viewport of [PHONE, TABLET, DESKTOP]) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalScroll(page);
  }
};

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "largeurs explicites : un seul projet suffit");
});

test("sur téléphone, le sommaire résume chaque rubrique du propriétaire et y mène, avec un retour", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize(PHONE);
  await createCoachSpace(page, "Sommaire");
  await page.goto("/reglages", { waitUntil: "networkidle" });

  await expect(band(page)).toHaveAccessibleName(m.settings.title);
  await expect(backLink(page)).toHaveCount(0);
  const nav = rubricsNav(page);
  await expect(nav).toHaveCount(1);
  const owner = visibleRubrics("owner");
  await expect(nav.getByRole("link")).toHaveCount(owner.length);
  // Le compte d'abord, puis l'espace sous son nom.
  await expect(nav.getByRole("heading", { level: 2 })).toHaveText([t.account, "Coaching Sommaire"]);
  // Chaque ligne dit ce que la rubrique contient aujourd'hui.
  const row = (rubric: SettingsRubric) => nav.getByRole("link", { name: new RegExp(`^${title(rubric)}`) });
  await expect(row("profil")).toContainText("Sommaire Coach");
  await expect(row("apparence")).toContainText(t.rubrics.apparence.summary(m.appearance.tartan));
  await expect(row("groupes")).toContainText(t.rubrics.groupes.summary(1));
  await expect(row("membres")).toContainText(t.rubrics.membres.summary(1, 0));
  await expect(row("abonnement")).toContainText(t.rubrics.abonnement.summary(""));
  for (const rubric of owner) {
    const box = await row(rubric).boundingBox();
    expect(box?.height, rubric).toBeGreaterThanOrEqual(44);
  }
  // Sur téléphone, le sommaire ne déroule aucun formulaire.
  await expect(page.getByLabel(m.onboarding.firstName)).toBeHidden();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);

  for (const rubric of owner) {
    await row(rubric).click();
    await expect(page).toHaveURL(new RegExp(`${rubricPath(rubric)}$`));
    await expect(band(page)).toHaveAccessibleName(title(rubric));
    await expect(page.getByRole("heading", { level: 2, name: LANDMARK[rubric], exact: true })).toBeVisible();
    // Une rubrique est une page : pas de barre latérale, et un retour d'au moins 44 px vers le sommaire.
    await expect(rubricsNav(page)).toHaveCount(0);
    expect((await backLink(page).boundingBox())?.height, rubric).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    await backLink(page).click();
    await expect(page).toHaveURL(/\/reglages$/);
    await expect(band(page)).toHaveAccessibleName(m.settings.title);
  }
});

test("sur ordinateur, la barre latérale marque la rubrique courante et le sommaire ouvre le profil", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize(DESKTOP);
  await createCoachSpace(page, "Lateral");
  await page.goto("/reglages", { waitUntil: "networkidle" });

  // Pas de redirection : le sommaire montre la première rubrique à côté de la barre.
  await expect(page).toHaveURL(/\/reglages$/);
  await expect(band(page)).toHaveAccessibleName(m.settings.title);
  const nav = rubricsNav(page);
  await expect(nav).toHaveCount(1);
  const owner = visibleRubrics("owner");
  await expect(nav.getByRole("link")).toHaveText(owner.map(title));
  const link = (rubric: SettingsRubric) => nav.getByRole("link", { name: title(rubric), exact: true });
  // Le profil est montré à la place du sommaire : il est courant, sans être la page ouverte.
  await expect(link("profil")).toHaveAttribute("aria-current", "true");
  await expect(page.getByLabel(m.onboarding.firstName)).toHaveValue("Lateral");
  await expectAccessible(page);

  for (const rubric of owner) {
    await link(rubric).click();
    await expect(page).toHaveURL(new RegExp(`${rubricPath(rubric)}$`));
    await expect(page.getByRole("heading", { level: 2, name: LANDMARK[rubric], exact: true })).toBeVisible();
    // Le bandeau reste celui des réglages, sans retour : la barre dit où l'on est.
    await expect(band(page)).toHaveAccessibleName(m.settings.title);
    await expect(backLink(page)).toHaveCount(0);
    await expect(nav.locator('[aria-current="page"]')).toHaveText(title(rubric));
    // La rubrique courante ne se lit pas qu'à la couleur : elle est grasse et porte un chevron.
    const marks = async (target: SettingsRubric) =>
      link(target).evaluate((node) => ({
        weight: Number(getComputedStyle(node).fontWeight),
        icons: node.querySelectorAll("svg").length,
      }));
    const other = owner.find((candidate) => candidate !== rubric)!;
    expect(await marks(rubric)).toEqual({ weight: 600, icons: 2 });
    expect(await marks(other)).toEqual({ weight: 500, icons: 1 });
    expect((await link(rubric).boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expectFits(page);
    await expectAccessible(page);
  }
});

test("l'athlète ouvre ses rubriques, pas celles de l'espace, à trois largeurs", async ({ page, browser }) => {
  test.setTimeout(240_000);
  await createCoachSpace(page, "Vestiaire");
  const athlete = await joinAsAthlete(browser, await groupLink(page), "Rubrique");
  try {
    const phone = athlete.page;
    await phone.goto("/reglages", { waitUntil: "networkidle" });
    const nav = rubricsNav(phone);
    const personal = visibleRubrics("athlete");
    // Une seule liste, sans titre de famille : l'athlète n'a aucun réglage d'espace.
    await expect(nav.getByRole("link")).toHaveCount(personal.length);
    await expect(nav.getByRole("heading")).toHaveCount(0);
    await expect(nav.getByRole("link", { name: new RegExp(`^${title("profil")}`) })).toContainText("Rubrique Test");
    await expectAccessible(phone);

    for (const rubric of personal) {
      await phone.goto(rubricPath(rubric), { waitUntil: "networkidle" });
      await expect(band(phone)).toHaveAccessibleName(title(rubric));
      await expect(phone.getByRole("heading", { level: 2, name: LANDMARK[rubric], exact: true })).toBeVisible();
      await expectFits(phone);
      await phone.setViewportSize(PHONE);
      await expectAccessible(phone);
    }
    // Ce qui est à lui : ses accords, son agenda, son lien de parrainage d'adulte.
    await phone.goto(rubricPath("confidentialite"));
    await expect(phone.getByRole("checkbox", { name: m.settings.healthConsent })).toBeChecked();
    await expect(phone.getByRole("button", { name: m.settings.leaveSpace })).toBeVisible();
    await phone.goto(rubricPath("notifications"));
    await expect(phone.getByRole("heading", { level: 2, name: m.settings.calendar, exact: true })).toBeVisible();
    // Le lien de l'agenda porte son nom, pas celui du parrainage.
    await expect(phone.getByLabel(t.notifications.icalLabel, { exact: true })).toHaveValue(/\/api\/ical\//);
    await expect(phone.getByLabel(m.settings.referralLinkLabel)).toHaveCount(0);
    await phone.goto(rubricPath("aide"));
    await expect(phone.getByLabel(m.settings.referralLinkLabel, { exact: true })).toHaveValue(/\/r\//);
    await expect(phone.getByRole("link", { name: m.syncReview.title, exact: true })).toHaveAttribute(
      "href",
      "/synchronisation",
    );

    // Une rubrique de l'espace, ouverte par son adresse ou par une ancienne ancre, ramène au sommaire.
    for (const rubric of ["espace", "groupes", "membres", "abonnement"] as const) {
      await phone.goto(rubricPath(rubric));
      await expect(phone).toHaveURL(/\/reglages$/);
    }
    await phone.goto("/reglages#invitations", { waitUntil: "networkidle" });
    await expect(phone).toHaveURL(/\/reglages#invitations$/);
    await expect(rubricsNav(phone)).toBeVisible();

    // Sur ordinateur, sa barre latérale ne porte que ses rubriques.
    await phone.setViewportSize(DESKTOP);
    await phone.goto("/reglages", { waitUntil: "networkidle" });
    await expect(rubricsNav(phone).getByRole("link")).toHaveText(personal.map(title));
    await expectAccessible(phone);
  } finally {
    await athlete.context.close();
  }
});

test("une ancienne ancre mène à sa rubrique, et les liens internes au bon formulaire", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(PHONE);
  await createCoachSpace(page, "Ancre");
  const me = await (await page.request.get("/api/v1/me")).json();
  const organizationId = me.spaces[0].organizationId as string;

  // Un suivi sans athlète mène à l'invitation sur place, pas à la liste des groupes.
  await page.goto("/suivi", { waitUntil: "networkidle" });
  const invite = page.getByRole("link", { name: w.onboarding.emptyGroupAction });
  await expect(invite).toHaveAttribute("href", "/premiers-pas#inviter");
  await invite.click();
  await expect(page).toHaveURL(/\/premiers-pas#inviter$/);
  await expect(page.locator("#inviter").getByLabel(w.onboarding.invite.emailsLabel)).toBeVisible();
  await expect(page.locator("#inviter").getByLabel(w.onboarding.invite.linkLabel)).toHaveValue(/\/i\//);

  // Les ancres de l'ancienne page unique, telles que les portent des e-mails déjà partis.
  await page.goto("/reglages#invitations");
  await expect(page).toHaveURL(/\/reglages\/groupes$/);
  await expect(page.getByRole("button", { name: m.settings.groupLink })).toBeVisible();
  await page.goto("/reglages#inviter");
  await expect(page).toHaveURL(/\/reglages\/membres#inviter$/);
  await expect(page.locator("#inviter")).toBeInViewport();
  await page.goto("/reglages#compte");
  await expect(page).toHaveURL(/\/reglages\/confidentialite#compte$/);
  await expect(page.getByRole("button", { name: m.settings.deleteAccount })).toBeInViewport();
  // Le lien d'un e-mail de signalement choisit l'espace, puis arrive sur la bonne section.
  await page.goto(`/reglages?espace=${organizationId}#signalements`);
  await expect(page).toHaveURL(/\/reglages\/espace#signalements$/);
  await expect(page.getByText(m.settings.reportsEmpty)).toBeVisible();
  // La redirection remplace l'adresse : revenir en arrière ne renvoie pas dans la boucle.
  await page.goto("/suivi");
  await page.goto("/reglages#offre");
  await expect(page).toHaveURL(/\/reglages\/abonnement$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/suivi$/);
  // Une ancre inconnue laisse le sommaire en place.
  await page.goto("/reglages#inconnue");
  await expect(rubricsNav(page)).toBeVisible();
  await expect(page).toHaveURL(/\/reglages#inconnue$/);

  // Le menu de l'engrenage parle des mêmes rubriques.
  await page.goto("/suivi", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: m.nav.reglages, exact: true }).click();
  const menu = page.getByRole("menu");
  for (const rubric of ["profil", "espace", "groupes"] as const) {
    await expect(menu.getByRole("menuitem", { name: title(rubric), exact: true })).toHaveAttribute(
      "href",
      rubricPath(rubric),
    );
  }
  await expect(menu.getByRole("menuitem", { name: title("abonnement"), exact: true })).toHaveAttribute(
    "href",
    "/abonnement",
  );
  await menu.getByRole("menuitem", { name: m.nav.allSettings, exact: true }).click();
  await expect(page).toHaveURL(/\/reglages$/);
});

test("en mouvement réduit, rien ne bouge dans les réglages", async ({ page }) => {
  test.setTimeout(120_000);
  await createCoachSpace(page, "Immobile");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [PHONE, DESKTOP]) {
    await page.setViewportSize(viewport);
    for (const path of ["/reglages", ...visibleRubrics("owner").map(rubricPath)]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await expectNoMotion(page);
    }
  }
  // D'une rubrique à l'autre non plus : ni fondu de page, ni glissement de la marque.
  await page
    .getByRole("navigation", { name: m.settings.sectionsNav })
    .getByRole("link", { name: title("groupes") })
    .click();
  await expect(page).toHaveURL(/\/reglages\/groupes$/);
  await expectNoMotion(page);
});
