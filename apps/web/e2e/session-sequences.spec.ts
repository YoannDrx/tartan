import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll, expectNoMotion } from "./helpers";

test("un circuit imbriqué garde son ordre, ses récupérations et ses identités après sauvegarde", async ({ page }) => {
  await createCoachSpace(page, "Circuits");
  await page.goto("/seances/nouvelle", { waitUntil: "networkidle" });
  await page.getByLabel(m.builder.titleLabel, { exact: true }).fill("Force en circuit");
  await page.getByRole("button", { name: "Ajouter Accélérations à la séance", exact: true }).click();
  await page.getByRole("button", { name: "Ajouter Foulées bondissantes à la séance", exact: true }).click();
  const phase = page.getByRole("region", { name: m.builder.blocks.main, exact: true });
  await phase.getByRole("button", { name: m.builder.sequence.groupAll, exact: true }).click();
  await phase.getByLabel(m.builder.sequence.select("Accélérations"), { exact: true }).check();
  await phase.getByLabel(m.builder.sequence.select("Foulées bondissantes"), { exact: true }).check();
  await phase.getByRole("button", { name: m.builder.sequence.groupSelection(2), exact: true }).click();
  await phase.getByLabel(m.builder.sequence.groupName, { exact: true }).fill("Superset");
  await phase.getByLabel(m.builder.sequence.betweenRounds, { exact: true }).fill("60");
  // Envelopper le superset : deux niveaux, sans changer les identités des exercices.
  await phase.getByRole("button", { name: m.builder.sequence.groupAll, exact: true }).last().click();
  await phase.getByLabel(m.builder.sequence.select("Superset"), { exact: true }).check();
  await phase.getByRole("button", { name: m.builder.sequence.groupSelection(1), exact: true }).click();
  await phase.getByLabel(m.builder.sequence.groupName, { exact: true }).first().fill("Deux passages");
  await phase.getByLabel(m.builder.sequence.rounds, { exact: true }).first().fill("2");
  await expect(phase.getByLabel(m.builder.sequence.rounds, { exact: true })).toHaveCount(2);
  await phase.getByRole("button", { name: m.builder.sequence.moreActions("Foulées bondissantes"), exact: true }).click();
  await page.getByRole("menuitem", { name: m.builder.sequence.remove("Foulées bondissantes"), exact: true }).click();
  await expect(phase.getByText("Foulées bondissantes", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: m.builder.sequence.undo, exact: true }).click();
  await expect(phase.getByText("Foulées bondissantes", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: m.builder.preview, exact: true }).click();
  const preview = page.getByRole("dialog");
  await expect(preview.getByText("Accélérations", { exact: true })).toHaveCount(6);
  await expect(preview.getByText("Foulées bondissantes", { exact: true })).toHaveCount(6);
  await expect(preview.getByText(m.builder.sequenceRecovery, { exact: true })).toHaveCount(4);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: m.builder.saveDraft, exact: true }).click();
  await expect(page).toHaveURL(/\/seances\/[a-f0-9-]+$/);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByLabel(m.builder.sequence.groupName, { exact: true }).first()).toHaveValue("Deux passages");
  await expect(page.getByLabel(m.builder.sequence.groupName, { exact: true }).last()).toHaveValue("Superset");
  const savedUrl = page.url();
  await page.getByLabel(m.builder.titleLabel, { exact: true }).fill("Circuit repris localement");
  await expect(page.getByText(m.nativeBuilder.localSaved, { exact: true })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("region", { name: m.nativeBuilder.recoveredTitle, exact: true })).toBeVisible();
  await expect(page.getByLabel(m.builder.titleLabel, { exact: true })).toHaveValue("Force en circuit");
  await page.getByRole("button", { name: m.nativeBuilder.restore, exact: true }).click();
  await expect(page.getByLabel(m.builder.titleLabel, { exact: true })).toHaveValue("Circuit repris localement");
  await page.getByRole("button", { name: m.builder.saveDraft, exact: true }).click();
  await expect(page.getByText(m.builder.sequence.draftSaved, { exact: true })).toBeVisible();
  await expect(page).toHaveURL(savedUrl);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("region", { name: m.nativeBuilder.recoveredTitle, exact: true })).toHaveCount(0);
  await expect(page.getByLabel(m.builder.titleLabel, { exact: true })).toHaveValue("Circuit repris localement");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    for (const theme of ["tartan", "light", "dark"]) {
      await page.evaluate((value) => document.querySelector("[data-theme]")?.setAttribute("data-theme", value), theme);
      await expectNoHorizontalScroll(page);
      await expectAccessible(page);
      await page.screenshot({ path: `/tmp/tartan-builder-${theme}-${width}.png`, fullPage: true });
    }
    await page.screenshot({ path: `/tmp/tartan-builder-${width}.png`, fullPage: true });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expectNoMotion(page);
});

