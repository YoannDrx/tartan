import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { groupLink, joinAsAthlete, today } from "./journeys";

type Shared = { name: string; type: string; size: number; title?: string };

// Le coach note deux marques ; l'athlète partage la carte de son record depuis le menu de partage du téléphone.
test("l'athlète partage la carte de son record, et seule la marque battue en a une", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  await createCoachSpace(page, `Carte${info.project.name === "desktop" ? "Bureau" : "Mobile"}`);
  const link = await groupLink(page);
  const athlete = await joinAsAthlete(browser, link, "Inès");
  try {
    const me = await (await page.request.get("/api/v1/me")).json();
    const orgId = me.spaces[0].organizationId as string;
    await page.goto("/athletes", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /Inès/ }).first().click();
    await expect(page).toHaveURL(/\/athletes\/[0-9a-f-]{36}$/);
    const athleteId = new URL(page.url()).pathname.split("/").at(-1)!;
    const endpoint = `/api/v1/orgs/${orgId}/athletes/${athleteId}/performances`;
    for (const mark of [1.7, 1.78]) {
      const added = await page.request.post(endpoint, {
        data: { discipline: "Saut en hauteur", mark, unit: "m", date: today(), clientId: randomUUID() },
      });
      expect(added.ok()).toBe(true);
    }

    // Le menu de partage du téléphone, remplacé par un témoin : le parcours voit le fichier qu'il reçoit.
    await athlete.page.addInitScript(() => {
      const nav = navigator as Navigator & { __shared?: unknown };
      nav.canShare = () => true;
      nav.share = async (data?: ShareData) => {
        const file = data?.files?.[0];
        nav.__shared = { name: file?.name, type: file?.type, size: file?.size, title: data?.title };
      };
    });
    await athlete.page.goto("/progres", { waitUntil: "networkidle" });
    const share = athlete.page.getByRole("button", { name: m.recordCard.shareLabel("Saut en hauteur"), exact: true });
    // La référence initiale n'a pas de carte : un seul bouton, celui du record battu.
    await expect(share).toHaveCount(1);
    await expectNoHorizontalScroll(athlete.page);
    await expectAccessible(athlete.page);
    await share.click();
    await expect
      .poll(() => athlete.page.evaluate(() => (navigator as Navigator & { __shared?: Shared }).__shared))
      .toMatchObject({
        name: m.recordCard.filename("Saut en hauteur"),
        type: "image/png",
        title: m.recordCard.shareTitle("Saut en hauteur"),
      });
    const shared = await athlete.page.evaluate(() => (navigator as Navigator & { __shared?: Shared }).__shared);
    expect(shared!.size).toBeGreaterThan(20_000);
  } finally {
    await athlete.context.close();
  }
});
