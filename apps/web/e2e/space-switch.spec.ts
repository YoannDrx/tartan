import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectNoHorizontalScroll } from "./helpers";
import { groupLink } from "./journeys";

// T13 : un même compte, coach dans son espace et athlète dans celui d'un autre coach. Le choix de l'espace vit dans
// le cookie `tartan_space` ; chaque espace garde ses rôles et ses données, et un cookie forgé n'ouvre rien.

const SPACE_COOKIE = "tartan_space";

test("changer d'espace : rôle et données de chaque espace, aucune fuite, cookie forgé sans effet", async ({
  page,
  browser,
}) => {
  // L'autre coach : son espace, son groupe, son lien.
  const otherContext = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
  const other = await otherContext.newPage();
  await createCoachSpace(other, "Voisin");
  const link = await groupLink(other);

  // Le compte double : coach chez lui, puis athlète chez le voisin par le lien du groupe.
  await createCoachSpace(page, "Double");
  await page.goto(new URL(link).pathname);
  await page.getByRole("checkbox", { name: /conditions d'utilisation/ }).check();
  await page.getByRole("button", { name: m.invite.accept }).click();
  const confirmAge = page.getByRole("button", { name: m.age.saveConfirmed, exact: true });
  if (await confirmAge.isVisible({ timeout: 3_000 }).catch(() => false)) await confirmAge.click();
  await page.waitForURL(/\/(aujourdhui|accueil|suivi)/);

  const me = (await (await page.request.get("/api/v1/me")).json()) as {
    spaces: { organizationId: string; organizationName: string; role: string }[];
  };
  expect(me.spaces).toHaveLength(2);
  const own = me.spaces.find((space) => space.role === "owner")!;
  const joined = me.spaces.find((space) => space.role === "athlete")!;
  expect(joined.organizationName).toBe("Coaching Voisin");
  const cookie = async () => (await page.context().cookies()).find((c) => c.name === SPACE_COOKIE)?.value;
  const brand = page.getByRole("link", { name: m.brand.coach });

  // Vers son propre espace : le suivi du coach, rien de l'espace du voisin.
  await page.goto("/accueil");
  await expect(brand).toBeVisible();
  await expect(page.getByRole("heading", { name: "Suivi du groupe" })).toBeVisible();
  expect(await cookie()).toBe(own.organizationId);

  // Audit G6 : à 390 px, le sélecteur garde le nom de l'espace lisible et une cible de 44 px, pas un chevron seul.
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  const name = page.getByTestId("space-name");
  await expect(name).toBeVisible();
  await expect(name).toHaveText(own.organizationName);
  const nameBox = (await name.boundingBox())!;
  expect(nameBox.width).toBeGreaterThanOrEqual(56);
  const target = (await brand.boundingBox())!;
  expect(target.height).toBeGreaterThanOrEqual(44);
  expect(target.width).toBeGreaterThanOrEqual(96);
  expect(target.x + target.width).toBeLessThanOrEqual(390);
  await expectNoHorizontalScroll(page);
  if (viewport) await page.setViewportSize(viewport);
  await expect(page.getByText("Coaching Voisin", { exact: true })).toHaveCount(0);

  // Vers l'espace où il est athlète : l'accueil de l'athlète, et le suivi lui est fermé.
  await page.goto("/reglages");
  const clubRow = page.getByRole("listitem").filter({ hasText: joined.organizationName });
  await clubRow.getByRole("button", { name: m.brand.makeUsual }).click();
  await expect(clubRow.getByText(m.brand.usual)).toBeVisible();
  await clubRow.getByRole("link", { name: m.brand.openClub }).click();
  await expect(page.getByRole("heading", { name: /^Salut/ })).toBeVisible();
  expect(await cookie()).toBe(joined.organizationId);
  await page.goto("/suivi");
  await expect(page).toHaveURL(/\/aujourdhui/);

  // Un cookie forgé vers un espace dont il n'est pas membre : on retombe sur l'un des siens, sans rien de l'autre.
  const third = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
  const thirdPage = await third.newPage();
  await createCoachSpace(thirdPage, "Tiers");
  const stranger = (await (await thirdPage.request.get("/api/v1/me")).json()) as {
    spaces: { organizationId: string }[];
  };
  const forged = stranger.spaces[0]!.organizationId;
  const url = new URL(page.url());
  await page.context().addCookies([{ name: SPACE_COOKIE, value: forged, domain: url.hostname, path: "/" }]);
  const response = await page.goto("/accueil");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/(aujourdhui|suivi)/);
  await expect(page.getByRole("link", { name: m.brand.athlete })).toBeVisible();
  await expect(page.getByText("Coaching Tiers", { exact: true })).toHaveCount(0);
  expect((await page.request.get(`/api/v1/orgs/${forged}/athletes`)).status()).toBe(403);
  await Promise.all([otherContext.close(), third.close()]);
});
