import { describe, expect, it } from "vitest";
import { w } from "@tartan/i18n/web";
import { m } from "@tartan/i18n";
import { auth } from "@/lib/auth";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { getActorFrom } from "@/lib/session";
import {
  PASSWORD_SETUP_FRESH_SECONDS,
  changePassword,
  definePassword,
  dismissPasswordPrompt,
  getSignInMethods,
  requestPasswordSetupConfirmation,
} from "@/server/credentials.service";
import { makeUser } from "./helpers";
import { sessionCookie } from "./personas";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "un-mot-de-passe-solide";
const OTHER = "un-autre-mot-de-passe";

const post = (path: string, body: unknown) =>
  auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: ORIGIN },
      body: JSON.stringify(body),
    }),
  );

// Un compte entré par un lien, avec une vraie session : aucun mot de passe.
const signedIn = async (name: string) => {
  const user = await makeUser(name);
  const headers = new Headers({ cookie: await sessionCookie(user.email), origin: ORIGIN });
  const actor = (await getActorFrom(headers))!;
  return { ...user, headers, actor };
};

const credential = (userId: string) =>
  prisma.account.findFirst({ where: { userId, providerId: "credential" }, select: { password: true } });

const mailsTo = (email: string) => outbox.filter((mail) => mail.to === email);

const ageSession = (sessionId: string) =>
  prisma.session.update({
    where: { id: sessionId },
    data: { createdAt: new Date(Date.now() - (PASSWORD_SETUP_FRESH_SECONDS + 60) * 1000) },
  });

describe("moyens de connexion du compte", () => {
  it("un compte entré par un lien n'a pas de mot de passe, et l'accueil peut lui en proposer un", async () => {
    const user = await signedIn("Lien");
    expect(await getSignInMethods(user.actor)).toEqual({
      email: user.email,
      magicLink: true,
      password: false,
      canSetPasswordNow: true,
      google: { available: false, linked: false },
      apple: { available: false, linked: false },
      passwordPrompt: true,
    });
  });

  it("la proposition refermée le reste, quel que soit l'appareil", async () => {
    const user = await signedIn("Referme");
    await dismissPasswordPrompt(user.userId);
    // Une autre session du même compte : un autre appareil.
    const elsewhere = new Headers({ cookie: await sessionCookie(user.email), origin: ORIGIN });
    const methods = await getSignInMethods((await getActorFrom(elsewhere))!);
    expect(methods.passwordPrompt).toBe(false);
    expect(methods.password).toBe(false);
  });

  it("qui entre déjà par Google ne se voit pas proposer de mot de passe", async () => {
    const user = await signedIn("Google");
    await prisma.account.create({ data: { userId: user.userId, providerId: "google", accountId: "google-test" } });
    const methods = await getSignInMethods(user.actor);
    expect(methods.google.linked).toBe(true);
    expect(methods.passwordPrompt).toBe(false);
  });
});

