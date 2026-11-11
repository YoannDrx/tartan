import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import { Client } from "pg";

const DB = process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e";

export const PASSWORD = "mot-de-passe-de-test-e2e";

const slug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[^a-z]/gi, "")
    .toLowerCase();

export const uniqueEmail = (name: string) =>
  `${slug(name)}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.tartan.test`;

export const signUp = async (page: Page, email: string, next = "/connexion") => {
  await page.goto(next, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Utiliser un mot de passe" }).click();
  await page.getByRole("button", { name: /Pas encore de compte/ }).click();
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte", exact: true }).click();
  // Le lien de confirmation part par e-mail : le test le remplace par une écriture en base.
  await expect(page.getByText(m.auth.verifySent)).toBeVisible();
  const sql = new Client({ connectionString: DB });
  await sql.connect();
  await sql.query(`update "user" set email_verified = true where email = $1`, [email]);
  await sql.end();
  await page.goto(next, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Utiliser un mot de passe" }).click();
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  const signIn = page.getByRole("button", { name: m.auth.signInWithPassword, exact: true });
  await signIn.click();
  // La connexion recharge la page : un champ rempli avant la fin serait perdu.
  // Le test vidéo utilise next dev : la première compilation de /accueil peut dépasser
  // 15 s sur le runner CI. Le build de production conserve son seuil strict.
  await expect(signIn).toBeHidden({ timeout: process.env.E2E_PROD ? 15_000 : 60_000 });
  await page.waitForLoadState("networkidle");
};

// L'onboarding du coach se fait en trois temps : chaque « Continuer » valide le temps affiché.
export const nextOnboardingStep = async (page: Page) =>
  page.getByRole("button", { name: m.onboarding.next, exact: true }).click();

export const createCoachSpace = async (page: Page, name = "Thomas", email = uniqueEmail(name.toLowerCase())) => {
  await signUp(page, email);
  // En développement, la première compilation d'une page peut prendre longtemps.
  await expect(page.getByRole("heading", { name: "Crée ton espace coach" })).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  // Le début de l'adresse n'est pas un prénom : le champ attend le vrai.
  await expect(page.getByLabel("Prénom")).toHaveValue("");
  await page.getByLabel("Prénom").fill(name);
  await page.getByLabel("Nom", { exact: true }).fill("Coach");
  await page.getByLabel("Date de naissance").fill("1985-03-14");
  await nextOnboardingStep(page);
  await page.getByLabel("Nom du club ou de ton coaching").fill(`Coaching ${name}`);
  await page.getByLabel("Premier groupe", { exact: true }).fill("Hauteur Élite");
  await nextOnboardingStep(page);
  await page.getByRole("checkbox", { name: /conditions d'utilisation/ }).check();
  await page.getByRole("button", { name: "Créer mon espace" }).click();
  await page.getByRole("button", { name: m.age.saveConfirmed, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Suivi du groupe" })).toBeVisible({ timeout: 60_000 });
  // Un espace neuf guide le coach, même avec sa bibliothèque de départ.
  await expect(page.getByRole("heading", { name: "Pour démarrer" })).toBeVisible();
};

export const expectAccessible = async (page: Page) => {
  // Après un changement de page, le titre de l'onglet peut arriver à la fin de la transition, donc jusqu'à
  // 200 ms après le contenu : on juge la page installée, pas l'image d'entre-deux.
  await expect(page).toHaveTitle(/\S/);
  // Sous l'en-tête fixe, un champ à moitié recouvert compterait comme une cible trop petite : tout dépendrait du défilement.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
};

export const expectNoHorizontalScroll = async (page: Page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
};

// Ce qui bouge encore sur la page : une animation en cours, ou une durée d'animation ou de transition non nulle.
export const motionOn = (page: Page) =>
  page.evaluate(async () => {
    // Une animation ramenée à une durée nulle met une image à se terminer : on la laisse finir avant de juger.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await new Promise((resolve) => setTimeout(resolve, 50));
    const seconds = (list: string) =>
      list.split(",").map((part) => (part.trim().endsWith("ms") ? parseFloat(part) / 1000 : parseFloat(part)));
    const longer = (list: string) => seconds(list).some((duration) => duration > 0.001);
    const name = (element: Element, pseudo: string) => {
      const first = typeof element.className === "string" ? element.className.split(/\s+/)[0] : "";
      return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${first ? `.${first}` : ""}${pseudo}`;
    };
    const found = new Set<string>();
    for (const element of document.querySelectorAll("*")) {
      for (const pseudo of ["", "::before", "::after"]) {
        const style = getComputedStyle(element, pseudo || null);
        if (pseudo && style.content === "none") continue;
        if (style.animationName !== "none" && longer(style.animationDuration)) found.add(name(element, pseudo));
        if (style.transitionProperty !== "none" && longer(style.transitionDuration)) found.add(name(element, pseudo));
      }
    }
    for (const animation of document.getAnimations()) {
      if (animation.playState !== "running") continue;
      const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
      found.add(`en cours : ${target ? name(target, "") : "sans cible"}`);
    }
    return [...found];
  });

// En mouvement réduit, rien ne bouge : ni animation, ni transition, quel que soit le composant.
export const expectNoMotion = async (page: Page) => {
  const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  expect(reduced, "la page doit être émulée en mouvement réduit").toBe(true);
  expect(await motionOn(page)).toEqual([]);
};
