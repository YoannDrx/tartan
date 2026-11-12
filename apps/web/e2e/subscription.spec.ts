import { expect, test, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll, signUp, uniqueEmail } from "./helpers";
import { setOffre, sql } from "./personas";

// T14 : la page `/abonnement` selon l'offre et le rôle, vente fermée. Le serveur e2e n'a pas de clé Stripe : la vente
// y est coupée, comme en production tant que le fondateur ne l'ouvre pas. Aucun bouton n'y lance un paiement.

const t = m.billing;

const spaceOf = async (page: Page) => {
  const me = (await (await page.request.get("/api/v1/me")).json()) as { spaces: { organizationId: string }[] };
  return me.spaces[0]!.organizationId;
};

const preparedAthletes = (organizationId: string, count: number) =>
  sql(async (client) => {
    for (let index = 0; index < count; index += 1) {
      await client.query(
        `insert into athletes (id, organization_id, first_name, last_name, birth_date, updated_at)
         values (gen_random_uuid(), $1, $2, 'Fiche', '1995-01-01', now())`,
        [organizationId, `Athlète${index + 1}`],
      );
    }
  });

const athleteCount = (organizationId: string) =>
  sql(async (client) =>
    Number(
      (await client.query<{ n: string }>("select count(*) as n from athletes where organization_id = $1", [organizationId]))
        .rows[0]!.n,
    ),
  );

test("en Découverte, vente fermée : la sixième fiche est refusée et mène aux offres, sans achat possible", async ({
  page,
}) => {
  await createCoachSpace(page, "Abonne");
  const organizationId = await spaceOf(page);
  await setOffre(organizationId, "discovery");
  await preparedAthletes(organizationId, 5);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/athletes");
  await page.getByRole("button", { name: m.athletes.new }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(m.onboarding.firstName, { exact: true }).fill("Sixième");
  await dialog.getByLabel(m.onboarding.lastName, { exact: true }).fill("Fiche");
  await dialog.getByLabel(m.invite.birthDate).fill("1996-02-02");
  await dialog.getByRole("button", { name: m.common.save }).click();

  // Le refus dit pourquoi, et propose les offres.
  const toast = page.getByText(t.limitAthletes);
  await expect(toast).toBeVisible();
  expect(await athleteCount(organizationId)).toBe(5);
  await page.getByRole("link", { name: t.limitAction }).click();
  await expect(page).toHaveURL(/\/abonnement$/);

  // L'offre en cours, la vente coupée : chaque offre payante mène à une prise de contact, jamais à un paiement.
  const main = page.locator("main");
  await expect(main.getByRole("heading", { name: t.title, level: 1 })).toBeVisible();
  await expect(main.getByText(t.disabled)).toBeVisible();
  await expect(main.getByText(t.current).first()).toBeAttached();
  await expect(main.getByRole("button", { name: t.choose(t.plans.coach) })).toHaveCount(0);
  await expect(main.getByRole("button", { name: t.choose(t.plans.club) })).toHaveCount(0);
  await expect(main.getByRole("link", { name: t.contactUs }).first()).toBeAttached();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test("selon l'offre et le rôle : rien à acheter en pilote, rien à gérer pour un coach invité", async ({
  page,
  browser,
}) => {
  await createCoachSpace(page, "Gerant");
  const organizationId = await spaceOf(page);

  // Offre pilote : ni grille ni prise de contact.
  await setOffre(organizationId, "pilot");
  await page.goto("/abonnement");
  const main = page.locator("main");
  await expect(main.getByRole("heading", { name: t.title, level: 1 })).toBeVisible();
  await expect(main.getByText(t.plans.pilot).first()).toBeVisible();
  await expect(main.getByRole("link", { name: t.contactUs })).toHaveCount(0);

  // Un coach invité dans l'espace : il voit l'offre, sans grille ni gestion.
  const context = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
  const coach = await context.newPage();
  const email = uniqueEmail("coachabonnement");
  await signUp(coach, email);
  const groups = (await (await page.request.get(`/api/v1/orgs/${organizationId}/groups`)).json()) as { id: string }[];
  const invitation = await page.request.post(`/api/v1/orgs/${organizationId}/invitations`, {
    data: { kind: "personal_email", role: "coach", email, groupIds: [groups[0]!.id] },
  });
  expect(invitation.status()).toBe(200);
  const token = ((await invitation.json()) as { link: string }).link.split("/").pop()!;
  const accepted = await coach.request.post(`/api/v1/invitations/${token}/accept`, {
    data: { firstName: "Coach", lastName: "Invité", birthDate: "1988-09-02", consents: { terms: true, health: false, video: false } },
  });
  expect(accepted.status()).toBe(200);

  await setOffre(organizationId, "discovery");
  await coach.goto("/abonnement");
  const coachMain = coach.locator("main");
  await expect(coachMain.getByRole("heading", { name: t.title, level: 1 })).toBeVisible();
  await expect(coachMain.getByText(t.plans.discovery).first()).toBeVisible();
  await expect(coachMain.getByRole("link", { name: t.contactUs })).toHaveCount(0);
  await expect(coachMain.getByText(t.disabled)).toHaveCount(0);
  await context.close();
});
