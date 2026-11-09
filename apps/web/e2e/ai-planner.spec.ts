import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { createApiClient } from "../../../packages/api-client/src/index";
import type { CreatePlannerProposalInput, PlannerInterpretation } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

test.skip(
  process.env.E2E_AI_PLANNER_ENABLED !== "true",
  "Recette dédiée : drapeau global actif et aucune clé prestataire.",
);
test.use({ launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });
const t = m.aiPlanner;
const db = () =>
  new Client({ connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e" });
async function setup(page: Page) {
  await createCoachSpace(page, "Planification");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId as string;
  const api = createApiClient({
    baseUrl: new URL(page.url()).origin,
    headers: async () => ({ Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") }),
  });
  const sql = db();
  await sql.connect();
  await sql.query(
    "UPDATE organizations SET ai_planner_enabled=true, progression_enabled=true, phases_enabled=true, plan='coach' WHERE id=$1",
    [orgId],
  );
  await sql.query("UPDATE profiles SET ai_consent_at=now() WHERE id=$1", [me.id]);
  const context = await api.sessionBuilder(orgId);
  const group = context.groups[0]!;
  const exercise = context.exercises.find((e) => e.name === "Squat arrière")!;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  return { api, sql, orgId, context, group, exercise, today, userId: me.id as string };
}

test("contexte, clarification, reprise, aperçu, correction et confirmation perdue créent un seul brouillon", async ({
  page,
}, info) => {
  const a = await setup(page);
  const ids = Array.from({ length: 12 }, () => randomUUID()).sort();
  try {
    for (const [index, id] of ids.entries()) {
      await a.sql.query(
        "INSERT INTO athletes (id,organization_id,first_name,last_name,updated_at) VALUES ($1,$2,$3,'Fictif',now())",
        [id, a.orgId, `Athlète ${index + 1}`],
      );
      await a.sql.query(
        "INSERT INTO group_members (group_id,athlete_id,created_at,updated_at) VALUES ($1,$2,'2020-01-01',now())",
        [a.group.id, id],
      );
    }
    await a.api.selectStrengthReference(a.orgId, ids[0]!, a.exercise.id, { source: "working", valueKg: 100 });
    let input: CreatePlannerProposalInput | undefined;
    let generations = 0,
      clarifications = 0;
    // Seule la frontière d'interprétation est simulée. Les services de lecture,
    // phases, charges, confirmation, séances et toutes leurs écritures sont réels.
    await page.route(`**/api/v1/orgs/${a.orgId}/planner`, async (route) => {
      input = route.request().postDataJSON() as CreatePlannerProposalInput;
      generations++;
      expect(input.reviewed).toBe(true);
      const phase = await a.api.phasePlanning(a.orgId, {
        date: a.today,
        groupIds: [a.group.id],
        athleteIds: [],
        choices: [],
      });
      const updated = (
        await a.sql.query("SELECT updated_at AT TIME ZONE 'UTC' AS updated_at FROM exercises WHERE id=$1", [
          a.exercise.id,
        ])
      ).rows[0].updated_at as Date;
      const bindings = {
        today: a.today,
        timeZone: "Europe/Paris",
        targets: [{ token: "group_1", id: a.group.id, type: "group", label: a.group.name, aliases: [a.group.name] }],
        exercises: [
          {
            token: "exercise_1",
            id: a.exercise.id,
            name: a.exercise.name,
            category: a.exercise.category,
            updatedAt: updated.toISOString(),
          },
        ],
        phaseReviews: [{ date: a.today, review: { token: phase.token, choices: [] } }],
        phaseCalendar: [],
      };
      const interpretation = {
        status: "clarification",
        sessions: [],
        assumptions: [],
        suggestions: [],
        questions: [
          {
            id: "repos",
            field: "rest",
            question: "Quel repos pour exercise_1 de group_1 ?",
            options: ["Deux minutes"],
          },
        ],
      };
      await a.sql.query(
        `INSERT INTO ai_planner_proposals (id,organization_id,actor_id,creation_fingerprint,state,version,selection,bindings,messages,interpretation,active_operation_id,expires_at,created_at,updated_at)
        VALUES ($1,$2,$3,'frontiere-prestataire-simulee','clarification',2,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$1,now()+interval '7 days',now(),now())`,
        [
          input.id,
          a.orgId,
          a.userId,
          JSON.stringify(input.selection),
          JSON.stringify(bindings),
          JSON.stringify([input.text]),
          JSON.stringify(interpretation),
        ],
      );
      await route.fulfill({ status: 200, json: await a.api.plannerProposal(a.orgId, input.id) });
    });
    await page.route(`**/api/v1/orgs/${a.orgId}/planner/proposals/*/clarify`, async (route) => {
      const body = route.request().postDataJSON();
      clarifications++;
      expect(body.reviewed).toBe(true);
      const interpretation: PlannerInterpretation = {
        status: "proposal",
        questions: [],
        assumptions: [],
        suggestions: [],
        sessions: [
          {
            date: a.today,
            startTime: "18:00",
            title: Array(10).fill("group_1").join(" "),
            type: "strength",
            durationMin: 45,
            targetTokens: ["group_1"],
            blocks: [
              {
                name: Array(6).fill("exercise_1").join(" "),
                items: [
                  {
                    exerciseToken: "exercise_1",
                    instruction: input!.text,
                    prescription: {
                      sets: 3,
                      reps: 4,
                      restS: 120,
                      load: { type: "pct_1rm", value: 80 },
                      intensityTarget: { type: "rpe", value: 7 },
                      distanceM: null,
                      durationS: null,
                      tempo: null,
                      contacts: null,
                      notes: Array(40).fill("exercise_1").join(" "),
                    },
                  },
                ],
              },
            ],
          },
        ],
      };
      await a.sql.query(
        "UPDATE ai_planner_proposals SET state='proposal',version=3,clarification_count=1,messages=$2::jsonb,interpretation=$3::jsonb,updated_at=now() WHERE id=$1",
        [input!.id, JSON.stringify([input!.text, body.text]), JSON.stringify(interpretation)],
      );
      await route.fulfill({ status: 200, json: await a.api.plannerProposal(a.orgId, input!.id) });
    });
    await page.goto(`/calendrier?semaine=${a.today}&groupe=${a.group.id}`);
    await page.getByRole("link", { name: t.title, exact: true }).click();
    await expect(page.getByRole("checkbox", { name: `${a.group.name} (12)` })).toBeChecked();
    // Le calendrier conserve le lundi affiché : la recette choisit explicitement aujourd'hui.
    await page.getByLabel(m.trainingPhases.start, { exact: true }).fill(a.today);
    await page.getByLabel(m.trainingPhases.end, { exact: true }).fill(a.today);
    await page.getByRole("button", { name: t.chooseContext, exact: true }).click();
    await page
      .getByLabel(t.instructions, { exact: true })
      .fill("Squat arrière, trois séries de quatre à 80 % pour le groupe.");
    await expect(page.getByRole("button", { name: t.propose, exact: true })).toBeDisabled();
    await page.getByRole("checkbox", { name: t.reviewed, exact: true }).check();
    await page.getByRole("button", { name: t.propose, exact: true }).click();
    await expect(page.getByRole("heading", { name: t.clarifyTitle })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: t.clarifyTitle })).toBeVisible();
    expect(generations).toBe(1);
    await expect(
      page.getByText(`Quel repos pour ${a.exercise.name} de ${a.group.name} ?`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Quel repos pour exercise_1 de group_1 ?", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Deux minutes", exact: true }).click();
    await expect(page.getByLabel(t.clarificationAnswer, { exact: true })).toHaveValue(
      `Quel repos pour ${a.exercise.name} de ${a.group.name} ? Deux minutes`,
    );
    await page.getByRole("checkbox", { name: t.reviewed, exact: true }).check();
    await page.getByRole("button", { name: t.clarify, exact: true }).click();
    await page.getByRole("button", { name: t.prepareReview, exact: true }).click();
    const initialReview = page.getByRole("region", { name: Array(10).fill(a.group.name).join(" "), exact: true });
    await expect(initialReview).toBeVisible();
    await expect(initialReview.getByRole("button", { name: t.previewLoads, exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: t.confirmDrafts(1), exact: true })).toBeDisabled();
    await initialReview.getByText(t.editSchedule, { exact: true }).click();
    await expect(initialReview.getByLabel(m.builder.title, { exact: true })).toHaveValue(
      Array(10).fill(a.group.name).join(" "),
    );
    await initialReview.getByLabel(m.builder.title, { exact: true }).fill("Force fictive");
    const review = page.getByRole("region", { name: "Force fictive", exact: true });
    await expect(review.getByLabel(m.nativeBuilder.blockName, { exact: true })).toHaveValue(
      Array(6).fill(a.exercise.name).join(" "),
    );
    await review.getByLabel(m.nativeBuilder.blockName, { exact: true }).fill("Force");
    await review.getByText(m.builder.setPrescription, { exact: true }).click();
    await expect(review.getByLabel(m.builder.notes, { exact: true })).toHaveValue(
      Array(40).fill(a.exercise.name).join(" "),
    );
    await review.getByLabel(m.builder.notes, { exact: true }).fill("Consigne relue.");
    await review.getByText(m.builder.setPrescription, { exact: true }).click();
    await expect(page.getByRole("button", { name: t.confirmDrafts(1), exact: true })).toBeDisabled();
    await review.getByRole("button", { name: t.previewLoads, exact: true }).click();
    await expect(review.getByText(t.previewCoverage(10, 12), { exact: true })).toBeVisible();
    const loadRows = review.getByRole("group", { name: t.loadRows, exact: true });
    await expect(loadRows.getByRole("button", { expanded: false })).toHaveCount(10);
    await expect(loadRows.getByRole("button", { name: t.adaptLoad, exact: true })).toHaveCount(0);
    const firstAthlete = loadRows.getByRole("button", { name: /^Athlète 1 Fictif / });
    const secondAthlete = loadRows.getByRole("button", {
      name: /^Athlète 2 Fictif /,
    });
    await expect(secondAthlete).toHaveAccessibleName(`Athlète 2 Fictif ${t.loadRowSummary(1, 1, 0)}`);
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(page);
      expect((await loadRows.boundingBox())!.height).toBeLessThan(1300);
    }
    await page.setViewportSize(
      info.project.name === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    );
    await loadRows.screenshot({ path: info.outputPath("charges-compactes.png") });
    await firstAthlete.focus();
    await firstAthlete.press("Enter");
    await expect(firstAthlete).toHaveAttribute("aria-expanded", "true");
    await expect(review.getByText(/3 × 4.*80 kg/)).toBeVisible();
    await secondAthlete.click();
    await expect(firstAthlete).toHaveAttribute("aria-expanded", "false");
    await expect(review.getByText(t.loadUndefined, { exact: false }).first()).toBeVisible();
    await review.getByRole("button", { name: t.nextAthletes, exact: true }).click();
    await expect(review.getByText(t.previewCoverage(12, 12), { exact: true })).toBeVisible();
    await review.getByRole("button", { name: t.previousAthletes, exact: true }).click();
    await firstAthlete.click();
    await review.getByRole("button", { name: t.adaptLoad, exact: true }).first().click();
    const modal = page.getByRole("dialog", { name: t.adaptLoad, exact: true });
    await modal.getByLabel(m.nativeBuilder.unit, { exact: true }).selectOption("kg");
    await modal.getByLabel(m.builder.load, { exact: true }).fill("35");
    await modal.getByRole("button", { name: m.nativeBuilder.apply, exact: true }).click();
    await expect(review.getByText(/3 × 4.*35 kg/)).toBeVisible();
    await expect(firstAthlete).toHaveAttribute("aria-expanded", "true");
    await expect(firstAthlete).toHaveAccessibleName(`Athlète 1 Fictif ${t.loadRowSummary(1, 0, 1)}`);
    await review.getByText(m.builder.setPrescription, { exact: true }).click();
    await review.getByLabel(m.nativeBuilder.intensity, { exact: true }).selectOption("rir");
    await review.getByLabel(m.nativeBuilder.intensityValue, { exact: true }).fill("3");
    await page.getByRole("checkbox", { name: t.reviewedDrafts, exact: true }).check();
    // Une correction après relecture retire l'accord et invalide l'ancien aperçu.
    await review.getByLabel(m.nativeBuilder.intensityValue, { exact: true }).fill("2");
    await expect(page.getByRole("checkbox", { name: t.reviewedDrafts, exact: true })).not.toBeChecked();
    await review.getByText(m.builder.setPrescription, { exact: true }).click();
    await expect(review.getByText(/3 × 4.*35 kg/)).toBeVisible();
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("planificateur-revue.png"), fullPage: true });
    await page.getByRole("checkbox", { name: t.reviewedDrafts, exact: true }).check();
    await page.route(
      `**/api/v1/orgs/${a.orgId}/planner/proposals/*/confirm`,
      async (route) => {
        const result = await route.fetch();
        expect(result.status()).toBe(200);
        await route.abort("failed");
      },
      { times: 1 },
    );
    await page.getByRole("button", { name: t.confirmDrafts(1), exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByRole("button", { name: t.refresh, exact: true }).click();
    await expect(page.getByText(t.draftsCreated, { exact: true })).toBeVisible();
    expect(generations).toBe(1);
    expect(clarifications).toBe(1);
    const created = await a.api.plannerProposal(a.orgId, input!.id);
    expect(created.draftIds).toHaveLength(1);
    const session = await a.api.editSession(a.orgId, created.draftIds![0]!.id);
    expect(session.publishedAt).toBeNull();
    expect(session.draft.blocks[0]!.name).toBe("Force");
    expect(session.draft.blocks[0]!.items[0]!.prescription.notes).toBe("Consigne relue.");
    expect(session.draft.blocks[0]!.items[0]!.prescription.intensityTarget).toEqual({ type: "rir", value: 2 });
    expect(session.overrides[0]!.prescription.load).toEqual({ type: "kg", value: 35 });
    expect(
      (await a.sql.query("SELECT count(*) FROM scheduled_sessions WHERE organization_id=$1", [a.orgId])).rows[0].count,
    ).toBe("1");
    await page.getByRole("link", { name: t.recent, exact: true }).click();
    await expect(page.getByRole("link", { name: new RegExp(t.recentStates.committed) })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(t.recentStates.committed) }).click();
    await expect(page.getByText(t.draftsCreated, { exact: true })).toBeVisible();
  } finally {
    await a.sql.end();
  }
});

