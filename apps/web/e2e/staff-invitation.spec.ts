import { expect, test, type Browser } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, signUp, uniqueEmail } from "./helpers";
import { setOffre, sql } from "./personas";

// T12 : un coach invite un autre coach par e-mail. L'e-mail part par la file, le lien est celui de la liste des
// invitations, l'invité crée son compte depuis ce lien, et ses droits sont ceux d'un coach, pas d'un propriétaire.

const phone = (browser: Browser) =>
  browser.newContext({
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

test("invitation nominative d'un coach : envoyée, lien récupéré, droits vérifiés", async ({ page, browser }) => {
  await createCoachSpace(page, "Proprio");
  const me = (await (await page.request.get("/api/v1/me")).json()) as { spaces: { organizationId: string }[] };
  const organizationId = me.spaces[0]!.organizationId;
  // L'offre pilote n'a pas de plafond de coachs : c'est le contrôle d'accès qui répond, pas l'offre.
  await setOffre(organizationId, "pilot");
  const invited = uniqueEmail("coachinvite");

  // Le propriétaire invite depuis ses réglages.
  await page.goto("/reglages#inviter");
  const section = page.locator("#inviter");
  await section.getByLabel(m.auth.emailLabel).fill(invited);
  await section.getByLabel("Rôle").selectOption("coach");
  await section.getByRole("button", { name: m.common.send, exact: true }).click();
  await expect(page.getByText("Invitation envoyée.")).toBeVisible();
  await expect(section.getByText(invited)).toBeVisible();

  // L'e-mail est dans la file, au bon destinataire, avec le gabarit du staff.
  const queued = await sql((client) =>
    client.query<{ kind: string }>("select kind from email_outbox where to_email = $1", [invited.toLowerCase()]),
  );
  expect(queued.rows.map((row) => row.kind)).toEqual(["invitation_staff"]);

  // Le lien est celui que le propriétaire peut copier depuis la liste.
  const listed = (await (await page.request.get(`/api/v1/orgs/${organizationId}/invitations`)).json()) as {
    email: string | null;
    link: string | null;
  }[];
  const link = listed.find((row) => row.email === invited.toLowerCase())?.link;
  expect(link).toMatch(/\/i\//);
  const path = new URL(link!).pathname;

  // L'invité ouvre le lien, crée son compte et rejoint l'espace.
  const context = await phone(browser);
  const coach = await context.newPage();
  await coach.goto(path);
  await expect(coach.getByRole("heading", { name: /t'invite à coacher dans Coaching Proprio/ })).toBeVisible();
  await signUp(coach, invited, path);
  await coach.getByLabel("Prénom").fill("Nadia");
  await coach.getByLabel("Nom", { exact: true }).fill("Invitée");
  await coach.getByLabel("Date de naissance").fill("1990-04-21");
  await coach.getByRole("checkbox", { name: /conditions d'utilisation/ }).check();
  await expectAccessible(coach);
  await coach.getByRole("button", { name: m.invite.accept }).click();
  const confirmAge = coach.getByRole("button", { name: m.age.saveConfirmed, exact: true });
  if (await confirmAge.isVisible({ timeout: 3_000 }).catch(() => false)) await confirmAge.click();
  await expect(coach.getByRole("heading", { name: "Suivi du groupe" })).toBeVisible({ timeout: 30_000 });

  // Ses droits : il lit les athlètes de l'espace, mais n'invite pas de coach et ne touche pas à l'abonnement.
  expect((await coach.request.get(`/api/v1/orgs/${organizationId}/athletes`)).status()).toBe(200);
  const escalate = await coach.request.post(`/api/v1/orgs/${organizationId}/invitations`, {
    data: { kind: "personal_email", role: "coach", email: uniqueEmail("encore"), groupIds: [] },
  });
  expect(escalate.status()).toBe(403);
  await coach.goto("/reglages#inviter");
  await expect(coach.locator("#inviter").getByLabel("Rôle")).toHaveCount(0);

  // Le lien ne sert qu'une fois.
  await page.goto(path);
  await expect(page.getByText(m.invite.used)).toBeVisible();
  await context.close();
});
