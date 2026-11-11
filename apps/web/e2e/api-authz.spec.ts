import { expect, test } from "@playwright/test";
import { buildPersonas, PERSONAS, sql, type PersonaKey, type Personas } from "./personas";

// Matrice d'accès sur le build réel (T04) : routage Next, cookie de session et réponses HTTP.
// La couverture de toutes les routes vit dans tests/api-authz.test.ts ; ici, les routes où une fuite coûterait le plus.

type World = Personas & { videoId: string };
type Row = Record<PersonaKey, number> & {
  route: string;
  path: (w: World) => string;
  data?: (w: World, qui: PersonaKey) => unknown;
};

const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
const range = `from=${today}&to=${today}`;
const org = (w: World, rest: string) => `/api/v1/orgs/${w.main.organizationId}/${rest}`;

const horsEspace = { anonyme: 401, autreEspace: 403, admin: 403 } as const;
const membres = { ...horsEspace, athlete: 200, coach: 200, proprietaire: 200 };
const encadrants = { ...membres, athlete: 403 };
const proprietaireSeul = { ...encadrants, coach: 403 };
const athleteSeul = { ...horsEspace, athlete: 200, coach: 403, proprietaire: 403 };

const MATRICE: Row[] = [
  {
    route: "GET /api/v1/me/export",
    path: () => "/api/v1/me/export",
    anonyme: 401,
    autreEspace: 200,
    admin: 200,
    athlete: 200,
    coach: 200,
    proprietaire: 200,
  },
  { route: "GET /api/v1/orgs/:org/export", path: (w) => org(w, "export"), ...proprietaireSeul },
  {
    route: "GET /api/v1/orgs/:org/tracking/export",
    path: (w) => org(w, `tracking/export?${range}`),
    ...encadrants,
  },
  { route: "GET /api/v1/orgs/:org/billing", path: (w) => org(w, "billing"), ...encadrants },
  { route: "GET /api/v1/orgs/:org/athlete/today", path: (w) => org(w, "athlete/today"), ...athleteSeul },
  {
    route: "GET /api/v1/orgs/:org/athlete/calendar",
    path: (w) => org(w, `athlete/calendar?${range}`),
    ...athleteSeul,
  },
  { route: "GET /api/v1/orgs/:org/athlete/file", path: (w) => org(w, "athlete/file"), ...athleteSeul },
  {
    route: "PUT /api/v1/orgs/:org/athlete/consents",
    path: (w) => org(w, "athlete/consents"),
    data: () => ({ kind: "video", granted: true }),
    ...athleteSeul,
  },
  { route: "GET /api/v1/orgs/:org/videos", path: (w) => org(w, "videos"), ...membres },
  // 503 : accès accordé, puis Mux absent de la configuration e2e. L'envoi réel relève de T10.
  {
    route: "POST /api/v1/orgs/:org/videos",
    path: (w) => org(w, "videos"),
    data: (w) => ({ athleteId: w.main.athleteId }),
    ...encadrants,
    coach: 503,
    proprietaire: 503,
  },
  { route: "GET /api/v1/orgs/:org/videos/:video", path: (w) => org(w, `videos/${w.videoId}`), ...membres },
  {
    route: "POST /api/v1/orgs/:org/videos/:video/share",
    path: (w) => org(w, `videos/${w.videoId}/share`),
    data: () => ({ withAthlete: true }),
    ...encadrants,
  },
  {
    route: "POST /api/v1/orgs/:org/videos/:video/annotations",
    path: (w) => org(w, `videos/${w.videoId}/annotations`),
    data: () => ({ tMs: 1200, text: "Remarque de la matrice" }),
    ...encadrants,
  },
  {
    route: "GET /api/v1/orgs/:org/comments",
    path: (w) => org(w, `comments?entityType=video&entityId=${w.videoId}`),
    ...membres,
  },
  {
    route: "POST /api/v1/orgs/:org/comments",
    path: (w) => org(w, "comments"),
    data: (w, qui) => ({ entityType: "video", entityId: w.videoId, body: `Réponse de la matrice ${qui}` }),
    ...membres,
  },
];

test.describe("matrice d'accès HTTP sur les routes sensibles", () => {
  // Cinq comptes passent par l'inscription réelle avant la première requête.
  test.setTimeout(300_000);

  test("chaque persona reçoit le code attendu, et seulement ses données", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "Les réponses de l'API ne dépendent pas de l'écran.");
    const personas = await buildPersonas(browser);
    // Une vidéo prête de l'athlète, partagée avec lui : aucun envoi vers Mux.
    const videoId = await sql(async (client) => {
      const inserted = await client.query(
        "insert into videos (id, organization_id, athlete_id, uploaded_by, status, shared_with_athlete, updated_at) values (gen_random_uuid(), $1, $2, $3, 'ready', true, now()) returning id",
        [personas.main.organizationId, personas.main.athleteId, personas.proprietaire.userId],
      );
      return inserted.rows[0].id as string;
    });
    const w: World = { ...personas, videoId };
    const emails = PERSONAS.map((qui) => w[qui].email).filter(Boolean);

    for (const row of MATRICE) {
      const method = row.route.split(" ")[0]!;
      for (const qui of PERSONAS) {
        const response = await w[qui].request.fetch(row.path(w), {
          method,
          ...(row.data ? { data: row.data(w, qui) } : {}),
        });
        expect(response.status(), `${row.route} pour ${qui}`).toBe(row[qui]);
        if (row.route === "GET /api/v1/me/export" && response.ok()) {
          // L'export personnel ne contient que le compte qui le demande.
          const texte = await response.text();
          expect(texte).toContain(w[qui].email);
          for (const email of emails.filter((other) => other !== w[qui].email))
            expect(texte, `export de ${qui}`).not.toContain(email);
        }
      }
    }
    await personas.close();
  });
});
