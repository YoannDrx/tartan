import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Client } from "pg";

const DB = process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e";

export const PASSWORD = "mot-de-passe-de-test-e2e";

/**
 * Ajoute une fiche à la séance depuis la bibliothèque du constructeur : sa colonne sur ordinateur, sa feuille
 * ailleurs. Le constructeur n'embarque plus la bibliothèque : on cherche la fiche, comme un coach.
 */
export const addFromLibrary = async (page: Page, name: string) => {
  const opener = page.getByRole("button", { name: w.exercises.picker.open, exact: true });
  const aside = page.getByRole("complementary", { name: m.builder.library });
  const asideSearch = aside.getByPlaceholder(m.builder.sequence.searchExercise);
  await expect(asideSearch.or(opener)).toBeVisible({ timeout: 30_000 });
  const inSheet = await opener.isVisible();
  if (inSheet) await opener.click();
  const scope = inSheet ? page.getByRole("dialog") : aside;
  // La recherche part au serveur : on attend sa réponse, pour qu'aucune requête ne reste en vol après l'ajout.
  const field = scope.getByPlaceholder(m.builder.sequence.searchExercise);
  if ((await field.inputValue()) === name) await field.fill("");
  const searched = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      (response.request().postData() ?? "").includes(`"q":${JSON.stringify(name)}`),
  );
  await field.fill(name);
  await searched;
  await scope.getByRole("button", { name: m.builder.sequence.addToSession(name), exact: true }).click();
  if (inSheet) {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  }
};

const slug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[^a-z]/gi, "")
    .toLowerCase();

export const uniqueEmail = (name: string) =>
  `${slug(name)}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.tartan.test`;

// Une requête sur la base des parcours, pour ce que le navigateur ne peut pas faire (vieillir une session,
// confirmer une adresse sans ouvrir l'e-mail).
export const sqlQuery = async <Row extends Record<string, unknown>>(text: string, values: unknown[] = []) => {
  const sql = new Client({ connectionString: DB });
  await sql.connect();
  try {
    return (await sql.query<Row>(text, values)).rows;
  } finally {
    await sql.end();
  }
};

// Sur la page de connexion, la création de compte s'ouvre par `?creer` ; une invitation la propose d'emblée.
const createPath = (next: string) =>
  next.startsWith("/connexion") ? `${next}${next.includes("?") ? "&" : "?"}creer=1` : next;

// Le formulaire jusqu'à l'écran d'attente : l'adresse, « Créer avec un mot de passe », le mot de passe.
export const fillSignUp = async (page: Page, email: string, next = "/connexion", password = PASSWORD) => {
  await page.goto(createPath(next), { waitUntil: "networkidle" });
  await page.getByLabel(m.auth.emailLabel).fill(email);
  await page.getByRole("button", { name: w.auth.create.withPassword, exact: true }).click();
  await page.getByLabel(w.auth.create.passwordLabel, { exact: true }).fill(password);
  await page.getByRole("button", { name: w.auth.create.submit, exact: true }).click();
  await expect(page.getByRole("heading", { name: w.auth.sent.verifyTitle })).toBeVisible();
};

// La connexion par mot de passe, comme la fait une personne : l'adresse, « Continuer avec mon mot de passe »,
// le mot de passe, « Se connecter ».
export const signInWithPassword = async (page: Page, email: string, next = "/connexion", password = PASSWORD) => {
  await page.goto(next, { waitUntil: "networkidle" });
  // Une invitation propose d'abord de créer un compte : ici, la personne en a déjà un.
  if (!next.startsWith("/connexion")) await page.getByRole("button", { name: w.auth.haveAccount }).click();
  await page.getByLabel(m.auth.emailLabel).fill(email);
  await page.getByRole("button", { name: w.auth.signIn.withPassword, exact: true }).click();
  await page.getByLabel(w.auth.signIn.passwordLabel, { exact: true }).fill(password);
  const submit = page.getByRole("button", { name: w.auth.signIn.submit, exact: true });
  await submit.click();
  // La connexion recharge la page : un champ rempli avant la fin serait perdu.
  // Le test vidéo utilise next dev : la première compilation de /accueil peut dépasser
  // 15 s sur le runner CI. Le build de production conserve son seuil strict.
  await expect(submit).toBeHidden({ timeout: process.env.E2E_PROD ? 15_000 : 60_000 });
  await page.waitForLoadState("networkidle");
};

