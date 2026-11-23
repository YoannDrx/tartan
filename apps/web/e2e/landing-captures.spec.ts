import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { w } from "@tartan/i18n/web";
import { Client } from "pg";
import sharp from "sharp";

// Les captures du bureau coach pour la page d'accueil, sur le jeu de données fictif de `demo:preparation`.
// Ne tourne que si CAPTURE_BASE_URL est fournie : jamais dans la recette ordinaire ni en CI.
//
//   1. Base locale à soi, remplie : `DATABASE_URL=… pnpm --filter @tartan/web demo:preparation`.
//   2. Le clip de l'analyse vidéo (le geste animé d'une fiche, filmé ici), puis un serveur de développement : seul
//      le développement lit `VIDEO_DEV_MP4_URL`, pointée sur `http://localhost:<port>/dev-clip.mp4` :
//        CAPTURE_BASE_URL=http://localhost:3190 CAPTURE_DATABASE_URL=… \
//          pnpm --filter @tartan/web exec playwright test e2e/landing-captures.spec.ts --project=desktop -g "clip"
//   3. Les écrans, sur un build de production (`next build && next start`, AI_PLANNER_ENABLED=true), sauf les
//      vidéos, prises sur le serveur de développement :
//        … -g "bureau|athlète$" sur le build, puis … -g "vidéo" sur le serveur de développement.
//
// Le PNG reste la capture brute, sans cadre : la page d'accueil dessine l'appareil autour
// (`src/features/landing/device-frame.tsx`). La provenance est tenue dans `images/provenance.json`.
const base = process.env.CAPTURE_BASE_URL;
const database = process.env.CAPTURE_DATABASE_URL ?? process.env.DATABASE_URL;
// CAPTURE_OUT : un dossier d'essai, pour regarder avant de remplacer les images du site.
const out = process.env.CAPTURE_OUT ?? path.resolve(import.meta.dirname, "../src/features/landing/images");
const clipDir = process.env.CAPTURE_CLIP_DIR ?? path.join(tmpdir(), "tartan-landing-clip");
const publicClip = path.resolve(import.meta.dirname, "../public/dev-clip.mp4");

test.skip(!base, "capture à la demande");
test.use({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: "light",
  locale: "fr-FR",
  timezoneId: "Europe/Paris",
});

// Le lundi de la semaine en cours, et celui de la semaine passée, à Paris.
const monday = (weeksAgo = 0) => {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  now.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7 * weeksAgo);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

// Fait défiler la page pour poser un repère juste sous l'en-tête de l'application.
const scrollTo = async (page: Page, text: string) => {
  await page
    .locator("main")
    .getByText(text, { exact: true })
    .last()
    .evaluate((element) =>
      window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 140, behavior: "instant" }),
    );
};

const COACH = { email: "coach@capture.tartan.test", password: "capture-locale-tartan" };
const ATHLETE = { email: "athlete@capture.tartan.test", password: "capture-locale-tartan" };

const signIn = async (page: Page, who = COACH) => {
  const res = await page.request.post(`${base}/api/auth/sign-in/email`, { headers: { origin: base! }, data: who });
  if (!res.ok()) throw new Error(`Connexion refusée : ${res.status()}`);
};

const query = async <T>(sql: string, values: unknown[] = []) => {
  const client = new Client({ connectionString: database });
  await client.connect();
  try {
    return (await client.query(sql, values)).rows as T[];
  } finally {
    await client.end();
  }
};
const one = async (sql: string, values: unknown[] = []) => {
  const [row] = await query<{ id: string }>(sql, values);
  if (!row) throw new Error(`Rien trouvé : ${sql}`);
  return row.id;
};

