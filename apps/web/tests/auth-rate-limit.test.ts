import { beforeAll, describe, expect, it, vi } from "vitest";

// Les limites de débit de la connexion, sur le vrai serveur d'authentification, limiteur allumé comme en production.
// Les parcours Playwright les coupent (tous les essais viennent de la même adresse) : c'est ici qu'elles sont tenues.
const ORIGIN = "http://localhost:3000";

// Seul l'interrupteur est forcé : les règles sont celles du code, lues telles quelles.
vi.mock("@/lib/auth-rate-limit", async (original) => {
  const actual = await original<typeof import("@/lib/auth-rate-limit")>();
  return { ...actual, authRateLimit: () => ({ ...actual.authRateLimit(), enabled: true }) };
});

let handler: (request: Request) => Promise<Response>;

beforeAll(async () => {
  handler = (await import("@/lib/auth")).auth.handler;
});

// Chaque scénario vient de sa propre adresse IP : le compteur est par adresse et par route.
const post = (path: string, body: unknown, ip: string) =>
  handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: ORIGIN, "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );

const statuses = async (count: number, call: (index: number) => Promise<Response>) => {
  const seen: number[] = [];
  for (let index = 0; index < count; index += 1) seen.push((await call(index)).status);
  return seen;
};

const unique = (name: string, index: number) => `${name}-${index}-${Date.now()}@test.tartan.coach`;

describe("limites de débit de la connexion", () => {
  // La demande de lien passe par `/sign-in/magic-link` : c'est la règle `/sign-in/*` qui la compte.
  it("lien de connexion : dix demandes par minute, la onzième est refusée", async () => {
    const seen = await statuses(11, (index) =>
      post("/sign-in/magic-link", { email: unique("lien", index), callbackURL: "/accueil" }, "203.0.113.10"),
    );
    expect(seen).toEqual([...Array<number>(10).fill(200), 429]);
  });

  it("le renvoi du lien compte dans la même limite, pour une même adresse e-mail", async () => {
    const email = unique("renvoi", 0);
    const seen = await statuses(11, () =>
      post("/sign-in/magic-link", { email, callbackURL: "/accueil" }, "203.0.113.11"),
    );
    expect(seen.at(-1)).toBe(429);
    expect(seen.filter((status) => status === 200)).toHaveLength(10);
  });

  it("ouverture d'un lien : cinq essais par minute, un jeton ne se devine pas à la chaîne", async () => {
    const seen = await statuses(6, (index) =>
      handler(
        new Request(`${ORIGIN}/api/auth/magic-link/verify?token=faux-jeton-${index}&callbackURL=%2Faccueil`, {
          headers: { origin: ORIGIN, "x-forwarded-for": "203.0.113.14" },
        }),
      ),
    );
    expect(seen.slice(0, 5).every((status) => status !== 429)).toBe(true);
    expect(seen[5]).toBe(429);
  });

  it("renvoi du lien de confirmation : trois par minute", async () => {
    const seen = await statuses(4, () =>
      post("/send-verification-email", { email: unique("confirmation", 0), callbackURL: "/accueil" }, "203.0.113.15"),
    );
    expect(seen).toEqual([200, 200, 200, 429]);
  });

  it("création de compte par mot de passe : cinq par minute", async () => {
    const seen = await statuses(6, (index) =>
      post(
        "/sign-up/email",
        { email: unique("creation", index), password: "un-mot-de-passe-solide", name: "x" },
        "203.0.113.12",
      ),
    );
    expect(seen).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("connexion par mot de passe : dix essais par minute, le onzième est refusé sans être examiné", async () => {
    const seen = await statuses(11, (index) =>
      post("/sign-in/email", { email: unique("essai", 0), password: `faux-mot-de-passe-${index}` }, "203.0.113.13"),
    );
    expect(seen.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(seen[10]).toBe(429);
  });

  it("une autre adresse IP n'est pas pénalisée", async () => {
    const response = await post(
      "/sign-in/magic-link",
      { email: unique("ailleurs", 0), callbackURL: "/accueil" },
      "203.0.113.99",
    );
    expect(response.status).toBe(200);
  });
});