test("micro navigateur : annulation, audio réel synthétique, relecture avant génération", async ({ page, context }) => {
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
  try {
    await page.route(`**/api/v1/orgs/${a.orgId}/planner/transcriptions`, async (route) => {
      uploads++;
      const bytes = route.request().postDataBuffer()!;
      const contentType = route.request().headers()["content-type"]!;
      const request = new Request(route.request().url(), {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: new Uint8Array(bytes),
      });
      const form = await request.formData();
      const audio = form.get("audio") as File;
      expect(audio.size).toBeGreaterThan(100);
      expect(audio.size).toBeLessThan(3 * 1024 * 1024);
      const metadata = JSON.parse(String(form.get("metadata")));
      expect(metadata.audioProcessingAccepted).toBe(true);
      // Le serveur lit réellement ce WebM et réserve/restitue le quota. Sans clé,
      // il s'arrête à l'adaptateur ; aucun appel OpenAI n'est possible.
      const inspected = await page.request.post(route.request().url(), {
        headers: { "Content-Type": contentType },
        data: bytes,
      });
      expect(inspected.status()).toBe(502);
      expect((await inspected.json()).code).toBe("planner_transcription_failed");
      await route.fulfill({
        status: 200,
        json: {
          id: metadata.id,
          version: 2,
          state: "ready",
          text: "Squat arrière : trois séries de quatre à quarante kilos.",
          audioSeconds: 2,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      });
    });
    await page.goto(`/planificateur?date=${a.today}&groupe=${a.group.id}`);
    await page.getByRole("button", { name: t.chooseContext, exact: true }).click();
    await expect(page.getByRole("button", { name: t.dictate, exact: true })).toBeDisabled();
    await page.getByRole("checkbox", { name: t.acceptAudio, exact: true }).check();
    await page.getByRole("button", { name: t.dictate, exact: true }).click();
    await expect(page.getByText(/Enregistrement : 0 min 0[1-9] s/)).toBeVisible();
    await page.getByRole("button", { name: t.cancelDictation, exact: true }).click();
    expect(uploads).toBe(0);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as { audioTestStreams: MediaStream[] }).audioTestStreams.every((s) =>
            s.getTracks().every((track) => track.readyState === "ended"),
          ),
        ),
      )
      .toBe(true);
    await page.getByRole("button", { name: t.dictate, exact: true }).click();
    await expect(page.getByText(/Enregistrement : 0 min 0[1-9] s/)).toBeVisible();
    await page.getByRole("button", { name: t.stopDictation, exact: true }).click();
    await expect(page.getByLabel(t.instructions, { exact: true })).toHaveValue(
      "Squat arrière : trois séries de quatre à quarante kilos.",
    );
    await expect(page.getByRole("checkbox", { name: t.reviewed, exact: true })).not.toBeChecked();
    await expect(page.getByRole("button", { name: t.propose, exact: true })).toBeDisabled();
    expect(uploads).toBe(1);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as { audioTestStreams: MediaStream[] }).audioTestStreams.every((s) =>
            s.getTracks().every((track) => track.readyState === "ended"),
          ),
        ),
      )
      .toBe(true);
    expect((await a.api.plannerUsage(a.orgId)).used.audioSeconds).toBe(0);
  } finally {
    await a.sql.end();
  }
});
