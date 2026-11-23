import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import {
  createCoachSpace,
  expectAccessible,
  expectNoHorizontalScroll,
  expectNoMotion,
  signInWithPassword,
  signUp,
  sqlQuery,
  uniqueEmail,
} from "./helpers";
import { groupLink, startSolo } from "./journeys";

// L'athlète qui s'entraîne seul (docs/plans/athlete-autonome.md) : l'aiguillage d'un compte neuf, son espace personnel,
// sa première séance planifiée puis validée ; et les impasses d'un compte sans espace, refermées.

// Chaque écran neuf se regarde à 390, 768 et 1440 px, sans débordement ni erreur axe ; les captures restent hors dépôt.
const atWidths = async (page: Page, info: TestInfo, name: string) => {
  if (info.project.name !== "desktop") return;
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    if (process.env.E2E_SHOTS_DIR)
      await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/autonome-${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
};

test("athlète autonome : de l'inscription à sa première séance planifiée et validée", async ({ page }, info) => {
  test.setTimeout(240_000);
  const firstName = info.project.name === "desktop" ? "Inès" : "Lila";
  const email = uniqueEmail(`solo-${info.project.name}`);
  await signUp(page, email, "/connexion?next=%2Fbienvenue");

  // L'aiguillage : trois choix de même rang, puis le compte lui-même.
  await expect(page.getByRole("heading", { name: w.welcome.title })).toBeVisible({ timeout: 60_000 });
  const choices = page.getByRole("list", { name: w.welcome.choicesLabel });
  await expect(choices.getByRole("link", { name: new RegExp(w.welcome.coach.title) })).toBeVisible();
  await expect(choices.getByRole("link", { name: new RegExp(w.welcome.solo.title) })).toBeVisible();
  await expect(choices.getByLabel(w.welcome.invite.label)).toBeVisible();
  await expect(page.getByRole("button", { name: m.common.signOut, exact: true })).toBeVisible();
  await atWidths(page, info, "aiguillage");
  // Un code d'invitation qui n'en est pas un est dit sur place, sans quitter l'écran.
  await choices.getByLabel(w.welcome.invite.label).fill("pas un code");
  await choices.getByRole("button", { name: w.welcome.invite.open, exact: true }).click();
  await expect(page.getByText(w.welcome.invite.invalid)).toBeVisible();

  // « Je m'entraîne seul » en trois temps.
  await choices.getByRole("link", { name: new RegExp(w.welcome.solo.title) }).click();
  await expect(page.getByRole("heading", { name: w.welcome.soloForm.title })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Prénom").fill(firstName);
  await page.getByLabel("Nom", { exact: true }).fill("Seule");
  await page.getByLabel("Date de naissance").fill("1996-04-20");
  await atWidths(page, info, "parcours-1");
  await page.getByRole("button", { name: m.onboarding.next, exact: true }).click();
  await expect(page.getByRole("group", { name: w.welcome.soloForm.trainingTitle })).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: /^Disciplines/ })
    .click();
  await page.getByRole("checkbox", { name: "Sprint", exact: true }).check();
  // Le matériel est celui d'un groupe : il n'est pas demandé ici.
  await expect(page.locator("summary").filter({ hasText: /^Matériel disponible/ })).toHaveCount(0);
  await page.getByRole("button", { name: m.onboarding.next, exact: true }).click();
  // Sans les conditions, rien ne se crée.
  await page.getByRole("button", { name: w.welcome.soloForm.create, exact: true }).click();
  await expect(page.getByText(m.invite.termsRequired)).toBeVisible();
  await page.getByRole("checkbox", { name: /conditions d'utilisation/ }).check();
  await page.getByRole("checkbox", { name: /informations de santé/ }).check();
  await atWidths(page, info, "parcours-3");
  await page.getByRole("button", { name: w.welcome.soloForm.create, exact: true }).click();
  await page.getByRole("button", { name: m.age.saveConfirmed, exact: true }).click();

  // Sa journée, ses premiers pas, sa navigation d'athlète avec « Planifier ». Rien d'un coach.
  await expect(page.getByRole("heading", { name: m.today.greeting(firstName) })).toBeVisible({ timeout: 60_000 });
  const guide = page.getByRole("region", { name: w.personal.guide.title });
  await expect(guide).toBeVisible();
  await expect(guide.getByText(w.personal.guide.progress(0, 4))).toBeVisible();
  await expect(page.getByRole("link", { name: w.personal.nav.plan }).first()).toBeAttached();
  for (const coachOnly of [m.nav.suivi, m.nav.athletes, m.nav.annonces])
    await expect(page.getByRole("link", { name: coachOnly, exact: true })).toHaveCount(0);
  await atWidths(page, info, "journee");
  const [space] = await sqlQuery<{ id: string; kind: string; plan: string; members: number }>(
    `select o.id, o.kind, o.plan, (select count(*) from organization_members om where om.organization_id = o.id)::int as members
     from organizations o join "user" u on u.id = o.personal_owner_id where u.email = $1`,
    [email],
  );
  expect(space).toMatchObject({ kind: "personal", plan: "personal", members: 1 });

  // Planifier : un modèle de départ, sans destinataires, publié pour lui seul.
  await guide.getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: m.builder.audience, exact: true })).toHaveCount(0);
  const title = (await page.getByLabel("Titre").locator("visible=true").inputValue()) || "Ma première séance";
  await page.getByLabel("Titre").locator("visible=true").fill(title);
  await atWidths(page, info, "constructeur");
  await page.getByRole("button", { name: m.builder.publish, exact: true }).click();

  // Publiée, elle l'attend dans sa journée : il la valide en un geste.
  await expect(page).toHaveURL(/\/aujourdhui/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "J'ai fait la séance", exact: true }).click();
  await expect(page.getByRole("dialog", { name: m.today.validated })).toBeVisible();
  const [log] = await sqlQuery<{ status: string; assignments: number }>(
    `select l.status, (select count(*) from assignments a where a.scheduled_session_id = s.id)::int as assignments
     from session_logs l join scheduled_sessions s on s.id = l.scheduled_session_id where s.organization_id = $1`,
    [space!.id],
  );
  expect(log).toEqual({ status: "done", assignments: 1 });

  // Le calendrier est le sien : ses séances, publiées ou non, et l'accès à sa séance.
  await page.goto("/calendrier", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: m.nav.calendrier, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: title }).first()).toBeVisible();
  await atWidths(page, info, "calendrier");

  // Mouvement réduit : rien ne bouge sur ses écrans.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/aujourdhui", { waitUntil: "networkidle" });
  await expectNoMotion(page);
});

