import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll, uniqueEmail } from "./helpers";
import { sql } from "./personas";

// T19 : les pages qui n'avaient aucun parcours, avec de vraies données. Le compte est rempli par le script de
// démonstration (`demo:fill`), le même que pour une démo : un espace coach peuplé, et une place d'athlète dans un club.
// Le script ne tourne qu'une fois par base : un seul projet, sans nouvelle tentative.

const DB = process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e";
const PORT = 3100;

test.describe.configure({ retries: 0 });

const fill = (email: string) =>
  execFileSync("corepack", ["pnpm", "exec", "tsx", "prisma/demo-fill.ts", email], {
    cwd: path.join(import.meta.dirname, ".."),
    env: {
      ...process.env,
      DATABASE_URL: DB,
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
      BETTER_AUTH_SECRET: "secret-e2e-secret-e2e-secret-e2e-secret-e2e",
      CRON_SECRET: "e2e-cron",
      RESEND_API_KEY: "",
      MUX_TOKEN_ID: "",
      MUX_TOKEN_SECRET: "",
      OPENAI_API_KEY: "",
    },
    stdio: "pipe",
  });

const check = async (page: Page) => {
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
};

test("pages remplies : mes vidéos, une vidéo, progrès, actualisation des charges", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Le remplissage ne tourne qu'une fois par base.");
  test.setTimeout(240_000);
  const email = uniqueEmail("rempli");
  await createCoachSpace(page, "Rempli", email);
  fill(email);

  type Space = { organizationId: string; role: string };
  const me = (await (await page.request.get("/api/v1/me")).json()) as { id: string; spaces: Space[] };
  const own = me.spaces.find((space) => space.role === "owner")!;
  const club = me.spaces.find((space) => space.role === "athlete")!;

  // Une vidéo prête, partagée avec l'athlète, avec la remarque de son coach.
  const videoId = await sql(async (client) => {
    const { rows } = await client.query<{ athlete: string; coach: string }>(
      `select a.id as athlete, o.owner_id as coach from athletes a join organizations o on o.id = a.organization_id
       where a.organization_id = $1 and a.user_id = $2`,
      [club.organizationId, me.id],
    );
    const { athlete, coach } = rows[0]!;
    const video = await client.query<{ id: string }>(
      `insert into videos (id, organization_id, athlete_id, uploaded_by, status, mux_playback_id, duration_ms,
         shared_with_athlete, recorded_at, updated_at)
       values (gen_random_uuid(), $1, $2, $3, 'ready', 'lecture-e2e', 4200, true, now(), now()) returning id`,
      [club.organizationId, athlete, coach],
    );
    await client.query(
      `insert into video_annotations (id, video_id, author_id, t_ms, text, updated_at)
       values (gen_random_uuid(), $1, $2, 1200, 'Bras libre plus haut à l''appel', now())`,
      [video.rows[0]!.id, coach],
    );
    return video.rows[0]!.id;
  });

  // Côté athlète, dans le club.
  await page.goto("/accueil");
  await page.getByLabel(m.settings.switchSpace).selectOption(club.organizationId);
  await expect(page.getByRole("heading", { name: /^Salut/ })).toBeVisible();

  await page.goto("/mes-sauts");
  await expect(page.getByRole("heading", { name: m.nav.mesSauts, level: 1 })).toBeVisible();
  await expect(page.locator(`a[href="/mes-sauts/${videoId}"]`)).toBeVisible();
  await check(page);

  await page.goto(`/mes-sauts/${videoId}`);
  await expect(page.getByText("Bras libre plus haut à l'appel")).toBeVisible();
  await check(page);

  await page.goto("/progres");
  await expect(page.getByRole("heading", { name: m.nav.progres, level: 1 })).toBeVisible();
  await expect(page.getByText(m.athletes.regularityTitle)).toBeVisible();
  await check(page);

  // Côté coach, dans son espace : la page d'actualisation des charges d'une séance publiée.
  await page.goto("/accueil");
  await page.getByLabel(m.settings.switchSpace).selectOption(own.organizationId);
  await expect(page.getByRole("heading", { name: "Suivi du groupe" })).toBeVisible();
  const sessionId = await sql(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `select id from scheduled_sessions where organization_id = $1 and published_at is not null order by date desc limit 1`,
      [own.organizationId],
    );
    return rows[0]!.id;
  });
  await page.goto(`/seances/${sessionId}/charges`);
  await expect(page.getByRole("heading", { name: m.prescriptionRefresh.title, level: 1 })).toBeVisible();
  await check(page);
});
