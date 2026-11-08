import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible } from "./helpers";

// La bannière iOS sert de témoin : son affichage ne dépend ni des permissions ni d'un événement du navigateur.
test.use({
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari",
});

test("la bannière attend une première action, reste sur téléphone et ne s'affiche que sur les synthèses", async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await createCoachSpace(page, "Banniere");
  const banner = page.getByRole("complementary", { name: m.install.iosTitle });
  const settled = () => page.waitForLoadState("networkidle");
  const ready = () => page.evaluate(() => localStorage.setItem("tartan.install-ready", "true"));

  await page.goto("/calendrier");
  await settled();
  await expect(banner).toHaveCount(0);
  await ready();
  await page.reload();
  await settled();

  if (info.project.name === "desktop") {
    await expect(banner).toHaveCount(0);
    return;
  }
  await expect(banner).toBeVisible();
  await expectAccessible(page);
  await page.goto("/seances/nouvelle");
  await settled();
  await expect(banner).toHaveCount(0);
  await page.goto("/calendrier");
  await banner.getByRole("button", { name: m.install.later }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await settled();
  await expect(banner).toHaveCount(0);
});
