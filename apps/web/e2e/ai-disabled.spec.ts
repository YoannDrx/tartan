import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { createApiClient } from "../../../packages/api-client/src/index";
import { createCoachSpace } from "./helpers";

test("le build de production refuse l'IA désactivée sans perturber le constructeur manuel", async ({ page }) => {
  const unauthorized = await page.request.post(`/api/v1/orgs/${randomUUID()}/planner/transcriptions`, {
    multipart: {
      metadata: "{}",
      audio: { name: "invalid.wav", mimeType: "audio/wav", buffer: Buffer.from("not audio") },
    },
  });
  expect(unauthorized.status()).toBe(401);
  await createCoachSpace(page, "PlanificateurFerme");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId;
  expect(me.spaces[0].aiPlannerEnabled).toBe(false);
  const api = createApiClient({
    baseUrl: new URL(page.url()).origin,
    headers: async () => ({ Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") }),
  });
  const context = await api.sessionBuilder(orgId);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  await expect(api.plannerUsage(orgId)).rejects.toMatchObject({ status: 403, code: "planner_disabled" });
  await expect(
    api.createPlannerProposal(orgId, {
      id: randomUUID(),
      requestedAt: new Date().toISOString(),
      reviewed: true,
      text: "Séance fictive à ne pas envoyer",
      selection: {
        period: { from: today, to: today },
        groupIds: [context.groups[0]!.id],
        athleteIds: [],
        exerciseIds: [],
        phaseChoices: [],
      },
    }),
  ).rejects.toMatchObject({ status: 403, code: "planner_disabled" });
  const upload = new FormData();
  upload.set(
    "metadata",
    JSON.stringify({ id: randomUUID(), requestedAt: new Date().toISOString(), audioProcessingAccepted: true }),
  );
  upload.set("audio", new Blob(["not audio"], { type: "audio/wav" }), "invalid.wav");
  await expect(api.transcribePlannerAudio(orgId, upload)).rejects.toMatchObject({
    status: 403,
    code: "planner_disabled",
  });
  const saved = await api.createSession(orgId, {
    date: today,
    startTime: null,
    location: null,
    publishAt: null,
    overrides: [],
    assignments: [{ targetType: "group", targetId: context.groups[0]!.id }],
    draft: {
      title: "Préparation manuelle conservée",
      type: "strength",
      durationMin: 40,
      coachNote: null,
      blocks: [
        {
          name: "Force",
          variant: "club",
          items: [{ exerciseId: context.exercises[0]!.id, prescription: { sets: 3, reps: 4 } }],
        },
      ],
    },
  });
  await api.publishSession(orgId, saved.id, saved.version);
  await page.goto(`/seances/${saved.id}`);
  await expect(page.getByLabel("Titre", { exact: true })).toHaveValue("Préparation manuelle conservée");
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    for (const table of [
      "ai_planner_operations",
      "ai_planner_quotas",
      "ai_planner_transcriptions",
      "ai_planner_proposals",
    ])
      expect((await sql.query(`SELECT count(*) FROM ${table} WHERE organization_id = $1`, [orgId])).rows[0].count).toBe(
        "0",
      );
  } finally {
    await sql.end();
  }
});