// Après la confirmation, un compte sans espace arrive sur l'aiguillage de `/bienvenue`. Les parcours de coach vont droit
// à « Je suis coach » ; l'aiguillage lui-même est éprouvé par `athlete-autonome.spec.ts`.
export const COACH_START = "/connexion?next=%2Fbienvenue%2Fcoach";

export const signUp = async (page: Page, email: string, next = COACH_START) => {
  await fillSignUp(page, email, next);
  // Le lien de confirmation part par e-mail : ici, le test le remplace par une écriture en base. Le vrai lien est
  // suivi dans password.spec.ts.
  await sqlQuery(`update "user" set email_verified = true where email = $1`, [email]);
  await signInWithPassword(page, email, next);
};

// La déconnexion par l'écran : Réglages, rubrique Connexion.
export const signOutFromSettings = async (page: Page) => {
  await page.goto("/reglages/connexion", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: m.common.signOut, exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
  // Plus de session : une page de l'application renvoie à la connexion.
  await expect.poll(async () => (await page.request.get("/api/v1/me")).status()).toBe(401);
};

// L'onboarding du coach se fait en trois temps : chaque « Continuer » valide le temps affiché.
export const nextOnboardingStep = async (page: Page) =>
  page.getByRole("button", { name: m.onboarding.next, exact: true }).click();

export const createCoachSpace = async (page: Page, name = "Thomas", email = uniqueEmail(name.toLowerCase())) => {
  await signUp(page, email);
  await completeCoachOnboarding(page, name);
};

// Du compte tout juste connecté à l'espace créé : profil, espace et premier groupe, conditions.
export const completeCoachOnboarding = async (page: Page, name = "Thomas") => {
  // Un lien reçu par e-mail ramène à l'aiguillage de `/bienvenue` : le coach y choisit « Je suis coach ».
  // En développement, la première compilation d'une page peut prendre longtemps.
  const switchboard = page.getByRole("heading", { name: w.welcome.title });
  const form = page.getByRole("heading", { name: "Crée ton espace coach" });
  await expect(switchboard.or(form)).toBeVisible({ timeout: 60_000 });
  if (await switchboard.isVisible()) await page.getByRole("link", { name: new RegExp(w.welcome.coach.title) }).click();
  await expect(form).toBeVisible({ timeout: 60_000 });
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
  // Le dernier temps, facultatif, propose d'inviter le groupe : on le passe.
  await expect(page.getByRole("heading", { name: w.onboarding.invite.title })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: w.onboarding.invite.finish, exact: true }).click();
  // Un espace neuf ouvre le tour de piste une fois, par-dessus le suivi : on le referme, comme un coach pressé.
  await closeTour(page);
  await expect(page.getByRole("heading", { name: "Suivi du groupe" })).toBeVisible();
  // Un espace neuf guide le coach, même avec sa bibliothèque de départ.
  await expect(page.getByRole("heading", { name: "Pour démarrer" })).toBeVisible();
};

// L'écriture d'un état des premiers pas (`tourSeen`, `welcomeSeen`, `dismissed`…). Elle part en `keepalive` (PATCH
// sur l'API), donc survit à un rechargement ; le parcours l'attend quand même, pour lire la base d'un autre navigateur
// sans course. Les gestes de la carte passent par une action serveur (POST) : les deux sont attendus.
export const savedOnboarding = (page: Page, key: string) =>
  page.waitForResponse(
    (response) =>
      ["POST", "PATCH"].includes(response.request().method()) && Boolean(response.request().postData()?.includes(key)),
  );

// Le tour de piste d'un nouveau coach se referme d'Échap, à tout moment.
export const closeTour = async (page: Page) => {
  const tour = page.getByRole("dialog", { name: w.onboarding.tour.title });
  // En développement, la première compilation du suivi peut prendre longtemps.
  await expect(tour).toBeVisible({ timeout: 60_000 });
  const saved = savedOnboarding(page, "tourSeen");
  await page.keyboard.press("Escape");
  await expect(tour).toBeHidden();
  // L'état est gardé en base : on attend son écriture avant de quitter l'écran.
  await saved;
};

