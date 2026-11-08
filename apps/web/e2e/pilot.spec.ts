import { m } from "@tartan/i18n";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll, uniqueEmail } from "./helpers";
import { createExercise, groupLink, joinAsAthlete, publishSession, today } from "./journeys";

test.describe("le pilote", () => {
  // Parcours coach au bureau ; l'athlète y est déjà simulé sur téléphone.
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop"));

  test("remplace les SMS : du coach à la validation de l'athlète en moins de 10 s", async ({ page, browser }) => {
    await createCoachSpace(page, "Thomas");
    await createExercise(page, "Haies basses du pilote");
    const link = await groupLink(page);
    const { page: athlete, context } = await joinAsAthlete(browser, link, "Léa");

    await publishSession(page, "Technique et pliométrie", "Haies basses du pilote");

    // L'athlète voit la séance signée de son coach, et valide en un toucher.
    await athlete.reload();
    await expect(athlete.getByRole("heading", { name: "Technique et pliométrie" })).toBeVisible();
    await expect(athlete.getByText(/envoyée par Thomas/)).toBeVisible();
    const started = Date.now();
    await athlete.getByRole("button", { name: "J'ai fait la séance", exact: true }).click();
    await expect(athlete.getByRole("dialog", { name: "Séance validée, bien joué" })).toBeVisible();
    expect(Date.now() - started).toBeLessThan(10_000);
    // Tout le reste est facultatif : « Terminé » est l'action principale de la feuille.
    await expect(athlete.getByRole("dialog").getByRole("button", { name: "Terminé" })).toBeVisible();

    // Détails facultatifs : effort et douleur.
    await athlete.getByRole("button", { name: "Effort 9 sur 10" }).click();
    await athlete.getByRole("button", { name: "Signaler une douleur" }).click();
    await athlete.getByRole("dialog").getByRole("button", { name: "Ajouter ces précisions" }).click();
    await expect(athlete.getByRole("dialog")).toBeHidden();
    await expect(athlete.getByText(/séance validée, bien joué/i).first()).toBeVisible();

    // Le coach voit qui a fait quoi, et l'alerte.
    await page.goto("/suivi");
    await expect(page.getByRole("link", { name: "Léa Test, Fait" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Léa signale une douleur/ })).toBeVisible();
    await expectAccessible(page);

    // Détail et commentaire contextuel.
    await page.goto("/suivi");
    await page.getByRole("link", { name: "Léa Test, Fait" }).click();
    await expect(page.getByText(/Effort 9\/10/)).toBeVisible();
    await expect(page.getByText(/Douleur : Genou gauche/)).toBeVisible();
    await page.getByLabel("Écris ton commentaire…").fill("Repos demain, on regarde ça samedi.");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText("Repos demain, on regarde ça samedi.")).toBeVisible();
    await context.close();
  });

  test("un absent bascule en autonomie après l'appel", async ({ page, browser }) => {
    await createCoachSpace(page, "Sarah");
    await createExercise(page, "Fentes du pilote");
    const link = await groupLink(page);
    const { page: athlete, context } = await joinAsAthlete(browser, link, "Hugo");
    await publishSession(page, "Séance au club", "Fentes du pilote");
    await page.getByRole("button", { name: "Absent" }).click();
    await page.getByRole("button", { name: "Valider l'appel" }).click();
    await expect(page.getByText(/1 absent basculé en autonomie/)).toBeVisible();
    await athlete.reload();
    await expect(athlete.getByText("En autonomie", { exact: true }).first()).toBeVisible();
    await context.close();
  });

  test("le mode séance fonctionne au doigt, en sombre, jusqu'à la validation", async ({ page, browser }) => {
    await createCoachSpace(page, "Marc");
    await createExercise(page, "Montées de genoux");
    const link = await groupLink(page);
    const { page: athlete, context } = await joinAsAthlete(browser, link, "Inès");
    await publishSession(page, "Gammes", "Montées de genoux");
    await athlete.reload();
    await athlete.getByRole("link", { name: "Démarrer la séance" }).click();
    await expect(athlete.getByRole("heading", { name: "Montées de genoux" })).toBeVisible();
    await expect(athlete.locator("main.scene-dark")).toBeVisible();
    await expect(athlete.locator('iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"]')).toHaveAttribute(
      "src",
      /start=42.*end=90/,
    );
    await athlete.getByRole("button", { name: "Série 1 à faire" }).click();
    await expect(athlete.getByRole("button", { name: "Série 1 faite" })).toBeVisible();
    await expectNoHorizontalScroll(athlete);
    await athlete.getByRole("button", { name: "J'ai fait la séance", exact: true }).click();
    await expect(athlete.getByRole("dialog", { name: "Séance validée, bien joué" })).toBeVisible();
    await context.close();
  });

  test("une séance publiée reste privée : un autre coach ne la voit pas", async ({ page, browser }) => {
    await createCoachSpace(page, "Nadia");
    await createExercise(page, "Bonds");
    await publishSession(page, "Séance privée", "Bonds");
    const url = new URL(page.url()).pathname;
    const other = await browser.newContext({ locale: "fr-FR" });
    const otherPage = await other.newPage();
    await createCoachSpace(otherPage, "Omar");
    await otherPage.goto(url);
    await expect(otherPage.getByRole("heading", { name: "Cette page n'existe pas, ou plus." })).toBeVisible();
    await expect(otherPage.getByText("Séance privée")).toHaveCount(0);
    await other.close();
  });

  test("supprimer une annonce passe par un dialogue, jamais par le navigateur", async ({ page }) => {
    page.on("dialog", (native) => {
      throw new Error(`Dialogue natif : ${native.message()}`);
    });
    await createCoachSpace(page, "Annie");
    await page.goto("/annonces");
    // Le formulaire existe deux fois, un seul visible selon la largeur.
    await page.getByLabel("Message").filter({ visible: true }).fill("Séance déplacée à 10 h");
    await page.getByRole("button", { name: "Publier" }).filter({ visible: true }).click();
    const item = page.getByText("Séance déplacée à 10 h");
    await expect(item).toBeVisible();

    await page.getByRole("button", { name: "Supprimer" }).click();
    const dialog = page.getByRole("dialog", { name: "Supprimer cette annonce ?" });
    await expect(dialog).toBeVisible();
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Annuler" }).click();
    await expect(dialog).toBeHidden();
    await expect(item).toBeVisible();

    await page.getByRole("button", { name: "Supprimer" }).click();
    await dialog.getByRole("button", { name: "Supprimer" }).click();
    await expect(item).toBeHidden();
  });

  test("la bibliothèque commune se lit sans se modifier, et Instagram ne charge qu'à la demande", async ({ page }) => {
    await createCoachSpace(page, "Lecteur");
    const blocked: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Content Security Policy")) blocked.push(message.text());
    });
    await page.goto("/exercices");
    await page.getByRole("button", { name: "Bibliothèque Tartan", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Modifier / })).toHaveCount(0);

    await page.getByRole("button", { name: /^Routine cheville en 10 minutes/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Vidéo de svengirlando")).toBeVisible();
    await expect(dialog.locator("iframe")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Lire la vidéo" }).click();
    await expect(dialog.locator('iframe[src="https://www.instagram.com/reel/Dbq862ptfM6/embed/"]')).toBeVisible();
    expect(blocked).toEqual([]);
    await dialog.getByRole("button", { name: "Fermer" }).click();

    await page.getByRole("button", { name: /^Pliométrie en fente sur caisson/ }).click();
    await expect(dialog.getByText("n'autorise la lecture que sur Instagram")).toBeVisible();
    await expect(dialog.locator("iframe")).toHaveCount(0);
  });

  test("la molette regroupe les réglages et la déconnexion", async ({ page }) => {
    await createCoachSpace(page, "Molette");
    await page.goto("/suivi");
    await page.getByRole("button", { name: "Réglages" }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: "Tous les réglages" })).toBeVisible();
    await expectAccessible(page);
    await menu.getByRole("menuitem", { name: "Se déconnecter" }).click();
    await expect(page.getByRole("heading", { name: m.landing.title })).toBeVisible();
    await page.goto("/suivi");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("la suppression du compte se fait depuis les réglages", async ({ page }) => {
    await createCoachSpace(page, "Partant");
    await page.goto("/reglages");
    await page.getByRole("button", { name: "Supprimer mon compte" }).click();
    await page.getByLabel("Écris SUPPRIMER pour confirmer").fill("SUPPRIMER");
    await page.getByRole("dialog").getByRole("button", { name: "Supprimer mon compte" }).click();
    await expect(page.getByRole("heading", { name: m.landing.title })).toBeVisible();
    await page.goto("/suivi");
    await expect(page).toHaveURL(/\/connexion/);
  });
});

