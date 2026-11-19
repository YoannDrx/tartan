import type {
  ChangePasswordInput,
  SetPasswordInput,
  SetPasswordResponse,
  SignInMethodsResponse,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { PasswordChangedEmail } from "@email/auth";
import { PasswordSetEmail } from "@email/credentials";
import { APIError } from "better-auth/api";
import { createElement } from "react";
import { PASSWORD_SETUP_PURPOSE, auth, enabledSocialProviders } from "@/lib/auth";
import { env } from "@/lib/env";
import { AppError, invalid } from "@/lib/errors";
import { log } from "@/lib/logger";
import { sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { Actor } from "@/lib/session";

// Les moyens de connexion d'un compte : leur état, définir un mot de passe, le changer.
// Rien ici ne lit de donnée d'espace : seuls le compte de l'acteur et ses propres sessions sont touchés.
// Le mot de passe ne sort jamais de ce service : ni dans un journal, ni dans une réponse.

// Définir un mot de passe donne un accès durable au compte : la session doit venir d'une connexion récente.
// Au-delà, un lien de confirmation part par e-mail et rouvre une session fraîche.
export const PASSWORD_SETUP_FRESH_SECONDS = 60 * 60;
// Où revient la personne après avoir confirmé par e-mail : la rubrique Connexion, formulaire ouvert.
export const PASSWORD_SETUP_RETURN = "/reglages/connexion?definir=1";
const PASSWORD_SETUP_EXPIRED = "/reglages/connexion?lien=expire";

// Cinq essais par dix minutes et par compte : assez pour une faute de frappe, trop peu pour deviner.
const ATTEMPTS = 5;
const ATTEMPTS_WINDOW_SECONDS = 600;

// Le refus dit combien de temps attendre : le message général du limiteur parle de demandes « en cours ».
const limitAttempts = async (key: string): Promise<void> => {
  try {
    await enforceRateLimit(key, ATTEMPTS, ATTEMPTS_WINDOW_SECONDS);
  } catch (error) {
    if (error instanceof AppError && error.status === 429) {
      throw new AppError(429, error.code, w.auth.errors.tooManyAttempts);
    }
    throw error;
  }
};

// Compté en base : le hachage n'est jamais chargé pour répondre à cette question.
const hasPassword = async (userId: string): Promise<boolean> =>
  (await prisma.account.count({ where: { userId, providerId: "credential", password: { not: null } } })) > 0;

const sessionIsRecent = async (actor: Actor): Promise<boolean> => {
  if (!actor.sessionId) return false;
  const session = await prisma.session.findUnique({ where: { id: actor.sessionId }, select: { createdAt: true } });
  return Boolean(session && Date.now() - session.createdAt.getTime() < PASSWORD_SETUP_FRESH_SECONDS * 1000);
};

export const getSignInMethods = async (actor: Actor): Promise<SignInMethodsResponse> => {
  const [password, providers, profile, recent] = await Promise.all([
    hasPassword(actor.userId),
    prisma.account.findMany({
      where: { userId: actor.userId, providerId: { in: ["google", "apple"] } },
      select: { providerId: true },
    }),
    prisma.profile.findUnique({ where: { id: actor.userId }, select: { passwordPromptDismissedAt: true } }),
    sessionIsRecent(actor),
  ]);
  const linked = new Set(providers.map((account) => account.providerId));
  return {
    email: actor.email,
    magicLink: true,
    password,
    canSetPasswordNow: !password && recent,
    google: { available: enabledSocialProviders.includes("google"), linked: linked.has("google") },
    apple: { available: enabledSocialProviders.includes("apple"), linked: linked.has("apple") },
    // Qui entre déjà par Google ou Apple n'a pas besoin qu'on lui propose un mot de passe.
    passwordPrompt: !password && linked.size === 0 && !profile?.passwordPromptDismissedAt,
  };
};

// Une alerte qui échoue ne doit pas annuler un mot de passe déjà enregistré.
const notify = async (kind: "password_set" | "password_changed", to: string): Promise<void> => {
  const url = `${env().NEXT_PUBLIC_APP_URL}/mot-de-passe-oublie`;
  await sendEmail(
    kind === "password_set"
      ? { kind, to, subject: w.auth.emails.passwordSet.subject, react: createElement(PasswordSetEmail, { url }) }
      : { kind, to, subject: m.email.passwordChanged.subject, react: createElement(PasswordChangedEmail, { url }) },
  ).catch(() => log.warn(`${kind}_email_failed`));
};

const sendSetupConfirmation = async (actor: Actor, requestHeaders: Headers): Promise<void> => {
  await auth.api.signInMagicLink({
    body: {
      email: actor.email,
      callbackURL: PASSWORD_SETUP_RETURN,
      errorCallbackURL: PASSWORD_SETUP_EXPIRED,
      metadata: { purpose: PASSWORD_SETUP_PURPOSE },
    },
    headers: requestHeaders,
  });
};

// Session ancienne : la personne demande le lien qui prouvera que la boîte mail est bien à elle.
export const requestPasswordSetupConfirmation = async (actor: Actor, requestHeaders: Headers): Promise<void> => {
  await limitAttempts(`password-set:${actor.userId}`);
  if (await hasPassword(actor.userId)) {
    throw new AppError(409, "password_already_set", w.auth.errors.passwordAlreadySet);
  }
  await sendSetupConfirmation(actor, requestHeaders);
};

// Le compte n'a pas de mot de passe : il en reçoit un si la session est récente, sinon un lien de confirmation part
// et le mot de passe reçu est oublié.
export const definePassword = async (
  actor: Actor,
  input: SetPasswordInput,
  requestHeaders: Headers,
): Promise<SetPasswordResponse> => {
  await limitAttempts(`password-set:${actor.userId}`);
  if (await hasPassword(actor.userId)) {
    throw new AppError(409, "password_already_set", w.auth.errors.passwordAlreadySet);
  }
  if (!(await sessionIsRecent(actor))) {
    await sendSetupConfirmation(actor, requestHeaders);
    return { status: "confirmation_sent" };
  }
  await auth.api.setPassword({ body: { newPassword: input.newPassword }, headers: requestHeaders });
  await notify("password_set", actor.email);
  return { status: "set" };
};

export const changePassword = async (
  actor: Actor,
  input: ChangePasswordInput,
  requestHeaders: Headers,
): Promise<void> => {
  // Compté avant toute vérification : un mauvais mot de passe actuel consomme un essai.
  await limitAttempts(`password-change:${actor.userId}`);
  if (!(await hasPassword(actor.userId))) throw new AppError(409, "no_password", w.auth.errors.noPassword);
  if (input.newPassword === input.currentPassword) throw invalid(w.auth.errors.sameAsCurrent);
  try {
    await auth.api.changePassword({
      body: { currentPassword: input.currentPassword, newPassword: input.newPassword, revokeOtherSessions: false },
      headers: requestHeaders,
    });
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "INVALID_PASSWORD") {
      throw new AppError(400, "invalid_current_password", w.auth.errors.wrongCurrent);
    }
    throw error;
  }
  // La session en cours est gardée telle quelle : ni le web ni le mobile n'ont de jeton à remplacer.
  if (input.revokeOtherSessions) await auth.api.revokeOtherSessions({ headers: requestHeaders });
  await notify("password_changed", actor.email);
};

// La proposition de l'accueil, refermée pour de bon : elle ne revient sur aucun appareil.
export const dismissPasswordPrompt = async (userId: string): Promise<void> => {
  const passwordPromptDismissedAt = new Date();
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, passwordPromptDismissedAt },
    update: { passwordPromptDismissedAt },
  });
};