const settle = async (page: Page) => {
  // Le badge de développement de Next et l'invitation à installer l'app ne font pas partie de l'écran.
  await page.addStyleTag({
    content: "nextjs-portal, [data-next-badge-root] { display: none !important; } * { caret-color: transparent; }",
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
};

// Capture brute, puis PNG en palette : un poids raisonnable pour le dépôt, sans retouche de l'image.
const save = async (page: Page, file: string) => {
  const raw = await page.screenshot();
  mkdirSync(out, { recursive: true });
  await sharp(raw).png({ palette: true, quality: 92, effort: 10, compressionLevel: 9 }).toFile(path.join(out, file));
};

// Le clip de l'analyse vidéo. Chromium de Playwright ne lit pas le H.264 : le même clip, en WebM, servi par plages
// comme un vrai serveur, pour que le lecteur puisse se placer sur une remarque.
const serveClip = async (page: Page) => {
  const clip = readFileSync(path.join(clipDir, "dev-clip.webm"));
  await page.route("**/dev-clip.mp4", (route) => {
    const headers = { "Content-Type": "video/webm", "Accept-Ranges": "bytes" };
    const range = route.request().headers().range;
    if (!range) return route.fulfill({ status: 200, headers, body: clip });
    const [startText, endText] = range.replace("bytes=", "").split("-");
    const start = Number(startText);
    const end = endText ? Number(endText) : clip.length - 1;
    return route.fulfill({
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${clip.length}` },
      body: clip.subarray(start, end + 1),
    });
  });
};

const shot = async (page: Page, url: string, file: string, prepare?: (page: Page) => Promise<void>) => {
  await page.goto(`${base}${url}`, { waitUntil: "networkidle" });
  await settle(page);
  if (prepare) await prepare(page);
  await save(page, file);
};

test.describe("page d'accueil", () => {
  test.setTimeout(300_000);

  // L'analyse vidéo montre un clip : faute de vraie vidéo libre de droits, c'est le geste animé de la fiche
  // « Accélérations » (Inès, une athlète du groupe dessiné pour Tartan), filmé en plein cadre.
  test("clip", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop");
    rmSync(clipDir, { recursive: true, force: true });
    mkdirSync(clipDir, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: clipDir, size: { width: 1280, height: 720 } },
    });
    const started = Date.now();
    const page = await context.newPage();
    // La connexion passe par l'API : aucune page de l'app n'est filmée avant le geste.
    const res = await context.request.post(`${base}/api/auth/sign-in/email`, { headers: { origin: base! }, data: COACH });
    if (!res.ok()) throw new Error(`Connexion refusée : ${res.status()}`);
    const exercise = await one("SELECT id FROM exercises WHERE name = 'Accélérations' AND deleted_at IS NULL LIMIT 1");
    await page.goto(`${base}/exercices/${exercise}`, { waitUntil: "networkidle" });
    const motion = page.getByRole("img", { name: /positions clés du mouvement/ }).first();
    await expect(motion).toBeVisible();
    // Le geste occupe tout le cadre, sur l'encre de sa fiche.
    await motion.evaluate((svg) => {
      const holder = svg.parentElement!;
      holder.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:var(--color-ink)";
      svg.style.cssText = "width:100vw;height:100vh";
      document.body.appendChild(holder);
    });
    await page.addStyleTag({ content: "nextjs-portal, [data-next-badge-root] { display: none !important; }" });
    const from = ((Date.now() - started) / 1000 + 0.6).toFixed(2);
    await page.waitForTimeout(10_000);
    await context.close();
    const recorded = readdirSync(clipDir).find((file) => file.endsWith(".webm"));
    if (!recorded) throw new Error("Aucun enregistrement.");
    renameSync(path.join(clipDir, recorded), path.join(clipDir, "raw.webm"));
    // Le chargement de la page est coupé : le clip commence sur le geste. Le web lit le WebM, iOS le MP4.
    for (const [file, codec] of [
      ["dev-clip.webm", ["-c:v", "libvpx-vp9", "-b:v", "1M"]],
      ["dev-clip.mp4", ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]],
    ] as const) {
      execFileSync("ffmpeg", [
        ...["-y", "-v", "error", "-ss", from, "-t", "8", "-i", path.join(clipDir, "raw.webm"), "-an"],
        ...codec,
        path.join(clipDir, file),
      ]);
    }
    copyFileSync(path.join(clipDir, "dev-clip.mp4"), publicClip);
  });

  test("bureau", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await signIn(page);
    const strength = await one(
      "SELECT id FROM scheduled_sessions WHERE title = 'Force bas du corps' AND date >= CURRENT_DATE ORDER BY date LIMIT 1",
    );
    const alex = await one("SELECT id FROM athletes WHERE first_name = 'Alex' LIMIT 1");
    const squat = await one("SELECT id FROM exercises WHERE name = 'Squat arrière' AND deleted_at IS NULL LIMIT 1");

    await shot(page, `/calendrier?semaine=${monday()}`, "coach-semaine.png");
    await shot(page, "/calendrier?vue=mois", "coach-mois.png");
    // Le constructeur montré par ses blocs : échauffement, force à pourcentages, gainage.
    await shot(page, `/seances/${strength}`, "coach-constructeur.png", (p) =>
      p
        .getByRole("region", { name: "Échauffement", exact: true })
        .evaluate((element) =>
          window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 90, behavior: "instant" }),
        ),
    );
    await shot(page, "/exercices", "coach-bibliotheque.png");
    await shot(page, `/exercices/${squat}`, "coach-fiche-exercice.png", async (p) => {
      // Le geste s'arrête sur une position parlante : le bas du squat.
      await p.getByRole("group", { name: "Positions du geste" }).getByRole("button").nth(2).click();
      await p.waitForTimeout(400);
    });
    // La semaine passée, remplie par les validations du groupe.
    await shot(page, `/suivi?semaine=${monday(1)}`, "coach-suivi.png");
    await shot(page, "/analyse", "coach-analyse.png");
    await shot(page, "/outils/charges", "coach-calculateur.png", async (p) => {
      await p.getByLabel("Charge externe totale (kg)").fill("102,5");
      await p.getByLabel("Répétitions réalisées").fill("5");
      await p.getByRole("button", { name: "Utiliser dans le tableau" }).click();
      await p.waitForTimeout(300);
    });
    await shot(page, `/athletes/${alex}`, "coach-athlete.png");

    // Le planificateur, par sa demande : une séance décrite en une phrase, prête à partir. La capture s'arrête avant
    // l'envoi : la séance composée viendrait du prestataire simulé, pas du vrai planificateur.
    await shot(page, "/planificateur", "coach-planificateur.png", async (p) => {
      await p
        .getByRole("textbox", { name: w.planner.field, exact: true })
        .fill(
          "Jeudi pour le groupe prépa : échauffement de cheville, squat arrière 4 × 5 à 80 %, épaulé 5 × 3, sauts de haies basses 5 × 6, et gainage pour finir.",
        );
      await p.locator("body").click({ position: { x: 5, y: 400 } });
      await p.waitForTimeout(300);
    });
  });

  test("vidéo", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await serveClip(page);
    await signIn(page);
    const video = await one(
      "SELECT v.id FROM videos v JOIN athletes a ON a.id = v.athlete_id WHERE a.first_name = 'Alex' LIMIT 1",
    );
    await shot(page, `/videos/${video}`, "coach-video.png", async (p) => {
      await expect(p.locator("video").first()).toBeVisible();
      // L'image arrêtée sur la seconde remarque du coach, comme quand il la relit.
      await p.getByRole("button", { name: /0:04,2/ }).first().click();
      await p.waitForTimeout(800);
    });
  });
});

// L'athlète, sur téléphone : de préférence l'app native sur le simulateur iOS (`provenance.json` dit d'où vient
// chaque image). Faute de simulateur, la web app à 390 px, comme un téléphone, avec ce parcours.
test.describe("téléphone", () => {
  test.setTimeout(300_000);
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test("athlète", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await signIn(page, ATHLETE);
    const today = await one(
      "SELECT id FROM scheduled_sessions WHERE title = 'Force bas du corps' AND date = CURRENT_DATE LIMIT 1",
    );
    const plyo = await one(
      "SELECT id FROM scheduled_sessions WHERE title = 'Pliométrie, contacts courts' AND date >= CURRENT_DATE ORDER BY date LIMIT 1",
    );
    const running = await one(
      "SELECT id FROM scheduled_sessions WHERE title = 'Technique de course' AND date >= CURRENT_DATE ORDER BY date LIMIT 1",
    );

    await shot(page, "/aujourdhui", "athlete-journee.png");
    await shot(page, "/calendrier?vue=liste", "athlete-semaine.png");
    // Le mode séance, une étape par exercice : on avance jusqu'à celui qu'on veut montrer.
    const step = (count: number, then?: (p: Page) => Promise<void>) => async (p: Page) => {
      for (let i = 0; i < count; i++) await p.getByRole("button", { name: "Étape suivante" }).click();
      if (then) await then(p);
      await p.waitForTimeout(600);
    };
    // La séance de force du jour : le squat à 80 % devient sa charge en kilos ; deux séries déjà cochées.
    await shot(
      page,
      `/seance/${today}/mode`,
      "athlete-musculation.png",
      step(1, async (p) => {
        for (const set of [1, 2]) await p.getByRole("button", { name: `Série ${set} à faire` }).click();
      }),
    );
    await shot(page, `/seance/${plyo}/mode`, "athlete-pliometrie.png", step(1));
    await shot(page, `/seance/${running}/mode`, "athlete-course.png", step(2));
    // La fiche d'un exercice, ouverte depuis la séance : le geste animé et ses étapes.
    await shot(
      page,
      `/seance/${today}/mode`,
      "athlete-fiche.png",
      step(2, async (p) => {
        await p.getByText("Voir le guide du mouvement").click();
        await scrollTo(p, "Voir le guide du mouvement");
      }),
    );
    await shot(page, "/outils/charges", "athlete-calculateur.png", async (p) => {
      await p.getByLabel("Charge externe totale (kg)").fill("95");
      await p.getByLabel("Répétitions réalisées").fill("6");
      await p.getByRole("button", { name: "Utiliser dans le tableau" }).click();
      await p.waitForTimeout(300);
    });
    await shot(page, "/progres", "athlete-progres.png");
  });

  // La vidéo de l'athlète, sur le serveur de développement, comme celle du coach.
  test("vidéo de l'athlète", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await serveClip(page);
    await signIn(page, ATHLETE);
    const video = await one(
      "SELECT v.id FROM videos v JOIN athletes a ON a.id = v.athlete_id WHERE a.first_name = 'Alex' LIMIT 1",
    );
    await shot(page, `/mes-videos/${video}`, "athlete-video.png", async (p) => {
      await expect(p.locator("video").first()).toBeVisible();
      await p.getByRole("button", { name: /0:04,2/ }).first().click();
      await p.waitForTimeout(800);
    });
  });
});