describe("définir un mot de passe", () => {
  it("session récente : le mot de passe est enregistré, il ouvre le compte, et un e-mail prévient", async () => {
    const user = await signedIn("Definir");
    expect(await definePassword(user.actor, { newPassword: PASSWORD }, user.headers)).toEqual({ status: "set" });
    const stored = await credential(user.userId);
    expect(stored?.password).toBeTruthy();
    // Jamais en clair.
    expect(stored?.password).not.toContain(PASSWORD);
    expect((await post("/sign-in/email", { email: user.email, password: PASSWORD })).status).toBe(200);
    expect(mailsTo(user.email).some((mail) => mail.subject === w.auth.emails.passwordSet.subject)).toBe(true);
    const methods = await getSignInMethods(user.actor);
    expect(methods).toMatchObject({ password: true, passwordPrompt: false, canSetPasswordNow: false });
  });

  it("le mot de passe n'apparaît dans aucun e-mail", async () => {
    const user = await signedIn("Discret");
    await definePassword(user.actor, { newPassword: PASSWORD }, user.headers);
    for (const mail of mailsTo(user.email)) {
      expect(mail.html).not.toContain(PASSWORD);
      expect(mail.text).not.toContain(PASSWORD);
    }
  });

  it("session ancienne : rien n'est enregistré, un lien de confirmation part et rouvre une session fraîche", async () => {
    const user = await signedIn("Ancienne");
    await ageSession(user.actor.sessionId!);
    expect((await getSignInMethods(user.actor)).canSetPasswordNow).toBe(false);
    expect(await definePassword(user.actor, { newPassword: PASSWORD }, user.headers)).toEqual({
      status: "confirmation_sent",
    });
    expect(await credential(user.userId)).toBeNull();
    const mail = mailsTo(user.email).at(-1)!;
    expect(mail.subject).toBe(w.auth.emails.confirmSetup.subject);
    const link = mail.html.match(/href="([^"]+magic-link[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
    expect(new URL(link!).searchParams.get("callbackURL")).toBe("/reglages/connexion?definir=1");
    // Le lien prouve la boîte mail : la session qu'il ouvre est récente, le mot de passe passe.
    const verified = await auth.handler(new Request(link!, { headers: { origin: ORIGIN } }));
    expect(verified.headers.get("location")).toContain("/reglages/connexion?definir=1");
    const cookie = verified.headers
      .getSetCookie()
      .map((entry) => entry.split(";")[0]!)
      .filter((entry) => entry.includes("session_token="))
      .join("; ");
    const fresh = new Headers({ cookie, origin: ORIGIN });
    expect(await definePassword((await getActorFrom(fresh))!, { newPassword: PASSWORD }, fresh)).toEqual({
      status: "set",
    });
  });

  it("la demande de confirmation seule envoie le même lien, sans mot de passe", async () => {
    const user = await signedIn("Demande");
    await ageSession(user.actor.sessionId!);
    await requestPasswordSetupConfirmation(user.actor, user.headers);
    expect(mailsTo(user.email).at(-1)?.subject).toBe(w.auth.emails.confirmSetup.subject);
    expect(await credential(user.userId)).toBeNull();
  });

  it("un compte qui a déjà un mot de passe ne peut pas en définir un autre sans l'actuel", async () => {
    const user = await signedIn("Deja");
    await definePassword(user.actor, { newPassword: PASSWORD }, user.headers);
    await expect(definePassword(user.actor, { newPassword: OTHER }, user.headers)).rejects.toMatchObject({
      status: 409,
      code: "password_already_set",
    });
    await expect(requestPasswordSetupConfirmation(user.actor, user.headers)).rejects.toMatchObject({ status: 409 });
    expect((await post("/sign-in/email", { email: user.email, password: OTHER })).status).toBe(401);
  });

  it("la limite de débit tient : cinq essais en dix minutes, le sixième est refusé", async () => {
    const user = await signedIn("LimiteDefinir");
    await ageSession(user.actor.sessionId!);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await requestPasswordSetupConfirmation(user.actor, user.headers);
    }
    await expect(requestPasswordSetupConfirmation(user.actor, user.headers)).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
    });
    await expect(definePassword(user.actor, { newPassword: PASSWORD }, user.headers)).rejects.toMatchObject({
      status: 429,
    });
  });
});