test("compte sans espace : il se déconnecte, revient, puis supprime son compte", async ({ page }, info) => {
  test.setTimeout(120_000);
  const email = uniqueEmail(`sans-espace-${info.project.name}`);
  await signUp(page, email, "/connexion?next=%2Fbienvenue");
  await expect(page.getByRole("heading", { name: w.welcome.title })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: w.welcome.account.title })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole("button", { name: m.common.signOut, exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect.poll(async () => (await page.request.get("/api/v1/me")).status()).toBe(401);

  await signInWithPassword(page, email, "/connexion?next=%2Fbienvenue");
  await expect(page.getByRole("heading", { name: w.welcome.title })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: m.settings.deleteAccount, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: m.settings.deleteAccount });
  await expect(dialog).toBeVisible();
  await expectAccessible(page);
  await dialog.getByLabel(m.settings.deleteConfirmLabel).fill(m.settings.deleteConfirmWord);
  await dialog.getByRole("button", { name: m.settings.deleteAccount, exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  await expect.poll(async () => (await sqlQuery(`select id from "user" where email = $1`, [email])).length).toBe(0);
});

test("invitation nominative ouverte avec un autre compte : l'adresse visée, puis « Changer de compte »", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  await createCoachSpace(page, `Nominatif${info.project.name === "desktop" ? "Bureau" : "Mobile"}`);
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId as string;
  const groups = await (await page.request.get(`/api/v1/orgs/${orgId}/groups`)).json();
  const invited = uniqueEmail(`invitee-${info.project.name}`);
  const created = await page.request.post(`/api/v1/orgs/${orgId}/invitations`, {
    data: { kind: "personal_email", role: "athlete", email: invited, groupIds: [groups[0].id] },
  });
  expect(created.ok()).toBe(true);
  const { link } = (await created.json()) as { link: string };

  const context = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
  const other = await context.newPage();
  try {
    const otherEmail = uniqueEmail(`autre-${info.project.name}`);
    await signUp(other, otherEmail, "/connexion?next=%2Fbienvenue");
    await other.goto(new URL(link).pathname, { waitUntil: "networkidle" });
    // L'adresse visée et celle du compte se lisent avant tout formulaire.
    await expect(other.getByText(w.auth.inviteFor)).toBeVisible();
    await expect(other.getByText(invited)).toBeVisible();
    await expect(other.getByText(otherEmail)).toBeVisible();
    await expect(other.getByText(w.auth.inviteWrongAccount)).toBeVisible();
    await expect(other.getByRole("button", { name: m.invite.accept })).toHaveCount(0);
    await atWidths(other, info, "invitation-autre-compte");
    await other.getByRole("button", { name: w.auth.switchAccount, exact: true }).click();
    // Déconnecté, l'invitation se rouvre, l'adresse visée déjà saisie.
    await expect(other.getByLabel(m.auth.emailLabel)).toHaveValue(invited, { timeout: 30_000 });
    await expect(other.getByText(otherEmail)).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("l'athlète autonome rejoint un coach, partage son historique puis le retire : vu des deux côtés", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(240_000);
  const suffix = info.project.name === "desktop" ? "Bureau" : "Mobile";
  await createCoachSpace(page, `Partage${suffix}`);
  const link = await groupLink(page);

  const context = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
  const solo = await context.newPage();
  try {
    const { email } = await startSolo(solo, `Sacha${suffix}`);
    // Un record noté dans son espace personnel, avant de rejoindre le coach.
    await sqlQuery(
      `insert into performances (id, organization_id, athlete_id, discipline, mark, unit, date, is_pb, updated_at)
       select gen_random_uuid(), a.organization_id, a.id, '100 m haies', 14.2, 's', current_date, true, now()
       from athletes a join organizations o on o.id = a.organization_id join "user" u on u.id = a.user_id
       where o.kind = 'personal' and u.email = $1`,
      [email],
    );

    // L'invitation, acceptée avec son compte : l'écran suivant propose, sans l'imposer, le partage de son historique.
    await solo.goto(new URL(link).pathname, { waitUntil: "networkidle" });
    await solo.getByRole("checkbox", { name: /conditions d'utilisation/ }).check();
    await solo.getByRole("button", { name: m.invite.accept }).click();
    await expect(solo).toHaveURL(/\/partager-historique/, { timeout: 60_000 });
    await expect(solo.getByText(w.personal.share.health)).toBeVisible();
    await atWidths(solo, info, "partage");
    await solo.getByRole("checkbox", { name: new RegExp(w.personal.share.scopes.records) }).check();
    await solo.getByRole("button", { name: w.personal.share.submit, exact: true }).click();
    await expect(solo).toHaveURL(/\/aujourdhui/, { timeout: 60_000 });

    // Côté coach : la section en lecture seule, sur la fiche de l'athlète.
    const me = await (await page.request.get("/api/v1/me")).json();
    const orgId = me.spaces[0].organizationId as string;
    const athletes = (await (await page.request.get(`/api/v1/orgs/${orgId}/athletes`)).json()) as {
      id: string;
      firstName: string;
    }[];
    const athlete = athletes.find((entry) => entry.firstName === `Sacha${suffix}`)!;
    await page.goto(`/athletes/${athlete.id}`, { waitUntil: "networkidle" });
    const section = page.getByRole("region", { name: w.personal.share.coachTitle });
    await expect(section).toBeVisible();
    await expect(section.getByText("100 m haies")).toBeVisible();
    await expect(section.getByRole("button")).toHaveCount(0);
    await atWidths(page, info, "partage-coach");

    // Il retire le partage dans Réglages, Confidentialité : le coach ne voit plus rien, aussitôt.
    await solo.goto("/reglages/confidentialite", { waitUntil: "networkidle" });
    await solo.getByRole("button", { name: w.personal.share.revoke, exact: true }).click();
    await solo.getByRole("dialog").getByRole("button", { name: w.personal.share.revoke, exact: true }).click();
    await expect(solo.getByText(w.personal.share.settingsEmpty)).toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("region", { name: w.personal.share.coachTitle })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
