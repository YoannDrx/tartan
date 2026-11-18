import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

// Recette du planificateur avec le prestataire factice du serveur (AI_PLANNER_FAKE_PROVIDER) : aucune clé, aucun
// appel externe. Tout le reste est réel : réponse diffusée, services, quotas, brouillons et écritures.
test.skip(
  process.env.E2E_AI_PLANNER_ENABLED !== "true",
  "Recette dédiée : drapeau global actif et prestataire factice, sans clé.",
);
const t = w.planner;
const db = () =>
  new Client({ connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e" });

async function setup(page: Page) {
  await createCoachSpace(page, "Planification");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId as string;
  const sql = db();
  await sql.connect();
  await sql.query(
    "UPDATE organizations SET ai_planner_enabled=true, phases_enabled=true, plan='coach', available_equipment='{cones,bodyweight}' WHERE id=$1",
    [orgId],
  );
  await sql.query("UPDATE profiles SET ai_consent_at=now() WHERE id=$1", [me.id]);
  return { sql, orgId };
}
const request = async (page: Page, text: string) => {
  await page.goto("/planificateur");
  await page.getByRole("button", { name: "Hauteur Élite", exact: true }).click();
  await page.getByRole("textbox", { name: t.instructions, exact: true }).fill(text);
};

test("une demande en un clic, des étapes diffusées, la séance dans le constructeur, un ajustement, un brouillon", async ({
  page,
}) => {
  const a = await setup(page);
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await request(page, "Demain, circuit trois tours : 8 répétitions par exercice, 60 secondes entre les tours.");
    // Le matériel du profil de l'espace préremplit les pastilles du mode « Proposer ».
    await page.getByText(t.modes.propose.title, { exact: true }).click();
    await expect(page.getByRole("button", { name: m.trainingProfile.equipment.cones, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("button", { name: m.trainingProfile.equipment.barbell, exact: true })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await page.getByText(t.modes.format.title, { exact: true }).click();
    await page
      .getByRole("textbox", { name: t.instructions, exact: true })
      .fill("Demain, circuit trois tours : 8 répétitions par exercice, 60 secondes entre les tours.");
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    const streamed = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/v1/orgs/${a.orgId}/planner`) &&
        (response.headers()["content-type"] ?? "").includes("text/event-stream"),
    );
    // Un seul clic : ni « Continuer », ni case « relu ».
    await page.getByRole("button", { name: t.prepare, exact: true }).click();
    await streamed;
    await expect(page.getByText(t.steps.context, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: t.sessionTitle, exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/proposition=/);
    // Le circuit est visible dans l'éditeur de séquence du constructeur.
    const review = page
      .getByRole("region")
      .filter({ has: page.getByLabel(m.nativeBuilder.blockName) })
      .first();
    await expect(review.getByLabel(m.nativeBuilder.blockName, { exact: true })).toHaveValue("Circuit");
    await expect(review.getByLabel(m.builder.sequence.rounds, { exact: true })).toHaveValue("3");
    await review.getByLabel(m.nativeBuilder.blockName, { exact: true }).fill("Circuit du jour");
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    // Ajuster garde la séance et compte à part.
    await page.getByText(t.adjust, { exact: false }).first().click();
    await page.getByRole("textbox", { name: t.adjustLabel, exact: true }).fill("Passe à quatre séries.");
    await page.getByRole("button", { name: t.adjustSend, exact: true }).click();
    await expect(page.getByText(`${t.adjust} · ${t.adjustCount(1, 5)}`, { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    // Une seule confirmation crée le brouillon, sans le publier.
    await page.getByRole("button", { name: t.create, exact: true }).click();
    await expect(page.getByText(t.created, { exact: true })).toBeVisible({ timeout: 30_000 });
    const drafts = await a.sql.query("SELECT published_at FROM scheduled_sessions WHERE organization_id=$1", [a.orgId]);
    expect(drafts.rows).toEqual([{ published_at: null }]);
    for (const width of [768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(page);
    }
  } finally {
    await a.sql.end();
  }
});

test("une panne du prestataire se lit, dit quoi faire et ne décompte rien", async ({ page }) => {
  const a = await setup(page);
  try {
    await request(page, "Demain, squat 3 × 5. #panne-saturated");
    await expect(page.getByText(t.quota(30), { exact: true })).toBeVisible();
    await page.getByRole("button", { name: t.prepare, exact: true }).click();
    const alert = page.getByRole("alert").filter({ hasText: m.aiPlanner.failures.saturated });
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByText(m.aiPlanner.failures.saturated, { exact: true })).toBeVisible();
    await expect(page.getByText(t.quota(30), { exact: true })).toBeVisible();
    const operation = await a.sql.query(
      "SELECT state, failure_code FROM ai_planner_operations WHERE organization_id=$1",
      [a.orgId],
    );
    expect(operation.rows).toEqual([{ state: "refunded", failure_code: "saturated" }]);
    await expectAccessible(page);
  } finally {
    await a.sql.end();
  }
});
