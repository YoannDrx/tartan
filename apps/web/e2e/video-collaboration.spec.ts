import { createHmac } from "node:crypto";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { groupLink, joinAsAthlete } from "./journeys";

test("vidéo privée : envoi athlète, remarque coach, réponse et partage révocable", async ({ page, browser }, info) => {
  test.skip(process.env.E2E_VIDEO_ENABLED !== "true");
  test.setTimeout(240_000);
  const inspectLayout = async (target: Page, screen: string) => {
    const viewport = target.viewportSize();
    const previousTheme = await target.locator("[data-theme]").first().getAttribute("data-theme");
    await target.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [390, 768, 1440]) {
      await target.setViewportSize({ width, height: 900 });
      for (const theme of ["tartan", "light", "dark"]) {
        await target.evaluate(
          (value) => document.querySelector("[data-theme]")?.setAttribute("data-theme", value),
          theme,
        );
        await expectNoHorizontalScroll(target);
        if (screen === "list") {
          await expect(target.getByText("Lina Test", { exact: true })).toBeVisible();
          const clipped = await target
            .locator('main a[href^="/mes-sauts/"]')
            .evaluateAll((links) => links.some((link) => link.scrollWidth > link.clientWidth + 1));
          expect(clipped).toBe(false);
        }
        await expectAccessible(target);
        if (info.project.name === "desktop")
          await target.screenshot({ path: `/tmp/tartan-video-${screen}-${theme}-${width}.png`, fullPage: true });
      }
    }
    if (viewport) await target.setViewportSize(viewport);
    if (previousTheme)
      await target.evaluate(
        (value) => document.querySelector("[data-theme]")?.setAttribute("data-theme", value),
        previousTheme,
      );
  };
  await createCoachSpace(page, "Vidéo collaborative");
  const link = await groupLink(page);
  const athlete = await joinAsAthlete(browser, link, "Lina");
  const peer = await joinAsAthlete(browser, link, "Alex");
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    const me = await (await athlete.page.request.get("/api/v1/me")).json();
    const organizationId = me.spaces[0].organizationId;
    let directPuts = 0;
    await athlete.page.route("https://upload.mux.com/tartan-e2e/**", async (route) => {
      if (route.request().method() === "PUT") directPuts += 1;
      await route.fulfill({
        status: route.request().method() === "OPTIONS" ? 204 : 201,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "PUT, OPTIONS",
          "access-control-allow-headers": "content-type, content-range",
        },
      });
    });
    await athlete.page.goto("/mes-sauts");
    await athlete.page.getByRole("button", { name: m.video.import, exact: true }).press("Enter");
    await expect(athlete.page.getByText(m.videoCollaboration.private, { exact: true })).toBeVisible();
    await expect(athlete.page.getByLabel(m.videoCollaboration.athlete, { exact: true })).toHaveCount(0);
    await inspectLayout(athlete.page, "upload");
    await athlete.page
      .getByLabel(m.videoCollaboration.file, { exact: true })
      .setInputFiles(path.resolve(import.meta.dirname, "fixtures/saut-240-etire.webm"));
    await athlete.page.getByRole("button", { name: m.common.send, exact: true }).click();
    await expect.poll(() => directPuts).toBeGreaterThan(0);
    const row = (
      await sql.query(
        "select id, mux_upload_id, upload_generation, shared_with_athlete, shared_with_group from videos where organization_id=$1 and uploaded_by=$2",
        [organizationId, me.id],
      )
    ).rows[0];
    expect(row).toMatchObject({ shared_with_athlete: true, shared_with_group: false });
    const videoId = row.id;
    expect((await peer.page.request.get(`/api/v1/orgs/${organizationId}/videos/${videoId}`)).status()).toBe(404);
    const event = JSON.stringify({
      type: "video.asset.ready",
      data: {
        id: `asset-${videoId}`,
        upload_id: row.mux_upload_id,
        passthrough: `video:${videoId}:${row.upload_generation}`,
        duration: 4,
      },
    });
    const t = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", "mux-webhook-local-test").update(`${t}.${event}`).digest("hex");
    const webhook = () =>
      page.request.post("/api/webhooks/mux", {
        data: event,
        headers: { "mux-signature": `t=${t},v1=${signature}`, "content-type": "application/json" },
      });
    expect((await webhook()).ok()).toBe(true);
    expect((await webhook()).ok()).toBe(true);
    expect(
      (
        await sql.query(
          "select count(*)::int as n from notifications where type='video_shared' and payload->>'videoId'=$1",
          [videoId],
        )
      ).rows[0].n,
    ).toBe(1);

    await page.goto("/videos?review=pending");
    await expect(page.locator(`a[href='/videos/${videoId}']`)).toBeVisible();
    await page.locator(`a[href='/videos/${videoId}']`).click();
    await page.getByPlaceholder(/Remarque à/).fill("Place les appuis sous le bassin");
    await page.getByRole("button", { name: m.video.addComment, exact: true }).click();
    await expect(page.getByText("Place les appuis sous le bassin", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: m.videoCollaboration.review, exact: true }).click();
    await expect(page.getByText(m.videoCollaboration.reviewed, { exact: true })).toBeVisible();

    await athlete.page.goto(`/mes-sauts/${videoId}`);
    await athlete.page.getByRole("button", { name: m.videoCollaboration.reply, exact: true }).click();
    await athlete.page.getByPlaceholder(/Remarque à/).fill("Je corrige à la prochaine série");
    await athlete.page.getByRole("button", { name: m.video.addComment, exact: true }).click();
    await expect(athlete.page.getByText("Je corrige à la prochaine série", { exact: true })).toBeVisible();
    expect((await sql.query("select reviewed_at from videos where id=$1", [videoId])).rows[0].reviewed_at).toBeNull();

    await athlete.page.getByText(m.videoCollaboration.shareGroups, { exact: true }).click();
    await athlete.page.getByLabel("Hauteur Élite", { exact: true }).check();
    await athlete.page.getByRole("button", { name: m.videoCollaboration.saveShare, exact: true }).click();
    await athlete.page
      .getByRole("dialog")
      .getByRole("button", { name: m.videoCollaboration.saveShare, exact: true })
      .click();
    await expect
      .poll(async () => (await peer.page.request.get(`/api/v1/orgs/${organizationId}/videos/${videoId}`)).status())
      .toBe(200);
    await peer.page.goto(`/mes-sauts/${videoId}`);
    await expect(peer.page.getByText("Place les appuis sous le bassin", { exact: true })).toBeVisible();
    await expect(peer.page.getByText(m.videoCollaboration.shareGroups, { exact: true })).toHaveCount(0);

    await inspectLayout(athlete.page, "collaboration");
    await athlete.page.getByLabel("Hauteur Élite", { exact: true }).uncheck();
    await athlete.page.getByRole("button", { name: m.videoCollaboration.saveShare, exact: true }).click();
    await athlete.page
      .getByRole("dialog")
      .getByRole("button", { name: m.videoCollaboration.saveShare, exact: true })
      .click();
    await expect
      .poll(async () => (await peer.page.request.get(`/api/v1/orgs/${organizationId}/videos/${videoId}`)).status())
      .toBe(404);
    await athlete.page.goto("/mes-sauts");
    await inspectLayout(athlete.page, "list");
  } finally {
    await sql.end();
    await athlete.context.close();
    await peer.context.close();
  }
});