test.describe("toutes tailles d'écran", () => {
  test("la landing présente de vraies captures et le récit du groupe", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(m.landing.title);
    for (const alt of [m.landing.heroAltPhone, m.landing.heroAltDesktop, m.landing.views.alt, m.landing.video.alt]) {
      const image = page.getByRole("img", { name: alt, exact: true });
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
    for (const title of [m.landing.film.run.title, m.landing.film.plant.title, m.landing.film.flight.title]) {
      await expect(page.locator(".film-title").filter({ hasText: title })).toHaveCount(1);
    }
    await expect(page.locator("body")).not.toContainText("saut en hauteur");
    const initialViewport = page.viewportSize()!;
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(page);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expectNoHorizontalScroll(page);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "";
    });
    await page.setViewportSize(initialViewport);

    // Le visiteur qui veut créer son espace trouve une page qui le dit.
    await page.getByRole("link", { name: "Créer mon espace coach" }).first().click();
    await expect(page.getByRole("heading", { name: "Crée ton espace coach" })).toBeVisible();
  });

  test("le site public ne parle plus de mineurs", async ({ page }) => {
    for (const path of [
      "/",
      "/tarifs",
      "/confidentialite",
      "/conditions",
      "/cgv",
      "/mentions-legales",
      "/suppression-compte",
    ]) {
      await page.goto(path);
      const text = (await page.locator("body").innerText()).toLowerCase();
      expect(text, path).not.toContain("mineur");
      expect(text, path).not.toContain("15 ans");
    }
  });

  test("site, connexion et pages légales sont accessibles et sans défilement horizontal", async ({ page }) => {
    for (const path of [
      "/",
      "/connexion",
      "/confidentialite",
      "/conditions",
      "/tarifs",
      "/contact",
      "/cgv",
      "/mentions-legales",
      "/mot-de-passe-oublie",
      "/nouveau-mot-de-passe",
      "/nouveau-mot-de-passe?token=x",
      "/hors-ligne",
    ]) {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
      await expectAccessible(page);
    }
  });

  test("l'espace coach s'affiche à la bonne taille", async ({ page }) => {
    await createCoachSpace(page, "Lucie");
    for (const path of [
      "/suivi",
      "/calendrier",
      "/exercices",
      "/athletes",
      "/videos",
      "/annonces",
      "/reglages",
      "/abonnement",
      "/seances/nouvelle",
    ]) {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
      await expectAccessible(page);
    }
  });

  test("un lien d'invitation invalide renvoie une page introuvable", async ({ page }) => {
    const res = await page.goto("/i/00000000000000000000000000000000.faux");
    expect(res?.status()).toBe(404);
  });

  test("le site s'hydrate sans violation de la politique de sécurité", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /Content Security Policy/i.test(message.text()))
        violations.push(message.text());
    });
    for (const path of ["/", "/confidentialite", "/connexion"]) await page.goto(path, { waitUntil: "networkidle" });
    await page.goto("/connexion");
    await page.getByRole("button", { name: "Utiliser un mot de passe" }).click();
    await expect(page.getByLabel("Mot de passe")).toBeVisible();
    expect(violations).toEqual([]);
  });

  test("l'API refuse sans session", async ({ request }) => {
    const res = await request.get("/api/v1/me");
    expect(res.status()).toBe(401);
    const org = await request.get("/api/v1/orgs/00000000-0000-4000-8000-000000000000/tracking");
    expect(org.status()).toBe(401);
  });

  test("le cron refuse sans secret", async ({ request }) => {
    expect((await request.get("/api/cron/hourly")).status()).toBe(401);
  });

  test("les fichiers d'association sont servis", async ({ request }) => {
    expect(await (await request.get("/.well-known/assetlinks.json")).json()).toEqual(expect.any(Array));
    expect(await (await request.get("/.well-known/apple-app-site-association")).json()).toHaveProperty("applinks");
  });
});

test("connexion impossible avec un mauvais mot de passe", async ({ page }) => {
  const email = uniqueEmail("erreur");
  await page.goto("/connexion");
  await page.getByRole("button", { name: "Utiliser un mot de passe" }).click();
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
});
