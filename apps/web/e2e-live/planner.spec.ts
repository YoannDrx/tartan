import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { createApiClient } from "@tartan/api-client";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible } from "../e2e/helpers";
import { groupLink, joinAsAthlete, today } from "../e2e/journeys";

test("OpenAI réel : exercice inconnu, création privée, brouillon, publication et lecture athlète", async ({
  page,
  browser,
}) => {
  const t = m.aiPlanner;
  await createCoachSpace(page, "RecetteIA");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId as string;
  const api = createApiClient({
    baseUrl: new URL(page.url()).origin,
    headers: async () => ({ Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") }),
  });
  const sql = new Client({ connectionString: process.env.E2E_DATABASE_URL });
  await sql.connect();
  try {
    // Synthetic fixture only: no generated proposal or provider response is inserted or intercepted.
    await sql.query(
      "UPDATE organizations SET ai_planner_enabled=true, phases_enabled=false, plan='coach' WHERE id=$1",
      [orgId],
    );
    await sql.query("UPDATE profiles SET ai_consent_at=now() WHERE id=$1", [me.id]);
    const athlete = await joinAsAthlete(browser, await groupLink(page), "AthleteIA", { health: false });
    try {
      const context = await api.sessionBuilder(orgId);
      const name = "Marche du dragon fictif";
      const id = randomUUID();
      const date = today();
      const proposal = await api.createPlannerProposal(orgId, {
        id,
        requestedAt: new Date().toISOString(),
        reviewed: true,
        selection: {
          mode: "format",
          period: { from: date, to: date },
          groupIds: [context.groups[0]!.id],
          athleteIds: [],
          exerciseIds: [],
          phaseChoices: [],
        },
        text: `Aujourd’hui pour le groupe sélectionné : ${name}, 3 séries de 5 répétitions sans charge, récupération 60 secondes entre les séries, sans repos final.`,
      });
      expect(proposal.state).toBe("clarification");
      expect(proposal.interpretation?.questions.some((q) => q.field === "exercise" && q.exerciseName)).toBe(true);
      await page.goto(`/planificateur?proposition=${id}`);
      await page.getByRole("button", { name: t.createPrivateExercise, exact: true }).first().click();
      await page
        .getByLabel(t.movementCues, { exact: true })
        .fill("Exercice fictif de recette : marcher avec des appuis stables.");
      await page.getByRole("checkbox", { name: t.privateExerciseReviewed, exact: true }).check();
      await page.getByRole("button", { name: t.savePrivateExercise, exact: true }).click();
      await expect(page.getByText(t.exerciseResolved(name), { exact: true })).toBeVisible();
      await page
        .getByLabel(t.clarificationAnswer, { exact: true })
        .fill(
          "Utilise la fiche que je viens de créer. Conserve trois séries de cinq, sans charge, soixante secondes entre séries, sans repos final.",
        );
      await page.getByRole("checkbox", { name: t.reviewed, exact: true }).check();
      await page.getByRole("button", { name: t.clarify, exact: true }).click();
      await expect(page.getByRole("button", { name: t.prepareReview, exact: true })).toBeVisible({ timeout: 110_000 });
      await page.getByRole("button", { name: t.prepareReview, exact: true }).click();
      await page.getByRole("button", { name: t.previewLoads, exact: true }).click();
      await expect(page.getByText(t.previewCoverage(1, 1), { exact: true })).toBeVisible();
      await page.getByRole("checkbox", { name: t.reviewedDrafts, exact: true }).check();
      await page.getByRole("button", { name: t.confirmDrafts(1), exact: true }).click();
      await expect(page.getByText(t.draftsCreated, { exact: true })).toBeVisible();
      const done = await api.plannerProposal(orgId, id);
      const sessionId = done.draftIds![0]!.id;
      const edit = await api.editSession(orgId, sessionId);
      await api.publishSession(orgId, sessionId, edit.version);
      await athlete.page.goto(`/seance/${sessionId}`, { waitUntil: "networkidle" });
      await expect(athlete.page.getByText(name, { exact: true }).first()).toBeVisible();
      await expectAccessible(athlete.page);
      await athlete.page.screenshot({ path: "/tmp/tartan-planner-real-athlete.png", fullPage: true });
      expect(
        (
          await sql.query(
            "SELECT count(*) FROM exercises WHERE organization_id=$1 AND name=$2 AND catalog_key IS NULL",
            [orgId, name],
          )
        ).rows[0].count,
      ).toBe("1");
      const draft = (await sql.query("SELECT draft FROM scheduled_sessions WHERE id=$1", [sessionId])).rows[0].draft;
      expect(draft.blocks[0].items[0].prescription).toMatchObject({ sets: 3, reps: 5, rest_s: 60 });
      expect(draft.blocks[0].items[0].prescription.load ?? null).toBeNull();
    } finally {
      await athlete.context.close();
    }
  } finally {
    await sql.end();
  }
});