export const expectAccessible = async (page: Page) => {
  // Après un changement de page, le titre de l'onglet peut arriver à la fin de la transition, donc jusqu'à
  // 200 ms après le contenu : on juge la page installée, pas l'image d'entre-deux.
  await expect(page).toHaveTitle(/\S/);
  // Un dialogue ou un menu qui entre ou qui sort est à demi transparent le temps de son animation : là aussi,
  // on attend qu'il soit posé. Les animations sans fin et celles que pilote le défilement ne comptent pas.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.timeline instanceof DocumentTimeline &&
              animation.playState === "running" &&
              animation.effect?.getComputedTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished.catch(() => undefined)),
      ),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]),
  );
  // Sous l'en-tête fixe, un champ à moitié recouvert compterait comme une cible trop petite : tout dépendrait du défilement.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  // Même chose en bas : une cible que la barre de navigation fixe ou une barre d'action collante recouvre à cet
  // instant n'est pas trop petite, elle est sous la barre. On la marque, et seule la règle de taille l'ignore.
  await page.evaluate(() => {
    for (const marked of document.querySelectorAll("[data-axe-obscured]")) marked.removeAttribute("data-axe-obscured");
    const chrome = (element: Element | null) => {
      for (let node = element; node; node = node.parentElement) {
        const position = getComputedStyle(node).position;
        if (position === "fixed" || position === "sticky") return node;
      }
      return null;
    };
    for (const target of document.querySelectorAll(
      "a[href], button, input, select, textarea, summary, [role=button]",
    )) {
      const box = target.getBoundingClientRect();
      if (!box.width || !box.height || box.bottom <= 0 || box.top >= innerHeight) continue;
      const cover = document.elementFromPoint(
        box.left + box.width / 2,
        Math.min(box.top + box.height / 2, innerHeight - 1),
      );
      if (!cover || cover === target || target.contains(cover) || cover.contains(target)) continue;
      const bar = chrome(cover);
      if (bar && !bar.contains(target)) target.setAttribute("data-axe-obscured", "");
    }
  });
  const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
  // Deux passes l'une après l'autre : axe ne tourne pas deux fois en même temps dans une page.
  const results = await new AxeBuilder({ page }).withTags(tags).disableRules(["target-size"]).analyze();
  const sizes = await new AxeBuilder({ page }).withRules(["target-size"]).exclude("[data-axe-obscured]").analyze();
  const violations = [...results.violations, ...sizes.violations];
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
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
      // Une animation que le filet a ramenée à 0,01 ms ne déplace rien, même saisie en cours de route sur une
      // machine chargée : seules comptent celles qui durent vraiment.
      if (!(Number(animation.effect?.getComputedTiming().duration) > 1)) continue;
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

// Les transitions de vue : ce que le navigateur anime réellement, lu au moment où la transition est prête.
export type Played = { pseudo: string; name: string; duration: number };
type Recorded = { animations?: Played[]; finished?: boolean };
type Probed = Window & { __transitions: Recorded[] };

// Note chaque transition de vue que la page démarre, et ce que le navigateur anime une fois qu'elle est prête.
export const recordTransitions = (page: Page) =>
  page.evaluate(() => {
    const log: Recorded[] = [];
    (window as unknown as Probed).__transitions = log;
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((update: never) => {
      const transition = start(update);
      const entry: Recorded = {};
      log.push(entry);
      void transition.ready.then(() => {
        entry.animations = document
          .getAnimations()
          .map((animation) => {
            const effect = animation.effect as KeyframeEffect;
            return {
              pseudo: effect.pseudoElement ?? "",
              name: (animation as CSSAnimation).animationName ?? "",
              duration: Number(effect.getComputedTiming().duration),
            };
          })
          .filter((item) => item.pseudo.startsWith("::view-transition"));
      });
      void transition.finished.then(() => (entry.finished = true));
      return transition;
    }) as typeof document.startViewTransition;
  });
export const recordedTransitions = (page: Page) => page.evaluate(() => (window as unknown as Probed).__transitions);
// La première transition, une fois terminée : celle du changement de page.
export const firstTransition = async (page: Page) => {
  await expect.poll(async () => (await recordedTransitions(page))[0]?.finished).toBe(true);
  return (await recordedTransitions(page))[0]!.animations!;
};
export const durationOf = (played: Played[], pseudo: string) => played.find((item) => item.pseudo === pseudo)?.duration;
