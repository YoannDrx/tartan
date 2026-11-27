import { expect, test, type APIRequestContext } from "@playwright/test";
import { trackingGrid } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll, expectNoMotion } from "./helpers";
import { groupLink, joinAsAthlete } from "./journeys";
import { sql } from "./personas";

// L'athlète invité par un coach, sans carnet, planifie pour lui (décision du 27 novembre 2026) : « Planifier » mène à
// l'ouverture allégée de son carnet, même inscriptions d'athlètes fermées, puis au planificateur. Le coach ne voit rien.

// Le serveur garde ses réglages 30 s en mémoire : on attend qu'il lise la nouvelle valeur.
const athleteSignup = async (request: APIRequestContext, mode: "public" | "closed") => {
  if (mode === "closed")
    await sql((db) =>
      db.query(
        `insert into platform_settings (key, value, updated_at) values ('athleteSignupMode', '"closed"', now())
         on conflict (key) do update set value = excluded.value, updated_at = now()`,
      ),
    );
  else await sql((db) => db.query("delete from platform_settings where key = 'athleteSignupMode'"));
  await expect
    .poll(async () => (await (await request.get("/api/v1/signup-options")).json()).athlete, { timeout: 45_000 })
    .toBe(mode === "public");
};

test("sans carnet, l'athlète d'un club l'ouvre depuis « Planifier » et son coach ne voit rien", async ({
  page,
  browser,
}) => {
  test.skip(process.env.E2E_AI_PLANNER_ENABLED !== "true", "Prestataire IA simulé");
  test.setTimeout(300_000);
  await createCoachSpace(page, "Fermé");
  const joined = await joinAsAthlete(browser, await groupLink(page), "Noa");
  const athlete = joined.page;
  await athleteSignup(page.request, "closed");
  try {
    const me = await (await athlete.request.get("/api/v1/me")).json();
    expect(me.notebook).toEqual({ available: true });
    expect(me.spaces.some((space: { kind?: string }) => space.kind === "personal")).toBe(false);
    const club = me.spaces[0].organizationId;

    // « Planifier » dans la navigation de l'athlète de club, et non plus un planificateur « désactivé ».
    await athlete.goto("/aujourdhui");
    await athlete.getByRole("link", { name: w.personal.nav.plan, exact: true }).click();
    await expect(athlete).toHaveURL(/\/bienvenue\/seul\?ensuite=planificateur$/);
    await expect(athlete.getByRole("heading", { name: w.welcome.notebookForm.title })).toBeVisible();
    await expect(athlete).toHaveTitle(new RegExp(w.welcome.notebookForm.title));
    // Ouverture allégée : nom et date de naissance viennent du profil.
    await expect(athlete.getByLabel(m.onboarding.firstName)).toHaveCount(0);
    await expect(athlete.getByLabel(m.invite.birthDate)).toHaveCount(0);
    await athlete.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [390, 768, 1440]) {
      await athlete.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(athlete);
      await expectAccessible(athlete);
      await expectNoMotion(athlete);
      // Recette : les captures ne se rangent que hors du dépôt, quand le dossier est donné.
      if (process.env.E2E_SHOTS_DIR)
        await athlete.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/carnet-club-${width}.png`, fullPage: true });
    }
    await athlete.setViewportSize({ width: 390, height: 844 });
    await athlete.getByRole("button", { name: m.onboarding.next, exact: true }).click();
    await expect(athlete.getByText(w.welcome.notebookForm.termsLead)).toBeVisible();
    // Les conditions du carnet restent à accepter.
    await athlete.getByRole("button", { name: w.welcome.notebookForm.create, exact: true }).click();
    await expect(athlete.getByText(m.invite.termsRequired, { exact: true })).toBeVisible();
    await athlete.getByRole("checkbox", { name: m.invite.consentTerms }).check();
    await athlete.getByRole("button", { name: w.welcome.notebookForm.create, exact: true }).click();
    await expect(athlete).toHaveURL(/\/planificateur$/);
    // Le bandeau reste celui du club : le carnet est à côté.
    await expect(athlete.getByTestId("space-name")).toHaveText("Coaching Fermé");
    await athlete.getByRole("button", { name: w.planner.consent.accept, exact: true }).click();
    await athlete
      .getByRole("textbox", { name: w.planner.field, exact: true })
      .fill("Aujourd’hui, Squat arrière, 3 séries de 4, repos 2 minutes.");
    await athlete.getByRole("button", { name: w.planner.prepare, exact: true }).click();
    await athlete.getByRole("button", { name: w.planner.create, exact: true }).click();
    await expect(athlete.getByText(w.planner.created, { exact: true })).toBeVisible();

    const after = await (await athlete.request.get("/api/v1/me")).json();
    const notebook = after.spaces.find((space: { kind?: string }) => space.kind === "personal").organizationId;
    const rows = await sql(
      async (db) =>
        (
          await db.query(
            `select o.plan, (select count(*)::int from scheduled_sessions s where s.organization_id = o.id) as sessions,
              (select count(*)::int from email_outbox e where e.organization_id = o.id) as emails
             from organizations o where o.id = $1`,
            [notebook],
          )
        ).rows[0],
    );
    // Offre personnelle, une séance en brouillon, aucun e-mail d'athlète autonome.
    expect(rows).toEqual({ plan: "personal", sessions: 1, emails: 0 });
    const draft = await sql(
      async (db) =>
        (await db.query("select id from scheduled_sessions where organization_id = $1", [notebook])).rows[0].id,
    );

    // Le coach ne voit ni la séance, ni le carnet, et son quota est intact.
    expect((await page.request.get(`/api/v1/orgs/${notebook}/athlete/today`)).status()).toBe(403);
    const tracking = trackingGrid.parse(await (await page.request.get(`/api/v1/orgs/${club}/tracking`)).json());
    expect(tracking.sessions.some((session) => session.id === draft)).toBe(false);
    const quotas = await sql(
      async (db) =>
        (
          await db.query(
            `select o.id = $2 as notebook, coalesce(sum(q.used_proposals), 0)::int as used
             from organizations o left join ai_planner_quotas q on q.organization_id = o.id
             where o.id = any($1::uuid[]) group by o.id`,
            [[club, notebook], notebook],
          )
        ).rows,
    );
    expect(quotas).toEqual(
      expect.arrayContaining([
        { notebook: false, used: 0 },
        { notebook: true, used: 1 },
      ]),
    );
    await page.goto("/suivi");
    await expect(page.getByText("Squat arrière", { exact: false })).toHaveCount(0);
  } finally {
    await athleteSignup(page.request, "public");
    await joined.context.close();
  }
});
