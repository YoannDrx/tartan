import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { createApiClient } from "../../../packages/api-client/src/index";
import { addDays } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";

test("analyse web et transport natif : volumes distincts, filtres, couverture et accessibilité", async ({
  page,
}, info) => {
  await createCoachSpace(page, "Analyse");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId;
  const api = createApiClient({
    baseUrl: new URL(page.url()).origin,
    headers: async () => ({ Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") }),
  });
  const group = (await api.sessionBuilder(orgId)).groups[0]!;
  await page.goto("/exercices");
  await page.getByRole("button", { name: m.exercises.new, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(m.exercises.name, { exact: true }).fill("Squat analyse");
  await dialog.getByLabel(m.exercises.category, { exact: true }).selectOption("strength");
  await dialog.getByText(m.exerciseClassification.title, { exact: true }).click();
  await dialog.getByLabel(m.exerciseClassification.movement, { exact: true }).selectOption("squat");
  await dialog.getByRole("checkbox", { name: m.trainingProfile.equipment.barbell, exact: true }).check();
  await dialog.getByRole("checkbox", { name: m.trainingProfile.equipment.rack, exact: true }).check();
  await dialog.getByLabel(m.strength.convention, { exact: true }).selectOption("external_total");
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await dialog.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: `/tmp/tartan-classification-editor-${info.project.name}.png` });
  await dialog.getByRole("button", { name: m.common.save, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const exercise = (await api.exercises(orgId)).find((e) => e.name === "Squat analyse")!;
  expect(exercise.classification).toEqual({ movement: "squat", equipment: ["barbell", "rack"] });
  const athleteId = randomUUID(),
    exerciseId = exercise.id;
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    await sql.query("UPDATE organizations SET progression_enabled = true, phases_enabled = true WHERE id = $1", [
      orgId,
    ]);
    await sql.query(
      "INSERT INTO athletes (id, organization_id, first_name, last_name, updated_at) VALUES ($1,$2,'Camille','Analyse',now())",
      [athleteId, orgId],
    );
    await sql.query(
      "INSERT INTO group_members (group_id, athlete_id, created_at, updated_at) VALUES ($1,$2,'2020-01-01',now())",
      [group.id, athleteId],
    );
    await sql.query(
      "INSERT INTO athlete_consents (id, athlete_id, kind, version, granted_at) VALUES ($1,$2,'health','test-synthetique',now())",
      [randomUUID(), athleteId],
    );
  } finally {
    await sql.end();
  }
  const context = await api.trainingAnalysisContext(orgId);
  const today = context.today;
  const phase = await api.saveTrainingPhase(orgId, {
    id: randomUUID(),
    expectedVersion: 0,
    name: "Cycle de force",
    kind: "development",
    target: { type: "group", id: group.id },
    startDate: addDays(today, -27),
    endDate: today,
    objective: "",
    description: "",
    privateNote: "SECRET_PHASE_ANALYSE",
  });
  for (let index = 0; index < 4; index++) {
    const session = await api.createSession(orgId, {
      date: addDays(today, -21 + index * 7),
      startTime: null,
      location: null,
      publishAt: null,
      assignments: [{ targetType: "group", targetId: group.id }],
      overrides: [],
      draft: {
        title: `Force ${index}`,
        type: "strength",
        durationMin: 45,
        coachNote: null,
        blocks: [
          {
            name: "Force",
            variant: "club",
            items: [
              {
                exerciseId,
                prescription: {
                  sets: 3,
                  reps: 4,
                  load: { type: "kg", value: 40 },
                  intensityTarget: { type: "rir", value: 3 },
                },
              },
            ],
          },
        ],
      },
    });
    await api.publishSession(orgId, session.id, session.version);
    if (index < 3) {
      const detail = await api.athleteSessionForCoach(orgId, session.id, athleteId);
      await api.logSessionForAthlete(orgId, session.id, athleteId, {
        clientId: randomUUID(),
        status: "partial",
        variantDone: "club",
        expectedVersion: 0,
        expectedSessionVersion: detail.sessionVersion,
        rpe: index === 1 ? null : index + 5,
        durationMin: 40,
        detailedSets: [0, 1].map((setIndex) => ({
          itemRef: "b0-i0",
          setIndex,
          done: true,
          setKind: "work",
          loadKind: "external",
          repetitionScope: "total",
          sideCount: 1,
          reps: 4,
          loadKg: 40,
        })),
      });
    }
  }
  const data = await api.trainingAnalysis(orgId, { from: addDays(today, -27), to: today });
  expect(data.totals).toMatchObject({
    assignedSessions: 4,
    completedSessions: 3,
    planned: { tonnageKg: 1920 },
    actual: { tonnageKg: 960 },
    detailedSessions: 3,
    perceivedLoad: 480,
    loadResponses: 2,
    healthEligibleSessions: 3,
  });
  expect(data.intensity?.current.rows.find((row) => row.metric === "kg")).toMatchObject({
    planned: { mean: 40, count: 4, eligible: 4 },
    actual: { mean: 40, count: 6, eligible: 6 },
  });
  expect(data.classification).toMatchObject({
    items: 4,
    movementKnownItems: 4,
    equipmentKnownItems: 4,
    movements: [{ key: "squat", occurrences: 4, plannedSets: 12, completedWorkSets: 6 }],
  });
  expect(data.classification?.equipment.every((row) => row.occurrences === 4 && row.completedWorkSets === 6)).toBe(
    true,
  );
  expect(JSON.stringify(await api.trainingAnalysisContext(orgId))).not.toContain("SECRET_PHASE_ANALYSE");
  await page.goto("/suivi");
  await page.getByRole("link", { name: m.analysis.title, exact: true }).click();
  await expect(page.getByRole("heading", { name: m.analysis.title, exact: true })).toBeVisible();
  await expect(page.getByText("960", { exact: true })).toBeVisible();
  const intensitySection = page.getByRole("region", { name: m.intensityAnalysis.title, exact: true });
  await expect(intensitySection.getByText(m.intensityAnalysis.observations(6, 6), { exact: true })).toBeVisible();
  await intensitySection.getByLabel(m.intensityAnalysis.chooseMetric, { exact: true }).selectOption("target_rir");
  await expect(intensitySection.getByText(m.intensityAnalysis.values("3", "3", "3"), { exact: true })).toBeVisible();
  await expect(intensitySection.getByText(m.intensityAnalysis.actual, { exact: true })).toHaveCount(0);
  await intensitySection.getByLabel(m.intensityAnalysis.chooseMetric, { exact: true }).selectOption("pct_reference");
  await expect(intensitySection.getByText(m.intensityAnalysis.empty, { exact: true })).toBeVisible();
  await intensitySection.getByLabel(m.intensityAnalysis.chooseMetric, { exact: true }).selectOption("kg");
  await intensitySection.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/tartan-intensity-${info.project.name}.png` });
  const classificationSection = page.getByRole("region", { name: m.exerciseClassification.title, exact: true });
  await classificationSection.getByText(m.exerciseClassification.movement, { exact: true }).click();
  await expect(
    classificationSection.getByText(m.exerciseClassification.movements.squat, { exact: true }),
  ).toBeVisible();
  await classificationSection.getByText(m.exerciseClassification.equipment, { exact: true }).click();
  await expect(classificationSection.getByText(m.trainingProfile.equipment.barbell, { exact: true })).toBeVisible();
  await expect(classificationSection.getByText(m.trainingProfile.equipment.rack, { exact: true })).toBeVisible();
  await classificationSection.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/tartan-classification-analysis-${info.project.name}.png` });
  await page.getByText(m.analysis.table, { exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("heading", { name: m.analysis.healthWeekly, exact: true })).toBeVisible();
  await page.getByText(m.analysis.healthTable, { exact: true }).click();
  const healthTable = page.getByRole("table", { name: m.analysis.healthWeekly, exact: true });
  await expect(healthTable).toBeVisible();
  await expect(healthTable.getByText("200", { exact: true })).toBeVisible();
  await expect(healthTable.getByText("280", { exact: true })).toBeVisible();
  await expect(healthTable.getByText(m.analysis.missing, { exact: true }).first()).toBeVisible();
  await expect(healthTable.getByText("0 / 1", { exact: true })).toBeVisible();
  const healthSection = page.getByRole("region", { name: m.analysis.health, exact: true });
  const healthPath = await healthSection.locator("svg path.stroke-brand").getAttribute("d");
  expect(healthPath?.match(/M/g)).toHaveLength(2);
  expect(healthPath).not.toContain("L");
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await page.getByText(m.analysis.healthTable, { exact: true }).click();
  await healthSection.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/tartan-health-analysis-${info.project.name}.png` });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `/tmp/tartan-analysis-${info.project.name}.png`, fullPage: true });
  await page.getByLabel(m.trainingPhases.target, { exact: true }).selectOption(`athlete:${athleteId}`);
  await page.getByLabel(m.analysis.period, { exact: true }).selectOption(`phase:${phase.id}`);
  await page.getByRole("button", { name: m.analysis.apply, exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: m.analysis.phaseAttributedScope })).toBeVisible();
  await expect(page.getByText("960", { exact: true })).toBeVisible();
  // Editing a phase must not reassign its old sessions. A long union remains queryable with an explicit window.
  await api.saveTrainingPhase(orgId, {
    id: phase.id,
    expectedVersion: phase.version,
    name: "Cycle de force",
    kind: "development",
    target: { type: "group", id: group.id },
    startDate: addDays(today, 400),
    endDate: addDays(today, 428),
    objective: "",
    description: "",
    privateNote: "SECRET_PHASE_ANALYSE",
  });
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: m.analysis.invalid })).toBeVisible();
  await page.getByLabel(m.analysis.rangeFrom, { exact: true }).fill(addDays(today, -27));
  await page.getByLabel(m.analysis.rangeTo, { exact: true }).fill(today);
  await page.getByRole("button", { name: m.analysis.applyRange, exact: true }).click();
  await expect(page.getByText("960", { exact: true })).toBeVisible();
  await page.getByLabel(m.trainingPhases.target, { exact: true }).selectOption(`group:${group.id}`);
  await page.getByRole("button", { name: m.analysis.apply, exact: true }).click();
  await expect(page.getByText("960", { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("from")).toBe(addDays(today, -27));
  expect(new URL(page.url()).searchParams.get("to")).toBe(today);
  await expect(page.getByRole("status").filter({ hasText: m.analysis.phaseAttributedScope })).toBeVisible();
  await page.screenshot({ path: `/tmp/tartan-phase-analysis-${info.project.name}.png`, fullPage: true });
  await page.getByLabel(m.analysis.chooseMetric, { exact: true }).selectOption("distanceM");
  await expect(page.getByText(m.analysis.missing, { exact: true }).first()).toBeVisible();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalScroll(page);
  }
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
  // Même si les anciennes valeurs existent encore, un accord retiré ne les expose plus.
  const revoke = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await revoke.connect();
  try {
    await revoke.query("UPDATE athlete_consents SET revoked_at = now() WHERE athlete_id=$1 AND kind='health'", [
      athleteId,
    ]);
  } finally {
    await revoke.end();
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: m.analysis.health, exact: true })).toHaveCount(0);
  const hidden = await api.trainingAnalysis(orgId, { from: addDays(today, -27), to: today });
  expect(hidden.healthVisible).toBe(false);
  expect(hidden.weeks.every((week) => week.totals.perceivedLoad === null && week.totals.loadResponses === 0)).toBe(
    true,
  );
});
