import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { groupLink, joinAsAthlete, publishSession } from "./journeys";

test("deux appareils : comparaison, remplacement explicite et abandon sans écraser la séance", async ({
  page,
  browser,
}, info) => {
  await createCoachSpace(page, "Comparaison");
  const { page: athlete, context } = await joinAsAthlete(browser, await groupLink(page), "Maya");
  const other = await browser.newContext({ storageState: await context.storageState() });
  try {
    await athlete.setViewportSize({ width: info.project.name === "desktop" ? 1440 : 390, height: 900 });
    await publishSession(page, "Séance à comparer", "Accélérations");
    const sessionId = /\/seances\/([^/]+)/.exec(page.url())![1]!;
    const me = await (await athlete.request.get("/api/v1/me")).json();
    const orgId = me.spaces[0].organizationId;
    const endpoint = `${new URL(athlete.url()).origin}/api/v1/orgs/${orgId}/sessions/${sessionId}`;
    const read = async () => await (await other.request.get(`${endpoint}/me`)).json();
    const conflict = async (localComment: string, serverComment: string) => {
      const before = await read();
      await athlete.goto(`/seance/${sessionId}/mode`, { waitUntil: "networkidle" });
      await context.setOffline(true);
      await athlete.getByRole("button", { name: m.today.quickDone, exact: true }).click();
      const details = athlete.getByRole("dialog");
      await details.getByLabel(m.validation.comment, { exact: true }).fill(localComment);
      await details.getByRole("button", { name: m.validation.addDetails, exact: true }).click();
      const concurrent = await other.request.post(`${endpoint}/log`, {
        data: {
          clientId: randomUUID(),
          expectedVersion: before.log?.version ?? 0,
          expectedSessionVersion: before.sessionVersion,
          status: "partial",
          variantDone: "club",
          rpe: 7,
          durationMin: 55,
          comment: serverComment,
        },
      });
      expect(concurrent.ok()).toBe(true);
      await context.setOffline(false);
      await expect(athlete.getByText(m.offline.reviewPending(2), { exact: true })).toBeVisible();
      await athlete.getByRole("link", { name: m.syncReview.open, exact: true }).click();
      await athlete.getByRole("button", { name: m.syncReview.compare, exact: true }).click();
      const server = athlete.getByRole("region", { name: m.syncReview.server, exact: true });
      const local = athlete.getByRole("region", { name: m.syncReview.local, exact: true });
      await expect(server.getByText(serverComment, { exact: true })).toBeVisible();
      await expect(local.getByText(localComment, { exact: true })).toBeVisible();
      await expectAccessible(athlete);
      await expectNoHorizontalScroll(athlete);
      return (await concurrent.json()).version as number;
    };
    const firstVersion = await conflict("Retour de l'appareil hors ligne", "Retour du second appareil");
    await expect(athlete.getByText(m.validation.queued, { exact: true })).toHaveCount(0);
    await athlete.screenshot({ path: `/tmp/tartan-sync-review-${info.project.name}.png`, fullPage: true });
    const duringReview = await read();
    expect(
      (
        await other.request.post(`${endpoint}/log`, {
          data: {
            clientId: randomUUID(),
            expectedVersion: firstVersion,
            expectedSessionVersion: duringReview.sessionVersion,
            status: "partial",
            variantDone: "club",
            rpe: 7,
            durationMin: 55,
            comment: "Correction pendant la comparaison",
          },
        })
      ).ok(),
    ).toBe(true);
    await athlete.getByRole("button", { name: m.syncReview.apply, exact: true }).click();
    await athlete.getByRole("dialog").getByRole("button", { name: m.syncReview.apply, exact: true }).click();
    await expect(athlete.getByText(m.offline.needsReview, { exact: true })).toBeVisible();
    expect((await read()).log).toMatchObject({
      version: firstVersion + 1,
      comment: "Correction pendant la comparaison",
    });
    await athlete.getByRole("button", { name: m.syncReview.compare, exact: true }).click();
    await expect(
      athlete
        .getByRole("region", { name: m.syncReview.server })
        .getByText("Correction pendant la comparaison", { exact: true }),
    ).toBeVisible();
    await athlete.getByRole("button", { name: m.syncReview.apply, exact: true }).click();
    await athlete.getByRole("dialog").getByRole("button", { name: m.syncReview.apply, exact: true }).click();
    await expect.poll(async () => (await read()).log.version).toBe(firstVersion + 2);
    expect((await read()).log).toMatchObject({
      comment: "Retour de l'appareil hors ligne",
      rpe: 7,
      durationMin: 55,
      status: "done",
    });
    await expect(athlete.getByText(m.syncReview.empty, { exact: true })).toBeVisible();

    const secondVersion = await conflict("Retour à abandonner", "Correction à conserver");
    await athlete.getByRole("button", { name: m.syncReview.discard, exact: true }).click();
    await athlete.getByRole("dialog").getByRole("button", { name: m.common.cancel, exact: true }).click();
    await expect(athlete.getByText(m.syncReview.batch(2), { exact: true })).toBeVisible();
    await athlete.getByRole("button", { name: m.syncReview.discard, exact: true }).click();
    await athlete.getByRole("dialog").getByRole("button", { name: m.syncReview.discard, exact: true }).click();
    await expect(athlete.getByText(m.syncReview.discarded, { exact: true })).toBeVisible();
    expect((await read()).log).toMatchObject({
      version: secondVersion,
      comment: "Correction à conserver",
      status: "partial",
    });
    await athlete.reload({ waitUntil: "networkidle" });
    await expect(athlete.getByText(m.syncReview.empty, { exact: true })).toBeVisible();
  } finally {
    await other.close();
    await context.close();
  }
});
