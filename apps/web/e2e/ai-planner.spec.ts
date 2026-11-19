import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { createApiClient } from "../../../packages/api-client/src/index";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

// Recette du planificateur avec le prestataire factice du serveur (AI_PLANNER_FAKE_PROVIDER) : aucune clé, aucun
// appel externe. Tout le reste est réel : réponse diffusée, services, quotas, brouillons et écritures.
test.skip(
  process.env.E2E_AI_PLANNER_ENABLED !== "true",
  "Recette dédiée : drapeau global actif et prestataire factice, sans clé.",
);
// La dictée s'exerce avec le micro et l'autorisation simulés par Chromium.
test.use({ launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });
const t = w.planner;
const old = m.aiPlanner;
const db = () =>
  new Client({ connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e" });

async function setup(page: Page) {
  await createCoachSpace(page, "Planification");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId as string;
  const sql = db();
  await sql.connect();
  await sql.query(
    "UPDATE organizations SET ai_planner_enabled=true, progression_enabled=true, phases_enabled=true, plan='coach', available_equipment='{cones,bodyweight}' WHERE id=$1",
    [orgId],
  );
  await sql.query("UPDATE profiles SET ai_consent_at=now() WHERE id=$1", [me.id]);
  const api = createApiClient({
    baseUrl: new URL(page.url()).origin,
    headers: async () => ({ Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") }),
  });
  const group = (await sql.query("SELECT id FROM groups WHERE organization_id=$1", [orgId])).rows[0].id as string;
  // La fiche que les deux modes retiennent : la copie de l'espace si elle existe, sinon la fiche commune.
  const squat = (
    await sql.query(
      "SELECT id FROM exercises WHERE name='Squat arrière' AND deleted_at IS NULL AND (organization_id=$1 OR organization_id IS NULL) ORDER BY organization_id IS NULL LIMIT 1",
      [orgId],
    )
  ).rows[0].id as string;
  return { sql, orgId, api, group, squat, userId: me.id as string };
}
type Setup = Awaited<ReturnType<typeof setup>>;
// Deux athlètes fictifs dans le groupe, sans compte : assez pour l'aperçu individuel et la couverture.
const athletes = async (a: Setup, count = 2) => {
  const ids: string[] = [];
  for (let index = 0; index < count; index++) {
    const id = randomUUID();
    await a.sql.query(
      "INSERT INTO athletes (id,organization_id,first_name,last_name,updated_at) VALUES ($1,$2,$3,'Fictif',now())",
      [id, a.orgId, `Athlète ${index + 1}`],
    );
    await a.sql.query(
      "INSERT INTO group_members (group_id,athlete_id,created_at,updated_at) VALUES ($1,$2,'2020-01-01',now())",
      [a.group, id],
    );
    ids.push(id);
  }
  return ids;
};
const reference = (a: Setup, athleteId: string, valueKg: number) =>
  a.api.selectStrengthReference(a.orgId, athleteId, a.squat, { source: "working", valueKg });
const sessionsOf = async (a: Setup) =>
  (
    await a.sql.query(
      "SELECT draft, start_time, published_at FROM scheduled_sessions WHERE organization_id=$1 ORDER BY created_at",
      [a.orgId],
    )
  ).rows as {
    draft: { blocks: { items: { prescription: Record<string, unknown> }[] }[] };
    start_time: string | null;
    published_at: string | null;
  }[];
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

test("l'aperçu individuel des charges : chaque athlète, sa référence, une adaptation, puis le brouillon", async ({
  page,
}) => {
  const a = await setup(page);
  try {
    const [first, second] = await athletes(a);
    await reference(a, first!, 100);
    await request(page, "Demain, Squat arrière, 3 séries de 4 à 80 %, repos 2 minutes.");
    await page.getByRole("button", { name: t.prepare, exact: true }).click();
    await expect(page.getByRole("heading", { name: t.sessionTitle, exact: true })).toBeVisible({ timeout: 30_000 });
    // Un pourcentage se convertit pour chacun : l'aperçu est exigé avant la création.
    await expect(page.getByText(t.loadsFirst, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: t.create, exact: true })).toBeDisabled();
    await page.getByRole("button", { name: old.previewLoads, exact: true }).click();
    await expect(page.getByText(old.previewCoverage(2, 2), { exact: true })).toBeVisible();
    const rows = page.getByRole("group", { name: old.loadRows, exact: true });
    const one = rows.getByRole("button", { name: /^Athlète 1 Fictif / });
    const two = rows.getByRole("button", { name: /^Athlète 2 Fictif / });
    await expect(two).toHaveAccessibleName(`Athlète 2 Fictif ${old.loadRowSummary(1, 1, 0)}`);
    await one.click();
    // Le prestataire simulé propose 3 × 8 ; la référence de 100 kg donne 80 kg à 80 %.
    await expect(page.getByText(/3 × 8 rép.*80 kg/).first()).toBeVisible();
    await two.click();
    await expect(page.getByText(old.loadUndefined, { exact: false }).first()).toBeVisible();
    await page.getByRole("button", { name: old.adaptLoad, exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: old.adaptLoad, exact: true });
    await dialog.getByLabel(m.nativeBuilder.unit, { exact: true }).selectOption("kg");
    await dialog.getByLabel(m.builder.load, { exact: true }).fill("35");
    await dialog.getByRole("button", { name: m.nativeBuilder.apply, exact: true }).click();
    await expect(two).toHaveAccessibleName(`Athlète 2 Fictif ${old.loadRowSummary(1, 0, 1)}`);
    await expectAccessible(page);
    await page.getByRole("button", { name: t.create, exact: true }).click();
    await expect(page.getByText(t.created, { exact: true })).toBeVisible({ timeout: 30_000 });
    const overrides = await a.sql.query(
      "SELECT o.athlete_id, o.prescription FROM athlete_overrides o JOIN scheduled_sessions s ON s.id=o.scheduled_session_id WHERE s.organization_id=$1",
      [a.orgId],
    );
    expect(overrides.rows).toEqual([{ athlete_id: second, prescription: { load: { type: "kg", value: 35 } } }]);
    const [session] = await sessionsOf(a);
    expect(session!.draft.blocks[0]!.items[0]!.prescription.load).toMatchObject({ type: "pct_1rm", value: 80 });
  } finally {
    await a.sql.end();
  }
});

test("la dictée : accord, annulation, transcription, correction du texte avant l'envoi", async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const streams: MediaStream[] = [];
    (window as unknown as { audioTestStreams: MediaStream[] }).audioTestStreams = streams;
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      streams.push(stream);
      return stream;
    };
  });
  const a = await setup(page);
  let uploads = 0;
  const released = () =>
    page.evaluate(() =>
      (window as unknown as { audioTestStreams: MediaStream[] }).audioTestStreams.every((s) =>
        s.getTracks().every((track) => track.readyState === "ended"),
      ),
    );
  try {
    // Seule la transcription d'OpenAI est simulée : le serveur lit réellement l'audio envoyé, puis s'arrête sans clé.
    await page.route(`**/api/v1/orgs/${a.orgId}/planner/transcriptions`, async (route) => {
      uploads++;
      const bytes = route.request().postDataBuffer()!;
      const contentType = route.request().headers()["content-type"]!;
      const form = await new Request(route.request().url(), {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: new Uint8Array(bytes),
      }).formData();
      expect((form.get("audio") as File).size).toBeGreaterThan(100);
      const metadata = JSON.parse(String(form.get("metadata")));
      expect(metadata.audioProcessingAccepted).toBe(true);
      const inspected = await page.request.post(route.request().url(), {
        headers: { "Content-Type": contentType },
        data: bytes,
      });
      expect(inspected.status()).toBe(502);
      await route.fulfill({
        status: 200,
        json: {
          id: metadata.id,
          version: 2,
          state: "ready",
          text: "Demain, Squat arrière : trois séries de quatre à quarante kilos.",
          audioSeconds: 2,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      });
    });
    await page.goto(`/planificateur?groupe=${a.group}`);
    await expect(page.getByRole("button", { name: "Hauteur Élite", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("button", { name: old.dictate, exact: true })).toBeDisabled();
    await page.getByRole("checkbox", { name: old.acceptAudio, exact: true }).check();
    await page.getByRole("button", { name: old.dictate, exact: true }).click();
    await expect(page.getByText(/Enregistrement : 0 min 0[1-9] s/)).toBeVisible();
    await page.getByRole("button", { name: old.cancelDictation, exact: true }).click();
    expect(uploads).toBe(0);
    await expect.poll(released).toBe(true);
    await page.getByRole("button", { name: old.dictate, exact: true }).click();
    await expect(page.getByText(/Enregistrement : 0 min 0[1-9] s/)).toBeVisible();
    await page.getByRole("button", { name: old.stopDictation, exact: true }).click();
    const text = page.getByRole("textbox", { name: t.instructions, exact: true });
    await expect(text).toHaveValue("Demain, Squat arrière : trois séries de quatre à quarante kilos.");
    expect(uploads).toBe(1);
    await expect.poll(released).toBe(true);
    // Le coach corrige la transcription : c'est son texte relu qui part, pas celui de la dictée.
    await text.fill("Demain, Squat arrière : trois séries de quatre à cinquante kilos.");
    await page.getByRole("button", { name: t.prepare, exact: true }).click();
    await expect(page.getByRole("heading", { name: t.sessionTitle, exact: true })).toBeVisible({ timeout: 30_000 });
    const id = new URL(page.url()).searchParams.get("proposition")!;
    expect((await a.api.plannerProposal(a.orgId, id)).messages).toEqual([
      "Demain, Squat arrière : trois séries de quatre à cinquante kilos.",
    ]);
    expect((await a.api.plannerUsage(a.orgId)).used.audioSeconds).toBe(0);
  } finally {
    await a.sql.end();
  }
});

test("un mouvement inconnu : création privée relue, reprise, puis le brouillon avec la nouvelle fiche", async ({
  page,
}) => {
  const a = await setup(page);
  const name = "Bond maison fictif";
  try {
    await request(page, `Demain : ${name}, 3 séries de 5, repos 90 secondes.`);
    await page.getByRole("button", { name: t.prepare, exact: true }).click();
    // Le nom absent de la bibliothèque devient une question nommée, sans appel au modèle.
    await expect(page.getByRole("heading", { name: t.questions, exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: old.createPrivateExercise, exact: true }).click();
    await page.getByLabel(old.movementCues, { exact: true }).fill("Réception contrôlée, appuis stables.");
    await page.getByLabel(m.exercises.category, { exact: true }).selectOption("plyo");
    await page.getByRole("checkbox", { name: old.privateExerciseReviewed, exact: true }).check();
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await page.getByRole("button", { name: old.savePrivateExercise, exact: true }).click();
    await expect(page.getByText(old.exerciseResolved(name), { exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: t.answer, exact: true }).fill("C'est bien ce bond.");
    await page.getByRole("button", { name: t.sendAnswer, exact: true }).click();
    await expect(page.getByRole("heading", { name: t.sessionTitle, exact: true })).toBeVisible({ timeout: 30_000 });
    // La nouvelle fiche est dans l'éditeur de séquence du constructeur.
    await expect(page.getByRole("button", { name: new RegExp(name) }).first()).toBeVisible();
    await page.getByRole("button", { name: t.create, exact: true }).click();
    await expect(page.getByText(t.created, { exact: true })).toBeVisible({ timeout: 30_000 });
    const created = await a.sql.query(
      "SELECT id FROM exercises WHERE organization_id=$1 AND name=$2 AND catalog_key IS NULL",
      [a.orgId, name],
    );
    expect(created.rows).toHaveLength(1);
    const [session] = await sessionsOf(a);
    expect(JSON.stringify(session!.draft)).toContain(created.rows[0].id);
  } finally {
    await a.sql.end();
  }
});

test("le mode « Proposer » de bout en bout : date, heure et destinataires posés par le serveur, brouillon créé", async ({
  page,
}) => {
  const a = await setup(page);
  try {
    await page.goto("/planificateur");
    await page.getByRole("button", { name: "Hauteur Élite", exact: true }).click();
    await page.getByText(t.modes.propose.title, { exact: true }).click();
    await page.getByRole("textbox", { name: t.objective, exact: true }).fill("Préparation physique générale.");
    await page.getByLabel(t.time, { exact: true }).fill("07:30");
    await page.getByRole("button", { name: t.durationValue(30), exact: true }).click();
    await expectAccessible(page);
    await page.getByRole("button", { name: t.prepare, exact: true }).click();
    await expect(page.getByRole("heading", { name: t.sessionTitle, exact: true })).toBeVisible({ timeout: 30_000 });
    const id = new URL(page.url()).searchParams.get("proposition")!;
    const proposal = await a.api.plannerProposal(a.orgId, id);
    expect(proposal.selection.mode).toBe("propose");
    expect(proposal.interpretation!.sessions[0]!).toMatchObject({
      date: proposal.selection.brief!.date,
      targetTokens: ["group_1"],
      durationMin: 30,
    });
    await page.getByText(old.editSchedule, { exact: true }).click();
    await expect(page.getByLabel(m.builder.time, { exact: true })).toHaveValue("07:30");
    await page.getByRole("button", { name: t.create, exact: true }).click();
    await expect(page.getByText(t.created, { exact: true })).toBeVisible({ timeout: 30_000 });
    const [session] = await sessionsOf(a);
    expect(session).toMatchObject({ start_time: "07:30", published_at: null });
  } finally {
    await a.sql.end();
  }
});

test("en mode « Proposer », un % 1RM n'existe que si chaque destinataire a sa référence de force", async ({ page }) => {
  const a = await setup(page);
  try {
    await a.sql.query("UPDATE organizations SET available_equipment='{barbell,rack,bodyweight}' WHERE id=$1", [
      a.orgId,
    ]);
    const [first, second] = await athletes(a);
    await reference(a, first!, 100);
    const propose = async () => {
      await page.goto("/planificateur");
      await page.getByRole("button", { name: "Hauteur Élite", exact: true }).click();
      await page.getByText(t.modes.propose.title, { exact: true }).click();
      await page.getByRole("textbox", { name: t.objective, exact: true }).fill("Squat arrière à 80 % du maximum.");
      await page.getByRole("button", { name: t.prepare, exact: true }).click();
      await expect(page.getByRole("heading", { name: t.sessionTitle, exact: true })).toBeVisible({ timeout: 30_000 });
    };
    // Une référence manque : le pourcentage ne serait résolu pour personne, il est retiré.
    await propose();
    await expect(page.getByText(t.loadsFirst, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: t.create, exact: true }).click();
    await expect(page.getByText(t.created, { exact: true })).toBeVisible({ timeout: 30_000 });
    expect((await sessionsOf(a))[0]!.draft.blocks[0]!.items[0]!.prescription).not.toHaveProperty("load");
    // Chaque destinataire a sa référence : le pourcentage reste, Tartan le convertit pour chacun.
    await reference(a, second!, 90);
    await propose();
    await expect(page.getByText(t.loadsFirst, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: old.previewLoads, exact: true }).click();
    await expect(page.getByText(old.previewCoverage(2, 2), { exact: true })).toBeVisible();
    await page.getByRole("button", { name: t.create, exact: true }).click();
    await expect(page.getByText(t.created, { exact: true })).toBeVisible({ timeout: 30_000 });
    expect((await sessionsOf(a))[1]!.draft.blocks[0]!.items[0]!.prescription.load).toMatchObject({
      type: "pct_1rm",
      value: 80,
    });
  } finally {
    await a.sql.end();
  }
});