test("l'athlète suit A/B/A/B et lance la récupération sans créer de série fictive", async ({ page, browser }) => {
  const { groupLink, joinAsAthlete, today } = await import("./journeys");
  await createCoachSpace(page, "Ordre");
  const me = await (await page.request.get("/api/v1/me")).json();
  const root = `/api/v1/orgs/${me.spaces[0].organizationId}`;
  const { page: athlete, context } = await joinAsAthlete(browser, await groupLink(page), "Lina");
  try {
    const builder = await (await page.request.get(`${root}/session-builder`)).json();
    const exercises = builder.exercises.slice(0, 2);
    const response = await page.request.post(`${root}/sessions`, {
      data: {
        date: today(),
        startTime: null,
        location: null,
        publishAt: null,
        assignments: [{ targetType: "group", targetId: builder.groups[0].id }],
        overrides: [],
        draft: {
          structureVersion: 2,
          title: "Ordre du circuit",
          type: "strength",
          durationMin: 20,
          coachNote: null,
          blocks: [
            {
              ref: "phase",
              name: "Force",
              variant: "club",
              items: exercises.map((e: { id: string }, i: number) => ({
                ref: `item-${i}`,
                exerciseId: e.id,
                prescription: { sets: 1, reps: 5, rest_s: 30 },
              })),
              sequence: [
                {
                  kind: "repeat",
                  ref: "circuit",
                  name: "Superset",
                  rounds: 2,
                  restBetweenRoundsS: 60,
                  children: [
                    { kind: "exercise", itemRef: "item-0" },
                    { kind: "exercise", itemRef: "item-1" },
                  ],
                },
              ],
            },
          ],
        },
      },
    });
    expect(response.ok()).toBe(true);
    const saved = await response.json();
    expect(
      (
        await page.request.post(`${root}/sessions/${saved.id}/publish`, { data: { expectedVersion: saved.version } })
      ).ok(),
    ).toBe(true);
    await athlete.goto(`/seance/${saved.id}/mode`, { waitUntil: "networkidle" });
    await expect(athlete.getByRole("heading", { level: 1 })).toHaveText(exercises[0].name);
    // Dernière série d'un tour sans repos : l'étape suivante arrive d'elle-même.
    await athlete.getByRole("button", { name: m.sessionMode.setTodo(1), exact: true }).click();
    await expect(athlete.getByRole("heading", { level: 1 })).toHaveText(exercises[1].name);
    await athlete.getByRole("button", { name: m.builder.sequence.next, exact: true }).click();
    await expect(athlete.getByRole("heading", { level: 1 })).toHaveText(m.builder.sequenceRecovery);
    await expect(athlete.getByRole("button", { name: m.sessionMode.setTodo(1), exact: true })).toHaveCount(0);
    // Une récupération de circuit démarre seule à l'arrivée sur l'étape.
    await expect(athlete.getByRole("button", { name: m.sessionMode.stopRest, exact: true })).toBeVisible();
    await expectAccessible(athlete);
    await athlete.getByRole("button", { name: m.builder.sequence.next, exact: true }).click();
    await expect(athlete.getByRole("heading", { level: 1 })).toHaveText(exercises[0].name);
    await expect(athlete.getByRole("button", { name: m.sessionMode.setTodo(1), exact: true })).toBeVisible();
    await athlete.getByRole("button", { name: m.builder.sequence.next, exact: true }).click();
    await expect(athlete.getByRole("heading", { level: 1 })).toHaveText(exercises[1].name);
    await expect(athlete.getByRole("button", { name: m.builder.sequence.next, exact: true })).toHaveCount(0);
    await expectNoHorizontalScroll(athlete);
  } finally {
    await context.close();
  }
});

