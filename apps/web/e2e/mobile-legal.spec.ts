import { expect, test } from "@playwright/test";

// Modèle d'app compagnon : aucun prix ni lien de vente ne doit être atteignable depuis l'app.
for (const path of ["/mobile/conditions", "/mobile/confidentialite", "/mobile/contact"]) {
  test(`${path} ne mène ni aux tarifs, ni à la vente, ni à la connexion`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const hrefs = await page.locator("a").evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
    for (const forbidden of ["/tarifs", "/cgv", "/connexion", "/abonnement"]) {
      expect(hrefs.filter((href) => href.includes(forbidden))).toEqual([]);
    }
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/€|Tarifs/);
  });
}