describe("changer le mot de passe", () => {
  const signedInWithCredential = async (name: string) => {
    const user = await signedIn(name);
    await definePassword(user.actor, { newPassword: PASSWORD }, user.headers);
    return user;
  };

  it("un mauvais mot de passe actuel est refusé et rien ne change", async () => {
    const user = await signedInWithCredential("Mauvais");
    await expect(
      changePassword(user.actor, { currentPassword: "pas-le-bon-mot-de-passe", newPassword: OTHER }, user.headers),
    ).rejects.toMatchObject({ status: 400, code: "invalid_current_password", message: w.auth.errors.wrongCurrent });
    expect((await post("/sign-in/email", { email: user.email, password: PASSWORD })).status).toBe(200);
    expect((await post("/sign-in/email", { email: user.email, password: OTHER })).status).toBe(401);
  });

  it("le bon mot de passe actuel change le mot de passe, garde les sessions, et un e-mail prévient", async () => {
    const user = await signedInWithCredential("Changer");
    const elsewhere = new Headers({ cookie: await sessionCookie(user.email), origin: ORIGIN });
    const before = mailsTo(user.email).length;
    await changePassword(user.actor, { currentPassword: PASSWORD, newPassword: OTHER }, user.headers);
    expect((await post("/sign-in/email", { email: user.email, password: OTHER })).status).toBe(200);
    expect((await post("/sign-in/email", { email: user.email, password: PASSWORD })).status).toBe(401);
    expect(
      mailsTo(user.email)
        .slice(before)
        .some((mail) => mail.subject === m.email.passwordChanged.subject),
    ).toBe(true);
    // Sans l'option, l'autre appareil reste connecté.
    expect(await getActorFrom(elsewhere)).not.toBeNull();
    expect(await getActorFrom(user.headers)).not.toBeNull();
  });

  it("l'option déconnecte les autres appareils et garde celui qui fait la demande", async () => {
    const user = await signedInWithCredential("Revoquer");
    const elsewhere = new Headers({ cookie: await sessionCookie(user.email), origin: ORIGIN });
    await changePassword(
      user.actor,
      { currentPassword: PASSWORD, newPassword: OTHER, revokeOtherSessions: true },
      user.headers,
    );
    expect(await getActorFrom(elsewhere)).toBeNull();
    expect((await getActorFrom(user.headers))?.sessionId).toBe(user.actor.sessionId);
  });

  it("le même mot de passe est refusé, et un compte sans mot de passe ne peut pas en changer", async () => {
    const user = await signedInWithCredential("Meme");
    await expect(
      changePassword(user.actor, { currentPassword: PASSWORD, newPassword: PASSWORD }, user.headers),
    ).rejects.toMatchObject({ status: 400, message: w.auth.errors.sameAsCurrent });
    const bare = await signedIn("SansMotDePasse");
    await expect(
      changePassword(bare.actor, { currentPassword: PASSWORD, newPassword: OTHER }, bare.headers),
    ).rejects.toMatchObject({ status: 409, code: "no_password" });
  });

  it("la limite de débit tient : le sixième essai est refusé, même avec le bon mot de passe", async () => {
    const user = await signedInWithCredential("LimiteChanger");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        changePassword(
          user.actor,
          { currentPassword: `faux-mot-de-passe-${attempt}`, newPassword: OTHER },
          user.headers,
        ),
      ).rejects.toMatchObject({ status: 400 });
    }
    await expect(
      changePassword(user.actor, { currentPassword: PASSWORD, newPassword: OTHER }, user.headers),
    ).rejects.toMatchObject({ status: 429, code: "rate_limited" });
    expect((await post("/sign-in/email", { email: user.email, password: PASSWORD })).status).toBe(200);
  });
});

describe("création de compte sur une adresse déjà inscrite", () => {
  it("la réponse est la même que pour une adresse neuve, et seul l'e-mail dit qu'un compte existe", async () => {
    const existing = await makeUser("Existant");
    const fresh = `neuf-${Date.now()}@test.tartan.coach`;
    const [known, unknown] = await Promise.all([
      post("/sign-up/email", { email: existing.email, password: PASSWORD, name: "x" }),
      post("/sign-up/email", { email: fresh, password: PASSWORD, name: "x" }),
    ]);
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    const shape = (body: { token: unknown; user: Record<string, unknown> }) => ({
      token: body.token,
      keys: Object.keys(body.user).sort(),
      emailVerified: body.user.emailVerified,
    });
    expect(shape(await known.json())).toEqual(shape(await unknown.json()));
    expect(mailsTo(existing.email).at(-1)?.subject).toBe(w.auth.emails.accountExists.subject);
    // Le mot de passe saisi par un inconnu n'est pas posé sur le compte existant.
    expect(await credential(existing.userId)).toBeNull();
  });

  it("une connexion par mot de passe sur une adresse inconnue répond comme un mauvais mot de passe", async () => {
    const existing = await signedIn("Connu");
    await definePassword(existing.actor, { newPassword: PASSWORD }, existing.headers);
    const wrong = await post("/sign-in/email", { email: existing.email, password: OTHER });
    const unknown = await post("/sign-in/email", { email: `inconnu-${Date.now()}@test.tartan.coach`, password: OTHER });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });
});
