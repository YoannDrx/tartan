import { generateKeyPairSync, randomUUID } from "node:crypto";
import { decodeJwt, decodeProtectedHeader, SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser } from "./helpers";

// T08 : la connexion Apple et Google, telle que la configuration de production la monte.
// Better Auth, la base et le parcours OAuth sont réels ; seul le réseau des fournisseurs est remplacé.
const ORIGIN = "http://localhost:3000";

// Identifiants factices, sans rapport avec un compte réel.
const GOOGLE = { GOOGLE_CLIENT_ID: "client-google-factice", GOOGLE_CLIENT_SECRET: "secret-google-factice" };
const APPLE = {
  APPLE_CLIENT_ID: "coach.tartan.web.factice",
  APPLE_TEAM_ID: "EQUIPEFACT",
  APPLE_KEY_ID: "CLEFACTICE",
  APPLE_PRIVATE_KEY: generateKeyPairSync("ec", { namedCurve: "P-256" })
    .privateKey.export({ type: "pkcs8", format: "pem" })
    .toString(),
};
// L'app iOS : son bundle reçoit le code d'autorisation, et c'est lui qui révoque le jeton obtenu.
const APPLE_NATIVE = { ...APPLE, APPLE_APP_BUNDLE_IDENTIFIER: "coach.tartan.app.factice" };
const SOCIAL_KEYS = [...Object.keys(GOOGLE), ...Object.keys(APPLE_NATIVE)];

// La configuration se lit au chargement du module : chaque cas recharge l'application avec ses variables.
const load = async (variables: Record<string, string>) => {
  for (const key of SOCIAL_KEYS) vi.stubEnv(key, variables[key] ?? "");
  vi.resetModules();
  const { auth, enabledSocialProviders } = await import("@/lib/auth");
  return { auth, enabledSocialProviders };
};
type Auth = Awaited<ReturnType<typeof load>>["auth"];

const network = vi.fn<typeof fetch>();
const urlOf = (input: Parameters<typeof fetch>[0]) => (input instanceof Request ? input.url : String(input));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  network.mockReset();
});

const cookiesOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0]!)
    .join("; ");

const start = async (auth: Auth, provider: "google" | "apple") => {
  const response = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ provider, callbackURL: "/accueil" }),
    }),
  );
  const body = (await response.json().catch(() => ({}))) as { url?: string };
  return { status: response.status, url: body.url ? new URL(body.url) : null, cookie: cookiesOf(response) };
};

type GoogleProfile = { sub: string; email: string; email_verified: boolean; name?: string };

