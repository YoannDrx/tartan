import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { groupLink, joinAsAthlete, today } from "./journeys";

test("l'athlète confirme ses séries, retrouve son brouillon et conserve son retour de séance", async ({
  page,
  browser,
}, info) => {
  await createCoachSpace(page, "Realise");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId as string;
  const root = `/api/v1/orgs/${orgId}`;
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    await sql.query("UPDATE organizations SET progression_enabled = true WHERE id = $1", [orgId]);
  } finally {
    await sql.end();
  }
  const { page: athlete, context } = await joinAsAthlete(browser, await groupLink(page), "Maya");
  try {
    await athlete.setViewportSize({ width: info.project.name === "desktop" ? 1440 : 390, height: 900 });
    const builder = await (await page.request.get(`${root}/session-builder`)).json();
    const exercise = await page.request.post(`${root}/exercises`, {
      data: { name: "Squat réalisé", category: "strength", strengthLoadKind: "external_total" },
    });
    expect(exercise.ok()).toBe(true);
    const exerciseId = (await exercise.json()).id;
    const created = await page.request.post(`${root}/sessions`, {
      data: {
        date: today(),
        startTime: null,
        location: null,
        publishAt: null,
        assignments: [{ targetType: "group", targetId: builder.groups[0].id }],
        overrides: [],
        draft: {
          title: "Séries réelles",
          type: "strength",
          durationMin: 30,
          coachNote: null,
          blocks: [
            {
              name: "Force",
              variant: "club",
              items: [{ exerciseId, prescription: { sets: 3, reps: 4, load: { type: "kg", value: 40 } } }],
            },
          ],
        },
      },
    });
    expect(created.ok()).toBe(true);
    const session = await created.json();
    expect(
      (
        await page.request.post(`${root}/sessions/${session.id}/publish`, {
          data: { expectedVersion: session.version },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await athlete.request.post(`${root}/sessions/${session.id}/log`, {
          data: {
            clientId: randomUUID(),
            variantDone: "club",
            status: "partial",
            rpe: 7,
            pain: { bodyArea: "knee", side: "left", intensity: 2 },
            durationMin: 35,
            comment: "Retour à conserver",
            sets: [],
          },
        })
      ).ok(),
    ).toBe(true);
    const url = `/seance/${session.id}/series`;
    await athlete.goto(`/seance/${session.id}`, { waitUntil: "networkidle" });
    await athlete.getByRole("link", { name: m.progression.setsTitle, exact: true }).click();
    const first = athlete.getByRole("group", { name: m.progression.setNumber(1), exact: true });
    const second = athlete.getByRole("group", { name: m.progression.setNumber(2), exact: true });
    const third = athlete.getByRole("group", { name: m.progression.setNumber(3), exact: true });
    await expect(first.getByRole("checkbox")).not.toBeChecked();
    await first.getByLabel(m.progression.fields.loadKg, { exact: true }).fill("42,5");
    await first.getByRole("checkbox").check();
    await athlete.reload({ waitUntil: "networkidle" });
    await expect(first.getByLabel(m.progression.fields.loadKg, { exact: true })).toHaveValue("42,5");
    await expect(first.getByRole("checkbox")).toBeChecked();
    await first.getByLabel(m.progression.fields.loadKg, { exact: true }).fill("40");
    await second.getByRole("checkbox").check();
    await expect(third.getByRole("checkbox")).not.toBeChecked();
    await expectAccessible(athlete);
    await expectNoHorizontalScroll(athlete);
    await athlete.getByRole("button", { name: m.progression.saveSets, exact: true }).click();
    await expect(athlete.getByText(m.progression.savedSets, { exact: true })).toBeVisible();
    const detail = await (await athlete.request.get(`${root}/sessions/${session.id}/me`)).json();
    expect(detail.log).toMatchObject({ rpe: 7, durationMin: 35, comment: "Retour à conserver", version: 2 });
    expect(detail.log.detailedSets).toHaveLength(2);
    expect(
      detail.log.detailedSets.reduce(
        (sum: number, set: { reps: number; loadKg: number }) => sum + set.reps * set.loadKg,
        0,
      ),
    ).toBe(320);
    await athlete.goto(url, { waitUntil: "networkidle" });
    await first.getByLabel(m.progression.fields.loadKg, { exact: true }).fill("42,5");
    await context.setOffline(true);
    await athlete.getByRole("button", { name: m.progression.saveSets, exact: true }).click();
    await expect(athlete.getByText(m.progression.queuedSets, { exact: true })).toBeVisible();
    await context.setOffline(false);
    await expect
      .poll(async () => (await (await athlete.request.get(`${root}/sessions/${session.id}/me`)).json()).log.version)
      .toBe(3);
    await athlete.reload({ waitUntil: "networkidle" });
    await expect(first.getByLabel(m.progression.fields.loadKg, { exact: true })).toHaveValue("42.5");
    await expect(athlete.getByText(m.progression.draftStale)).toHaveCount(0);
    await athlete.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expectNoHorizontalScroll(athlete);
    await athlete.evaluate(() => {
      document.documentElement.style.zoom = "";
      window.scrollTo(0, 0);
    });
    await athlete.screenshot({ path: `/tmp/tartan-performed-sets-${info.project.name}.png`, fullPage: true });
    await first.getByLabel(m.progression.fields.loadKg, { exact: true }).fill("quarante");
    await athlete.getByRole("button", { name: m.progression.saveSets, exact: true }).click();
    await expect(athlete.getByText(m.progression.correctSets, { exact: true })).toBeVisible();
    await first.getByLabel(m.progression.fields.loadKg, { exact: true }).fill("42,5");
    await first.getByRole("checkbox").uncheck();
    await second.getByRole("checkbox").uncheck();
    await athlete.getByRole("button", { name: m.progression.saveSets, exact: true }).click();
    const dialog = athlete.getByRole("dialog");
    await expect(dialog.getByText(m.progression.clearSetsConfirm, { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: m.common.cancel, exact: true }).click();
    expect(
      (await (await athlete.request.get(`${root}/sessions/${session.id}/me`)).json()).log.detailedSets,
    ).toHaveLength(2);
    await athlete.getByRole("button", { name: m.progression.saveSets, exact: true }).click();
    await dialog.getByRole("button", { name: m.common.save, exact: true }).click();
    await expect(athlete.getByText(m.progression.savedSets, { exact: true })).toBeVisible();
    const cleared = await (await athlete.request.get(`${root}/sessions/${session.id}/me`)).json();
    expect(cleared.log.detailedSets).toEqual([]);
    expect(cleared.log.rpe).toBe(7);

    // Une validation rapide puis son complément hors ligne restent compatibles avec
    // les séries détaillées et ne suppriment que les champs explicitement corrigés.
    const restoredResponse = await athlete.request.post(`${root}/sessions/${session.id}/log`, {
      data: {
        clientId: randomUUID(),
        writeScope: "sets",
        status: "partial",
        variantDone: "club",
        expectedVersion: cleared.log.version,
        expectedSessionVersion: cleared.sessionVersion,
        detailedSets: detail.log.detailedSets,
      },
    });
    expect(restoredResponse.ok()).toBe(true);
    const restored = await restoredResponse.json();
    await athlete.goto(`/seance/${session.id}/mode`, { waitUntil: "networkidle" });
    await context.setOffline(true);
    await athlete.getByRole("button", { name: m.today.quickDone, exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(m.validation.comment, { exact: true })).toHaveValue("Retour à conserver");
    await dialog.getByLabel(m.validation.comment, { exact: true }).fill("Complément hors ligne");
    await dialog.getByLabel(m.validation.duration, { exact: true }).fill("40");
    await dialog.getByRole("button", { name: m.validation.pain, exact: true }).click();
    await dialog.getByRole("button", { name: m.validation.addDetails, exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await context.setOffline(false);
    await expect
      .poll(async () => (await (await athlete.request.get(`${root}/sessions/${session.id}/me`)).json()).log.version)
      .toBe(restored.version + 2);
    const validated = await (await athlete.request.get(`${root}/sessions/${session.id}/me`)).json();
    expect(validated.log).toMatchObject({
      status: "done",
      rpe: 7,
      pain: null,
      durationMin: 40,
      comment: "Complément hors ligne",
    });
    expect(validated.log.detailedSets).toEqual(detail.log.detailedSets);

    // Une résolution de conflit de charges reconnaît ensuite le brouillon envoyé.
    await athlete.goto(url, { waitUntil: "networkidle" });
    await first.getByLabel(m.progression.fields.loadKg, { exact: true }).fill("45");
    await context.setOffline(true);
    await athlete.getByRole("button", { name: m.progression.saveSets, exact: true }).click();
    await expect(athlete.getByText(m.progression.queuedSets, { exact: true })).toBeVisible();
    const other = await browser.newContext({ storageState: await context.storageState() });
    try {
      const endpoint = `${new URL(athlete.url()).origin}${root}/sessions/${session.id}`;
      const concurrent = await other.request.post(`${endpoint}/log`, {
        data: {
          clientId: randomUUID(),
          writeScope: "sets",
          status: "done",
          variantDone: "club",
          expectedVersion: validated.log.version,
          expectedSessionVersion: validated.sessionVersion,
          detailedSets: validated.log.detailedSets.map((set: object, index: number) =>
            index === 0 ? { ...set, loadKg: 50 } : set,
          ),
        },
      });
      expect(concurrent.ok()).toBe(true);
      const beforeReview = await concurrent.json();
      await context.setOffline(false);
      await expect(athlete.getByText(m.offline.reviewPending(1), { exact: true })).toBeVisible();
      await athlete.getByRole("link", { name: m.syncReview.open, exact: true }).click();
      await athlete.getByRole("button", { name: m.syncReview.compare, exact: true }).click();
      await expect(athlete.getByRole("region", { name: m.syncReview.server }).getByText(/50 kg/)).toBeVisible();
      await expect(athlete.getByRole("region", { name: m.syncReview.local }).getByText(/45 kg/)).toBeVisible();
      await athlete.getByRole("button", { name: m.syncReview.apply, exact: true }).click();
      await athlete.getByRole("dialog").getByRole("button", { name: m.syncReview.apply, exact: true }).click();
      await expect
        .poll(async () => (await (await other.request.get(`${endpoint}/me`)).json()).log.version)
        .toBe(beforeReview.version + 1);
      await athlete.goto(url, { waitUntil: "networkidle" });
      await expect(first.getByLabel(m.progression.fields.loadKg, { exact: true })).toHaveValue("45");
      await expect(athlete.getByText(m.progression.draftStale)).toHaveCount(0);
      await expect(athlete.getByRole("button", { name: m.progression.saveSets, exact: true })).toBeEnabled();

      // Un brouillon jamais envoyé se relit séparément, sans écrire sur le serveur.
      await first.getByLabel(m.progression.fields.loadKg, { exact: true }).fill("47");
      const savedBeforeDraft = await (await other.request.get(`${endpoint}/me`)).json();
      const correction = await other.request.post(`${endpoint}/log`, {
        data: {
          clientId: randomUUID(),
          writeScope: "status",
          status: "partial",
          variantDone: "club",
          expectedVersion: savedBeforeDraft.log.version,
          expectedSessionVersion: savedBeforeDraft.sessionVersion,
        },
      });
      expect(correction.ok()).toBe(true);
      const correctionResult = await correction.json();
      await athlete.reload({ waitUntil: "networkidle" });
      await expect(athlete.getByText(m.progression.draftStale)).toBeVisible();
      await athlete.getByRole("button", { name: m.progression.reviewDraft, exact: true }).click();
      await expect(
        athlete
          .getByRole("region", { name: m.progression.localDraft })
          .getByText(`${m.progression.fields.loadKg} : 47`, { exact: true }),
      ).toBeVisible();
      await expectAccessible(athlete);
      await expectNoHorizontalScroll(athlete);
      await athlete.getByRole("button", { name: m.progression.keepDraft, exact: true }).click();
      await dialog.getByRole("button", { name: m.common.cancel, exact: true }).click();
      await expect(athlete.getByText(m.progression.draftStale)).toBeVisible();
      await athlete.getByRole("button", { name: m.progression.keepDraft, exact: true }).click();
      await dialog.getByRole("button", { name: m.progression.keepDraft, exact: true }).click();
      await expect(athlete.getByText(m.progression.draftReady, { exact: true })).toBeVisible();
      expect((await (await other.request.get(`${endpoint}/me`)).json()).log.version).toBe(correctionResult.version);
      await expect(first.getByLabel(m.progression.fields.loadKg, { exact: true })).toHaveValue("47");
      await athlete.getByRole("button", { name: m.progression.saveSets, exact: true }).click();
      await expect(athlete.getByText(m.progression.savedSets, { exact: true })).toBeVisible();
      const kept = await (await other.request.get(`${endpoint}/me`)).json();
      expect(kept.log.detailedSets[0].loadKg).toBe(47);
      await athlete.reload({ waitUntil: "networkidle" });
      await first.getByLabel(m.progression.fields.loadKg, { exact: true }).fill("48");
      expect(
        (
          await other.request.post(`${endpoint}/log`, {
            data: {
              clientId: randomUUID(),
              writeScope: "sets",
              status: "done",
              variantDone: "club",
              expectedVersion: kept.log.version,
              expectedSessionVersion: kept.sessionVersion,
              detailedSets: kept.log.detailedSets.map((set: object, index: number) =>
                index === 0 ? { ...set, loadKg: 49 } : set,
              ),
            },
          })
        ).ok(),
      ).toBe(true);
      await athlete.reload({ waitUntil: "networkidle" });
      await athlete.getByRole("button", { name: m.progression.reviewDraft, exact: true }).click();
      await athlete.getByRole("button", { name: m.progression.resetDraft, exact: true }).click();
      await dialog.getByRole("button", { name: m.common.cancel, exact: true }).click();
      await expect(first.getByLabel(m.progression.fields.loadKg, { exact: true })).toHaveValue("48");
      await athlete.getByRole("button", { name: m.progression.resetDraft, exact: true }).click();
      await dialog.getByRole("button", { name: m.progression.resetDraft, exact: true }).click();
      await expect(first.getByLabel(m.progression.fields.loadKg, { exact: true })).toHaveValue("49");
      await athlete.reload({ waitUntil: "networkidle" });
      await expect(first.getByLabel(m.progression.fields.loadKg, { exact: true })).toHaveValue("49");
      await expect(athlete.getByText(m.progression.draftStale)).toHaveCount(0);
    } finally {
      await other.close();
    }
  } finally {
    await context.close();
  }
});
