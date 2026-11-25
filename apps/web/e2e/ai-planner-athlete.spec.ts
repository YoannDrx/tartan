import { expect, test } from "@playwright/test";
import { trackingGrid } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll, expectNoMotion } from "./helpers";
import { groupLink, joinAsAthlete, publishSession, today } from "./journeys";
import { sql } from "./personas";

test("la séance du club et la proposition personnelle se valident chacune à leur source", async ({ page, browser }) => {
  test.skip(process.env.E2E_AI_PLANNER_ENABLED !== "true", "Prestataire IA simulé");
  test.setTimeout(240_000);
  await createCoachSpace(page, "Club");
  const joined = await joinAsAthlete(browser, await groupLink(page), "Camille");
  const athlete = joined.page;
  try {
    await publishSession(page, "Programme du coach", "Squat arrière");
    const me = await (await athlete.request.get("/api/v1/me")).json();
    const club = me.spaces[0].organizationId;
    await athlete.goto("/exercices");
    await athlete.getByRole("searchbox").fill("Squat arrière");
    await expect(athlete.getByRole("link", { name: /Squat arrière/ }).first()).toBeVisible();
    await expect(athlete.getByRole("button", { name: m.exercises.new, exact: true })).toHaveCount(0);
    await athlete
      .getByRole("link", { name: /Squat arrière/ })
      .first()
      .click();
    await expect.poll(() => new URL(athlete.url()).pathname).toContain("/club/exercices/");
    const notebook = await athlete.request.post("/api/v1/me/personal-space", {
      data: {
        firstName: "Camille",
        lastName: "Test",
        termsAccepted: true,
        disciplines: ["sprint"],
        trainingObjectives: ["speed"],
        consents: { health: false, video: false },
      },
    });
    expect(notebook.ok()).toBe(true);
    const { organizationId } = await notebook.json();
    await athlete.goto("/carnet/progres");
    await expect(athlete.getByRole("heading", { name: w.personal.progress.testTitle })).toBeVisible();
    await athlete.goto("/carnet/mes-videos");
    await expect(athlete.getByRole("heading", { name: m.video.mine, exact: true })).toBeVisible();
    await athlete.request.patch("/api/v1/me/preferences", { data: { aiConsent: true } });
    await athlete.goto("/aujourdhui");
    await athlete.getByRole("link", { name: m.aiPlanner.personalCreate }).click();
    await expect(athlete.getByTestId("space-name")).toHaveText("Coaching Club");
    await athlete
      .getByRole("textbox", { name: w.planner.field, exact: true })
      .fill("Aujourd’hui, Squat arrière, 3 séries de 4, repos 2 minutes.");
    await athlete.getByRole("button", { name: w.planner.prepare, exact: true }).click();
    await athlete.getByRole("button", { name: w.planner.create, exact: true }).click();
    await expect(athlete.getByText(w.planner.created, { exact: true })).toBeVisible();
    const draft = await sql(
      async (db) =>
        (await db.query("select id,version from scheduled_sessions where organization_id=$1", [organizationId]))
          .rows[0],
    );
    await athlete.goto(`/seances/${draft.id}`);
    await athlete.getByLabel("Titre", { exact: true }).locator("visible=true").fill("Ma séance du jeudi");
    await athlete.getByRole("button", { name: m.builder.publish, exact: true }).click();
    await expect
      .poll(
        async () =>
          await sql(
            async (db) =>
              (
                await db.query("select published_at is not null as published from scheduled_sessions where id=$1", [
                  draft.id,
                ])
              ).rows[0].published,
          ),
      )
      .toBe(true);

    await athlete.goto("/accueil");
    await athlete.reload();
    await expect(athlete.getByRole("link", { name: m.brand.athlete })).toBeVisible();
    await athlete.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [390, 768, 1440]) {
      await athlete.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(athlete);
      await expectAccessible(athlete);
      await expectNoMotion(athlete);
    }
    await expect(athlete.getByRole("heading", { name: "Programme du coach" })).toBeVisible();
    await athlete
      .getByRole("region", { name: "Ma séance du jeudi" })
      .getByRole("button", { name: m.today.quickDone })
      .click();
    await expect(athlete.getByRole("dialog", { name: m.today.validated })).toBeVisible();
    await athlete.goto("/calendrier?vue=liste");
    await expect(athlete.getByRole("link", { name: /Ma séance du jeudi/ })).toBeVisible();
    await athlete.getByRole("link", { name: /Programme du coach/ }).click();
    await athlete.getByRole("button", { name: m.today.quickDone, exact: true }).click();
    await expect(athlete.getByRole("dialog", { name: m.today.validated })).toBeVisible();
    const logs = await sql(
      async (db) =>
        (
          await db.query(
            "select s.organization_id as org,l.status from session_logs l join scheduled_sessions s on s.id=l.scheduled_session_id where s.organization_id=any($1::uuid[]) and s.date=$2",
            [[club, organizationId], today()],
          )
        ).rows,
    );
    expect(logs).toEqual(
      expect.arrayContaining([
        { org: club, status: "done" },
        { org: organizationId, status: "done" },
      ]),
    );
    expect((await page.request.get(`/api/v1/orgs/${organizationId}/athlete/today`)).status()).toBe(403);
    const tracking = trackingGrid.parse(await (await page.request.get(`/api/v1/orgs/${club}/tracking`)).json());
    const prescribed = tracking.sessions.find((session) => session.title === "Programme du coach");
    expect(tracking.rows.find((row) => row.athleteId === me.spaces[0].athleteId)?.cells).toContainEqual(
      expect.objectContaining({ sessionId: prescribed?.id, status: "done" }),
    );
    expect(tracking.sessions.some((session) => session.id === draft.id)).toBe(false);
    await page.goto("/suivi");
    await expect(page.getByText("Ma séance du jeudi", { exact: true })).toHaveCount(0);
  } finally {
    await joined.context.close();
  }
});
