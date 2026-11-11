import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { createApiClient } from "../../../packages/api-client/src/index";
import { createCoachSpace, PASSWORD, uniqueEmail } from "./helpers";
import { groupLink, joinAsAthlete } from "./journeys";

// T07 : la suppression telle que l'app native la demande, sur un vrai serveur.
test("un compte supprimé par le client natif disparaît, et toutes ses sessions sont coupées", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail("efface");
  await createCoachSpace(page, "Efface", email);
  const origin = new URL(page.url()).origin;
  const me = (await (await page.request.get("/api/v1/me")).json()) as { id: string };
  const athlete = await joinAsAthlete(browser, await groupLink(page), "Reste");
  const athleteMe = (await (await athlete.page.request.get("/api/v1/me")).json()) as { id: string };

  // Le même compte, ouvert sur un second appareil.
  const second = await browser.newContext({ baseURL: origin });
  const signedIn = await second.request.post("/api/auth/sign-in/email", {
    data: { email, password: PASSWORD },
    headers: { origin },
  });
  expect(signedIn.ok()).toBe(true);
  expect((await second.request.get("/api/v1/me")).status()).toBe(200);

  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  const count = async (query: string, id: string) => Number((await sql.query(query, [id])).rows[0].n);
  try {
    const memberships = await sql.query("SELECT organization_id FROM organization_members WHERE user_id = $1", [me.id]);
    const organizationId = memberships.rows[0].organization_id as string;
    expect(await count("SELECT count(*) AS n FROM session WHERE user_id = $1", me.id)).toBe(2);

    const native = createApiClient({
      baseUrl: origin,
      headers: async () => ({ Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") }),
    });
    await native.deleteAccount();

    // Le compte et ses sessions n'existent plus : aucun des deux appareils ne lit quoi que ce soit.
    expect(await count('SELECT count(*) AS n FROM "user" WHERE id = $1', me.id)).toBe(0);
    expect(await count("SELECT count(*) AS n FROM session WHERE user_id = $1", me.id)).toBe(0);
    expect((await page.request.get("/api/v1/me")).status()).toBe(401);
    expect((await second.request.get("/api/v1/me")).status()).toBe(401);
    await expect(native.deleteAccount()).rejects.toMatchObject({ status: 401 });
    await page.goto("/suivi");
    await expect(page).toHaveURL(/\/connexion/);

    // Seul coach de son espace : l'espace part avec lui.
    expect(await count("SELECT count(*) AS n FROM organizations WHERE id = $1", organizationId)).toBe(0);
    expect(await count("SELECT count(*) AS n FROM athletes WHERE organization_id = $1", organizationId)).toBe(0);

    // L'athlète garde son compte, sans cet espace.
    expect((await athlete.page.request.get("/api/v1/me")).status()).toBe(200);
    expect(await count("SELECT count(*) AS n FROM organization_members WHERE user_id = $1", athleteMe.id)).toBe(0);

    // L'ancien mot de passe n'ouvre plus rien.
    const again = await second.request.post("/api/auth/sign-in/email", {
      data: { email, password: PASSWORD },
      headers: { origin },
    });
    expect(again.status()).toBe(401);
  } finally {
    await sql.end();
    await second.close();
    await athlete.context.close();
  }
});
