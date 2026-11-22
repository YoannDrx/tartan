import { test, type Page } from "@playwright/test";
import path from "node:path";

// Captures du bureau coach pour le site, sur le jeu de données de pnpm --filter @tartan/web demo:preparation.
// Ne tourne que si CAPTURE_BASE_URL est fournie : jamais dans la recette ordinaire.
const base = process.env.CAPTURE_BASE_URL;
const out = path.resolve(import.meta.dirname, "../src/features/landing/images");

test.skip(!base, "capture à la demande");

const signIn = async (page: Page) => {
  await page.goto(`${base}/connexion`);
  const res = await page.request.post(`${base}/api/auth/sign-in/email`, {
    headers: { origin: base! },
    data: { email: "coach@capture.tartan.test", password: "capture-locale-tartan" },
  });
  if (!res.ok()) throw new Error(`Connexion refusée : ${res.status()}`);
};

const shot = async (page: Page, url: string, file: string) => {
  await page.goto(`${base}${url}`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal, [data-next-badge-root] { display: none !important; }" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, file) });
};

test.describe("bureau", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("captures du bureau coach", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    test.setTimeout(240_000);
    await signIn(page);
    await shot(page, "/calendrier?vue=mois", "web-mois.png");
    await shot(page, "/suivi", "web-suivi.png");
    const me = await (await page.request.get(`${base}/api/v1/me`)).json();
    const today = new Date().toISOString().slice(0, 10);
    const inTenDays = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const calendar = await (
      await page.request.get(
        `${base}/api/v1/orgs/${me.spaces[0].organizationId}/calendar?from=${today}&to=${inTenDays}`,
      )
    ).json();
    const session = calendar.sessions.find((s: { type: string }) => s.type === "strength");
    await shot(page, `/seances/${session.id}`, "web-constructeur.png");
  });

  // Le tour de piste du coach montre les fonctions que le site ne capture pas : même jeu de données, autre dossier
  // (`src/features/onboarding/captures/provenance.json`). Le planificateur s'ouvre sur sa consigne, sans appel au
  // prestataire : lancer le serveur avec AI_PLANNER_ENABLED=true, accord du coach déjà donné. L'image s'arrête sous le
  // contenu : le tour la montre dans un cadre bas.
  test("captures du tour de piste", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    test.setTimeout(240_000);
    const tour = path.resolve(import.meta.dirname, "../src/features/onboarding/captures");
    await signIn(page);
    for (const [url, file] of [
      ["/planificateur", "web-planificateur.png"],
      ["/phases", "web-phases.png"],
      ["/annonces", "web-annonces.png"],
    ] as const) {
      await page.goto(`${base}${url}`, { waitUntil: "networkidle" });
      await page.addStyleTag({ content: "nextjs-portal, [data-next-badge-root] { display: none !important; }" });
      // Le planificateur se montre par sa demande : pour qui, quand et le champ unique, sous l'en-tête.
      if (url === "/planificateur")
        await page.evaluate(() => {
          const form = document.querySelector("main form");
          if (form)
            window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - 96, behavior: "instant" });
        });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(tour, file), clip: { x: 0, y: 0, width: 1440, height: 720 } });
    }
  });
});