// Ce que Google renvoie en échange du code : un jeton d'identité que le serveur lit sur une liaison de confiance.
const googleAnswers = async (profile: GoogleProfile) => {
  const idToken = await new SignJWT({ ...profile, aud: GOOGLE.GOOGLE_CLIENT_ID, iss: "https://accounts.google.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode("secret-de-signature-factice-pour-les-tests"));
  network.mockImplementation(async (input) => {
    const url = urlOf(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return Response.json({
        access_token: "jeton-acces-factice",
        refresh_token: "jeton-rafraichissement-factice",
        id_token: idToken,
        token_type: "Bearer",
        expires_in: 3600,
        scope: "openid email profile",
      });
    }
    throw new Error(`Appel réseau inattendu : ${url}`);
  });
  vi.stubGlobal("fetch", network);
};

// Le parcours complet : départ depuis le formulaire, retour de Google avec un code.
const signInWithGoogle = async (auth: Auth, profile: GoogleProfile) => {
  await googleAnswers(profile);
  const started = await start(auth, "google");
  const state = started.url!.searchParams.get("state")!;
  const back = await auth.handler(
    new Request(`${ORIGIN}/api/auth/callback/google?code=code-factice&state=${encodeURIComponent(state)}`, {
      headers: { cookie: started.cookie },
    }),
  );
  const cookie = cookiesOf(back);
  const session = cookie.includes("session_token=")
    ? await auth.api.getSession({ headers: new Headers({ cookie }) })
    : null;
  return { status: back.status, location: back.headers.get("location") ?? "", session };
};

const profileFor = (email: string, overrides: Partial<GoogleProfile> = {}): GoogleProfile => ({
  sub: `google-${randomUUID()}`,
  email,
  email_verified: true,
  name: "Camille Durand",
  ...overrides,
});

describe("activation par variables", () => {
  it("sans variable, aucun bouton et aucun départ possible", async () => {
    const { auth, enabledSocialProviders } = await load({});
    expect(enabledSocialProviders).toEqual([]);
    for (const provider of ["google", "apple"] as const) {
      const started = await start(auth, provider);
      expect(started.status, provider).toBe(404);
      expect(started.url).toBeNull();
    }
  });

  it("Google demande son identifiant et son secret, Apple ses quatre variables", async () => {
    expect((await load({ GOOGLE_CLIENT_ID: GOOGLE.GOOGLE_CLIENT_ID })).enabledSocialProviders).toEqual([]);
    expect((await load({ GOOGLE_CLIENT_SECRET: GOOGLE.GOOGLE_CLIENT_SECRET })).enabledSocialProviders).toEqual([]);
    expect((await load(GOOGLE)).enabledSocialProviders).toEqual(["google"]);

    const { APPLE_KEY_ID: _keyId, ...withoutKeyId } = APPLE;
    expect((await load(withoutKeyId)).enabledSocialProviders).toEqual([]);
    expect((await load(APPLE)).enabledSocialProviders).toEqual(["apple"]);
    expect((await load({ ...GOOGLE, ...APPLE })).enabledSocialProviders).toEqual(["google", "apple"]);
  });

  it("le départ vers Google porte notre identifiant, notre adresse de retour et le choix du compte", async () => {
    const { auth } = await load(GOOGLE);
    const started = await start(auth, "google");
    expect(started.status).toBe(200);
    const url = started.url!;
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe(GOOGLE.GOOGLE_CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/callback/google`);
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.get("scope")?.split(" ").sort()).toEqual(["email", "openid", "profile"]);
    // Le secret ne part jamais dans l'adresse.
    expect(url.toString()).not.toContain(GOOGLE.GOOGLE_CLIENT_SECRET);
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    // Apple reste fermé tant que ses variables manquent.
    expect((await start(auth, "apple")).status).toBe(404);
  });

  it("le départ vers Apple porte notre identifiant, et le secret est signé pour notre équipe", async () => {
    const { auth } = await load(APPLE);
    const started = await start(auth, "apple");
    expect(started.status).toBe(200);
    const url = started.url!;
    expect(url.origin + url.pathname).toBe("https://appleid.apple.com/auth/authorize");
    expect(url.searchParams.get("client_id")).toBe(APPLE.APPLE_CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/callback/apple`);
    expect(url.searchParams.get("response_mode")).toBe("form_post");

    const { appleClientSecret } = await import("@/lib/apple");
    const secret = await appleClientSecret();
    expect(decodeProtectedHeader(secret)).toMatchObject({ alg: "ES256", kid: APPLE.APPLE_KEY_ID });
    const claims = decodeJwt(secret);
    expect(claims).toMatchObject({
      iss: APPLE.APPLE_TEAM_ID,
      sub: APPLE.APPLE_CLIENT_ID,
      aud: "https://appleid.apple.com",
    });
    // Apple refuse un secret valable plus de six mois.
    expect(claims.exp! - claims.iat!).toBeLessThanOrEqual(180 * 86_400);
    expect(url.toString()).not.toContain(secret);
  });
});

describe("liaison de comptes : une adresse, un seul compte", () => {
  it("une première connexion Google crée le compte, vérifié, avec prénom et nom", async () => {
    const { auth } = await load(GOOGLE);
    const email = `nouveau-${randomUUID()}@test.tartan.coach`;
    const result = await signInWithGoogle(auth, profileFor(email));
    expect(result.status).toBe(302);
    expect(result.location).toContain("/accueil");
    expect(result.session?.user).toMatchObject({ email, emailVerified: true });

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { accounts: true, profile: true },
    });
    expect(user.accounts.map((account) => account.providerId)).toEqual(["google"]);
    expect(user.profile).toMatchObject({ firstName: "Camille", lastName: "Durand" });
  });

  it("revenir avec Google retrouve le même compte, sans doublon", async () => {
    const { auth } = await load(GOOGLE);
    const profile = profileFor(`retour-${randomUUID()}@test.tartan.coach`);
    const first = await signInWithGoogle(auth, profile);
    const second = await signInWithGoogle(auth, profile);
    expect(second.session?.user.id).toBe(first.session?.user.id);
    expect(await prisma.user.count({ where: { email: profile.email } })).toBe(1);
    expect(await prisma.account.count({ where: { userId: first.session!.user.id } })).toBe(1);
  });

  it("un compte déjà vérifié par e-mail est rejoint par Google, pas dédoublé", async () => {
    const { auth } = await load(GOOGLE);
    const existing = await makeUser("Existant");
    // Google rend parfois l'adresse avec des majuscules : c'est la même personne.
    const result = await signInWithGoogle(auth, profileFor(existing.email.toUpperCase()));
    expect(result.status).toBe(302);
    expect(result.session?.user.id).toBe(existing.userId);
    expect(await prisma.user.count({ where: { email: existing.email } })).toBe(1);
    const accounts = await prisma.account.findMany({ where: { userId: existing.userId } });
    expect(accounts.map((account) => account.providerId)).toEqual(["google"]);
    // Le prénom saisi dans Tartan n'est pas écrasé par celui de Google.
    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: existing.userId } });
    expect(profile.firstName).toBe("Existant");
  });

  it("un compte jamais vérifié n'est pas rejoint : sinon, qui l'a créé garderait la main dessus", async () => {
    const { auth } = await load(GOOGLE);
    const email = `piege-${randomUUID()}@test.tartan.coach`;
    // Quelqu'un a ouvert un compte au mot de passe avec l'adresse d'un autre, sans jamais la confirmer.
    const signUp = await auth.handler(
      new Request(`${ORIGIN}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ email, password: "mot-de-passe-du-squatteur", name: "Squatteur" }),
      }),
    );
    expect(signUp.status).toBe(200);
    const squatted = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(squatted.emailVerified).toBe(false);

    const result = await signInWithGoogle(auth, profileFor(email));
    expect(result.session).toBeNull();
    expect(result.location).toContain("error=");
    expect(await prisma.account.count({ where: { userId: squatted.id, providerId: "google" } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: squatted.id } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { email } })).emailVerified).toBe(false);
  });

  it("un compte suspendu n'ouvre pas de session par Google", async () => {
    const { auth } = await load(GOOGLE);
    const suspended = await makeUser("SuspenduSocial");
    await prisma.user.update({ where: { id: suspended.userId }, data: { suspendedAt: new Date() } });
    const result = await signInWithGoogle(auth, profileFor(suspended.email));
    expect(result.session).toBeNull();
    expect(await prisma.session.count({ where: { userId: suspended.userId } })).toBe(0);
  });

  it("un retour de Google sans le départ correspondant est refusé", async () => {
    const { auth } = await load(GOOGLE);
    const email = `forge-${randomUUID()}@test.tartan.coach`;
    await googleAnswers(profileFor(email));
    const forged = await auth.handler(
      new Request(`${ORIGIN}/api/auth/callback/google?code=code-factice&state=etat-invente`),
    );
    expect(cookiesOf(forged)).not.toContain("session_token=");
    expect(await prisma.user.count({ where: { email } })).toBe(0);
    // Le code n'a même pas été échangé auprès de Google.
    expect(network).not.toHaveBeenCalled();
  });
});

describe("révocation Apple à la suppression du compte", () => {
  const appleAccount = async (refreshToken: string | null) => {
    const user = await makeUser("AvecApple");
    await prisma.account.create({
      data: { accountId: `apple-${randomUUID()}`, providerId: "apple", userId: user.userId, refreshToken },
    });
    return user;
  };
  const revocations = () =>
    network.mock.calls
      .filter(([input]) => urlOf(input) === "https://appleid.apple.com/auth/revoke")
      .map(([, init]) => Object.fromEntries(new URLSearchParams(String(init?.body))));

  it("révoque le jeton conservé, avec notre identifiant, puis efface le compte", async () => {
    await load(APPLE);
    const { deleteAccount } = await import("@/server/account.service");
    const user = await appleAccount("jeton-apple-conserve");
    network.mockImplementation(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", network);

    await deleteAccount(user.userId);
    const [sent] = revocations();
    expect(sent).toMatchObject({
      client_id: APPLE.APPLE_CLIENT_ID,
      token: "jeton-apple-conserve",
      token_type_hint: "refresh_token",
    });
    expect(decodeJwt(sent!.client_secret!)).toMatchObject({ iss: APPLE.APPLE_TEAM_ID, sub: APPLE.APPLE_CLIENT_ID });
    expect(await prisma.user.count({ where: { id: user.userId } })).toBe(0);
  });

  it("une panne d'Apple est retentée trois fois, sans jamais empêcher la suppression", async () => {
    await load(APPLE);
    const { deleteAccount } = await import("@/server/account.service");
    const user = await appleAccount("jeton-apple-en-panne");
    network.mockImplementation(async () => new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", network);

    await deleteAccount(user.userId);
    expect(revocations()).toHaveLength(3);
    expect(await prisma.user.count({ where: { id: user.userId } })).toBe(0);
  });

  it("sans jeton conservé, rien n'est révoqué, et la suppression a lieu", async () => {
    await load(APPLE);
    const { deleteAccount } = await import("@/server/account.service");
    const user = await appleAccount(null);
    network.mockImplementation(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", network);

    await deleteAccount(user.userId);
    expect(revocations()).toEqual([]);
    expect(await prisma.user.count({ where: { id: user.userId } })).toBe(0);
  });
});

describe("code d'autorisation de l'app iOS (M6)", () => {
  // Le jeton d'identité que renvoie Apple : seul son sujet compte ici.
  const idToken = (subject: string) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(subject)
      .sign(new TextEncoder().encode("cle-factice-de-test-apple"));
  const sentTo = (path: string) =>
    network.mock.calls
      .filter(([input]) => urlOf(input) === `https://appleid.apple.com${path}`)
      .map(([, init]) => Object.fromEntries(new URLSearchParams(String(init?.body))));
  const linked = async () => {
    const user = await makeUser("AppleNatif");
    const subject = `apple-${randomUUID()}`;
    await prisma.account.create({ data: { accountId: subject, providerId: "apple", userId: user.userId } });
    return { ...user, subject };
  };
  const apple = (subject: string) =>
    network.mockImplementation(async (input) =>
      urlOf(input).endsWith("/auth/token")
        ? Response.json({ refresh_token: "jeton-de-l-app", id_token: await idToken(subject) })
        : new Response(null, { status: 200 }),
    );

  it("échange le code pour le bundle de l'app, garde le jeton, et la suppression le révoque avec le même", async () => {
    await load(APPLE_NATIVE);
    const { storeAppleAuthorization } = await import("@/server/apple-authorization.service");
    const { deleteAccount } = await import("@/server/account.service");
    const user = await linked();
    apple(user.subject);
    vi.stubGlobal("fetch", network);

    await expect(storeAppleAuthorization(user.userId, { code: "code-de-l-app" })).resolves.toEqual({ stored: true });
    const [exchange] = sentTo("/auth/token");
    expect(exchange).toMatchObject({
      client_id: APPLE_NATIVE.APPLE_APP_BUNDLE_IDENTIFIER,
      code: "code-de-l-app",
      grant_type: "authorization_code",
    });
    expect(decodeJwt(exchange!.client_secret!).sub).toBe(APPLE_NATIVE.APPLE_APP_BUNDLE_IDENTIFIER);

    await deleteAccount(user.userId);
    expect(sentTo("/auth/revoke")).toEqual([
      expect.objectContaining({ client_id: APPLE_NATIVE.APPLE_APP_BUNDLE_IDENTIFIER, token: "jeton-de-l-app" }),
    ]);
  });

  it("refuse le code d'un autre compte Apple, un compte sans liaison Apple, et une configuration absente", async () => {
    await load(APPLE_NATIVE);
    const { storeAppleAuthorization } = await import("@/server/apple-authorization.service");
    const user = await linked();
    apple("un-autre-compte-apple");
    vi.stubGlobal("fetch", network);
    await expect(storeAppleAuthorization(user.userId, { code: "code" })).rejects.toMatchObject({ status: 403 });
    expect((await prisma.account.findFirstOrThrow({ where: { userId: user.userId } })).refreshToken).toBeNull();

    const alone = await makeUser("SansApple");
    await expect(storeAppleAuthorization(alone.userId, { code: "code" })).rejects.toMatchObject({ status: 409 });

    await load(APPLE);
    const { storeAppleAuthorization: webOnly } = await import("@/server/apple-authorization.service");
    await expect(webOnly(user.userId, { code: "code" })).rejects.toMatchObject({ status: 404 });
  });

  it("une panne d'Apple répond 502 sans rien garder", async () => {
    await load(APPLE_NATIVE);
    const { storeAppleAuthorization } = await import("@/server/apple-authorization.service");
    const user = await linked();
    network.mockImplementation(async () => new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", network);
    await expect(storeAppleAuthorization(user.userId, { code: "code" })).rejects.toMatchObject({ status: 502 });
    expect((await prisma.account.findFirstOrThrow({ where: { userId: user.userId } })).refreshToken).toBeNull();
  });
});