test("deux onglets ne remplacent pas silencieusement la copie locale du constructeur", async ({ page, context }) => {
  await createCoachSpace(page, "Copie");
  await page.goto("/seances/nouvelle", { waitUntil: "networkidle" });
  await page.getByLabel(m.builder.titleLabel, { exact: true }).fill("Séance commune");
  await page.getByRole("button", { name: "Ajouter Accélérations à la séance", exact: true }).click();
  await page.getByRole("button", { name: m.builder.saveDraft, exact: true }).click();
  await expect(page).toHaveURL(/\/seances\/[a-f0-9-]+$/);
  await page.reload({ waitUntil: "networkidle" });
  const other = await context.newPage();
  try {
    await other.goto(page.url(), { waitUntil: "networkidle" });
    await page.getByLabel(m.builder.titleLabel, { exact: true }).fill("Première copie à conserver");
    await expect(page.getByText(m.nativeBuilder.localSaved, { exact: true })).toBeVisible();
    await other.getByLabel(m.builder.titleLabel, { exact: true }).fill("Deuxième copie concurrente");
    await expect(other.getByText(m.nativeBuilder.localError, { exact: true })).toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    const recovery = page.getByRole("region", { name: m.nativeBuilder.recoveredTitle, exact: true });
    await expect(recovery).toContainText("Première copie à conserver");
    await expect(recovery).not.toContainText("Deuxième copie concurrente");
  } finally {
    await other.close();
  }
});

test("une réponse perdue laisse la création en attente de vérification et bloque son rejeu", async ({ page }) => {
  await createCoachSpace(page, "Interruption");
  await page.goto("/seances/nouvelle", { waitUntil: "networkidle" });
  await page.getByLabel(m.builder.titleLabel, { exact: true }).fill("Séance envoyée une fois");
  await page.getByRole("button", { name: "Ajouter Accélérations à la séance", exact: true }).click();
  let sent = 0;
  let confirmLoss!: () => void;
  const lostResponse = new Promise<void>((resolve) => {
    confirmLoss = resolve;
  });
  await page.route("**/seances/nouvelle", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    sent += 1;
    // Le serveur termine réellement l'écriture, mais le navigateur n'en reçoit pas la réponse.
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    await route.abort("failed");
    confirmLoss();
  });
  await page.getByRole("button", { name: m.builder.saveDraft, exact: true }).click();
  await lostResponse;
  await expect(page.getByRole("alert").filter({ hasText: m.nativeBuilder.pendingReply })).toBeVisible();
  await expect(page.getByRole("button", { name: m.builder.saveDraft, exact: true })).toBeDisabled();
  await page.unroute("**/seances/nouvelle");
  await page.reload({ waitUntil: "networkidle" });
  const recovery = page.getByRole("region", { name: m.nativeBuilder.recoveredTitle, exact: true });
  await expect(recovery).toContainText(m.nativeBuilder.pendingReply);
  await expect(recovery.getByRole("button", { name: m.nativeBuilder.restore, exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: m.builder.saveDraft, exact: true })).toBeDisabled();
  expect(sent).toBe(1);
  await page.goto("/calendrier", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: /Séance envoyée une fois/ })).toHaveCount(1);
});
