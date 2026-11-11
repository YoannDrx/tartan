import { expect, type APIRequestContext, type Browser, type BrowserContext } from "@playwright/test";
import { Client } from "pg";
import { createCoachSpace, signUp, uniqueEmail } from "./helpers";
import { groupLink, joinAsAthlete } from "./journeys";

// Les comptes de docs/tests/comptes.md, construits en un appel sur la base e2e.
// Équivalent Vitest : tests/personas.ts.
// Chaque persona porte un contexte de navigateur connecté : `request` parle à l'API avec sa vraie session.

const DB = process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e";

export type Offre = "discovery" | "pilot" | "coach" | "club";
export type Persona = { context: BrowserContext; request: APIRequestContext; userId: string; email: string };

export const sql = async <T>(run: (client: Client) => Promise<T>): Promise<T> => {
  const client = new Client({ connectionString: DB });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
};

const newContext = (browser: Browser) => browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });

const personaOf = async (context: BrowserContext): Promise<Persona & { spaces: { organizationId: string }[] }> => {
  const response = await context.request.get("/api/v1/me");
  expect(response.status()).toBe(200);
  const me = (await response.json()) as { id: string; email: string; spaces: { organizationId: string }[] };
  return { context, request: context.request, userId: me.id, email: me.email, spaces: me.spaces };
};

// L'offre d'un espace : sans ligne de droits, les limites sont celles de l'offre.
export const setOffre = (organizationId: string, offre: Offre) =>
  sql(async (client) => {
    await client.query("update organizations set plan = $2 where id = $1", [organizationId, offre]);
    await client.query("delete from entitlements where organization_id = $1", [organizationId]);
  });

const coachSpace = async (browser: Browser, name: string) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  await createCoachSpace(page, name);
  const persona = await personaOf(context);
  const organizationId = persona.spaces[0]!.organizationId;
  const groups = (await (await context.request.get(`/api/v1/orgs/${organizationId}/groups`)).json()) as {
    id: string;
  }[];
  return { persona, page, organizationId, groupId: groups[0]!.id };
};

// Un compte vérifié et connecté, sans espace.
const account = async (browser: Browser, name: string) => {
  const context = await newContext(browser);
  await signUp(await context.newPage(), uniqueEmail(name));
  return personaOf(context);
};

export const buildPersonas = async (browser: Browser, options: { offre?: Offre } = {}) => {
  // Espace principal : sans limite par défaut, pour que l'offre ne réponde pas à la place du contrôle d'accès.
  const main = await coachSpace(browser, "Proprio");
  await setOffre(main.organizationId, options.offre ?? "pilot");

  // L'athlète rejoint le premier groupe par le lien du groupe, avec tous ses accords.
  const joined = await joinAsAthlete(browser, await groupLink(main.page), "Lea");
  const athlete = await personaOf(joined.context);
  const athletes = (await (await main.persona.request.get(`/api/v1/orgs/${main.organizationId}/athletes`)).json()) as {
    id: string;
    firstName: string;
  }[];

  // Le coach arrive par une invitation nominative, acceptée avec son propre compte.
  const coach = await account(browser, "coachinvite");
  const invitation = await main.persona.request.post(`/api/v1/orgs/${main.organizationId}/invitations`, {
    data: { kind: "personal_email", role: "coach", email: coach.email, groupIds: [main.groupId] },
  });
  expect(invitation.status()).toBe(200);
  const token = ((await invitation.json()) as { link: string }).link.split("/").pop()!;
  const accepted = await coach.request.post(`/api/v1/invitations/${token}/accept`, {
    data: {
      firstName: "Coach",
      lastName: "Invité",
      birthDate: "1988-09-02",
      consents: { terms: true, health: false, video: false },
    },
  });
  expect(accepted.status()).toBe(200);

  // Un autre espace, étanche au premier.
  const other = await coachSpace(browser, "AutreEspace");

  // Administrateur de la plateforme : aucun espace, donc aucun droit sur les données d'un espace.
  const admin = await account(browser, "admin");
  await sql((client) =>
    client.query("insert into platform_admins (email, updated_at) values ($1, now())", [admin.email.toLowerCase()]),
  );

  const anonymous = await newContext(browser);
  const personas = {
    anonyme: { context: anonymous, request: anonymous.request, userId: "", email: "" },
    autreEspace: other.persona,
    admin,
    athlete,
    coach,
    proprietaire: main.persona,
  } satisfies Record<string, Persona>;

  return {
    ...personas,
    main: {
      organizationId: main.organizationId,
      groupId: main.groupId,
      athleteId: athletes.find((row) => row.firstName === "Lea")!.id,
    },
    other: { organizationId: other.organizationId, groupId: other.groupId },
    close: () => Promise.all(Object.values(personas).map((persona) => persona.context.close())),
  };
};

export type Personas = Awaited<ReturnType<typeof buildPersonas>>;
export const PERSONAS = ["anonyme", "autreEspace", "admin", "athlete", "coach", "proprietaire"] as const;
export type PersonaKey = (typeof PERSONAS)[number];
