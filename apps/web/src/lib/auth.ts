import { log } from "./logger";
import { m } from "@tartan/i18n";
import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { MagicLinkEmail, VerifyEmail, ResetPasswordEmail, PasswordChangedEmail } from "@email/auth";
import { AccountExistsEmail, ConfirmPasswordSetupEmail } from "@email/credentials";
import { w } from "@tartan/i18n/web";
import { appleClientSecret } from "./apple";
import { authRateLimit, rateLimitEnabled } from "./auth-rate-limit";
import { env } from "./env";
import { sendEmail } from "./mail";
import { EmailSuppressedError } from "@/server/email-suppression.service";
import { prisma } from "./prisma";

const e = env();

const isAdminEmail = async (email: string) => {
  const normalized = email.trim().toLowerCase();
  if (
    e.ADMIN_EMAILS.split(",")
      .map((value) => value.trim().toLowerCase())
      .includes(normalized)
  ) {
    return true;
  }
  return Boolean(await prisma.platformAdmin.findUnique({ where: { email: normalized }, select: { email: true } }));
};

const socialProviders = {
  ...(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: e.GOOGLE_CLIENT_ID,
          clientSecret: e.GOOGLE_CLIENT_SECRET,
          prompt: "select_account" as const,
        },
      }
    : {}),
  ...(e.APPLE_CLIENT_ID && e.APPLE_TEAM_ID && e.APPLE_KEY_ID && e.APPLE_PRIVATE_KEY
    ? {
        apple: {
          clientId: e.APPLE_CLIENT_ID,
          clientSecret: await appleClientSecret(),
          appBundleIdentifier: e.APPLE_APP_BUNDLE_IDENTIFIER,
        },
      }
    : {}),
};

export const enabledSocialProviders = Object.keys(socialProviders) as ("google" | "apple")[];

// Ce que porte le lien de confirmation demandé avant de définir un mot de passe (credentials.service.ts) :
// il choisit l'e-mail, rien d'autre. Le lien ouvre une session comme tout lien de connexion.
export const PASSWORD_SETUP_PURPOSE = "password_setup";

// L'inscription par mot de passe remplit `name` avec le début de l'adresse (better-auth l'exige) : ce n'est pas un prénom.
const splitName = (
  name: string | null | undefined,
  email: string,
): { firstName: string | null; lastName: string | null } => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1 && parts[0] === email.split("@")[0]) return { firstName: null, lastName: null };
  return { firstName: parts[0] ?? null, lastName: parts.slice(1).join(" ") || null };
};

// Une adresse qui rebondit ne recevra jamais le lien : le dire vaut mieux qu'une erreur muette.
const sendAuthEmail = async (input: Parameters<typeof sendEmail>[0]): Promise<void> => {
  try {
    await sendEmail(input);
  } catch (error) {
    if (!(error instanceof EmailSuppressedError)) throw error;
    throw new APIError("UNPROCESSABLE_ENTITY", { message: m.auth.emailUnreachable, code: "EMAIL_UNREACHABLE" });
  }
};

export { rateLimitEnabled };

// Le formulaire d'une invitation pose la page d'où part l'inscription : l'e-mail `account_exists` y ramène.
export const RETURN_HEADER = "x-tartan-return";
const INVITATION_PATH = /^\/i\/[A-Za-z0-9._-]{16,200}$/;

// Seul un chemin d'invitation est repris de l'en-tête. Sans lui, une invitation nominative encore ouverte à cette
// adresse en tient lieu : c'est elle que la personne cherchait à accepter.
const invitationReturnPath = async (email: string, header: string | null): Promise<string | null> => {
  if (header && INVITATION_PATH.test(header)) return header;
  const { openInvitationPathFor } = await import("@/server/invitation-email");
  return openInvitationPathFor(email);
};

export const auth = betterAuth({
  baseURL: e.BETTER_AUTH_URL,
  secret: e.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  advanced: { database: { generateId: () => randomUUID() } },
  trustedOrigins: [
    e.NEXT_PUBLIC_APP_URL,
    "https://tartan.coach",
    "https://app.tartan.coach",
    "tartan://",
    "tartan-dev://",
    "https://appleid.apple.com",
    ...(process.env.NODE_ENV === "development" ? ["exp://"] : []),
  ],
  session: {
    // Session glissante : un usage régulier ne redemande jamais la connexion.
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  account: {
    // Un même e-mail = un seul compte, quelles que soient les méthodes (§ 7.1).
    accountLinking: { enabled: true, trustedProviders: ["google", "apple", "email-password"] },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({
        kind: "verify",
        to: user.email,
        subject: m.email.subjects.verify,
        react: createElement(VerifyEmail, { url }),
      });
    },
  },
  emailAndPassword: {
    enabled: true,
    // Une adresse non prouvée n'ouvre aucun droit : ni session, ni espace du pilote.
    requireEmailVerification: true,
    minPasswordLength: 10,
    // Un mot de passe réinitialisé coupe tout accès pris avec l'ancien.
    revokeSessionsOnPasswordReset: true,
    // Création demandée sur une adresse déjà inscrite : l'écran répond comme pour un nouveau compte, pour ne pas
    // révéler qu'il existe. Cet e-mail dit la vérité à la seule personne qui lit la boîte ; le mot de passe saisi
    // n'est pas enregistré.
    // Une inscription lancée depuis une invitation y ramène : le lien se connecte puis rouvre l'invitation.
    onExistingUserSignUp: async ({ user }, request) => {
      const invitation = await invitationReturnPath(user.email, request?.headers.get(RETURN_HEADER) ?? null);
      const url = invitation
        ? `${e.NEXT_PUBLIC_APP_URL}/connexion?next=${encodeURIComponent(invitation)}`
        : `${e.NEXT_PUBLIC_APP_URL}/connexion`;
      await sendEmail({
        kind: "account_exists",
        to: user.email,
        subject: w.auth.emails.accountExists.subject,
        react: createElement(AccountExistsEmail, { url, invitation: Boolean(invitation) }),
      }).catch(() => log.warn("account_exists_email_failed"));
    },
    onPasswordReset: async ({ user }) => {
      // Une alerte qui échoue ne doit pas annuler le nouveau mot de passe.
      await sendEmail({
        kind: "password_changed",
        to: user.email,
        subject: m.email.passwordChanged.subject,
        react: createElement(PasswordChangedEmail, { url: `${e.NEXT_PUBLIC_APP_URL}/mot-de-passe-oublie` }),
      }).catch(() => log.warn("password_changed_email_failed"));
    },
    sendResetPassword: async ({ user, url }) => {
      // La demande répond toujours la même chose, compte existant ou non : une adresse qui rebondit
      // ne doit pas révéler qu'un compte existe.
      await sendEmail({
        kind: "reset_password",
        to: user.email,
        subject: m.email.subjects.resetPassword,
        react: createElement(ResetPasswordEmail, { url }),
      }).catch((error: unknown) => {
        if (!(error instanceof EmailSuppressedError)) throw error;
        log.warn("reset_password_email_unreachable");
      });
    },
  },
  socialProviders,
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/passkey/generate-register-options") return;
      const session = await getSessionFromCtx(ctx);
      if (!session || !(await isAdminEmail(session.user.email))) return;
      // Un accès à la boîte mail ne doit pas suffire à enrôler une clé sur le compte administrateur.
      const existing = await prisma.passkey.count({ where: { userId: session.user.id } });
      const stepUp = await prisma.adminStepUp.findUnique({ where: { sessionId: session.session.id } });
      const bootstrap = ctx.headers?.get("x-admin-bootstrap");
      const invited = await prisma.platformAdmin.findUnique({
        where: { email: session.user.email.trim().toLowerCase() },
        select: { enrollUntil: true },
      });
      const allowed =
        (existing > 0 && stepUp !== null && Date.now() - stepUp.verifiedAt.getTime() < 600_000) ||
        (existing === 0 && Boolean(e.ADMIN_BOOTSTRAP_TOKEN) && bootstrap === e.ADMIN_BOOTSTRAP_TOKEN) ||
        (existing === 0 && Boolean(invited?.enrollUntil && invited.enrollUntil > new Date()));
      if (!allowed) throw new APIError("FORBIDDEN", { message: m.admin.stepUpRequired });
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/passkey/verify-authentication") return;
      const created = ctx.context.newSession;
      if (created && (await isAdminEmail(created.user.email))) {
        await prisma.adminStepUp.upsert({
          where: { sessionId: created.session.id },
          create: { sessionId: created.session.id, method: "passkey", verifiedAt: new Date() },
          update: { verifiedAt: new Date() },
        });
      }
    }),
  },
  rateLimit: authRateLimit(),
  databaseHooks: {
    session: {
      // La date d'activité décide de la suppression d'un compte inactif, et lever le préavis en découle.
      create: {
        // Une suspension empêche toute nouvelle session, quel que soit le moyen de connexion.
        before: async (session) => {
          const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { suspendedAt: true } });
          return user?.suspendedAt ? false : undefined;
        },
        after: async (session) => {
          await prisma.profile.updateMany({
            where: { id: session.userId },
            data: { lastActiveAt: new Date(), inactivityNoticeAt: null },
          });
        },
      },
      update: {
        after: async (session) => {
          await prisma.profile.updateMany({
            where: { id: session.userId },
            data: { lastActiveAt: new Date(), inactivityNoticeAt: null },
          });
        },
      },
    },
    user: {
      create: {
        after: async (user) => {
          await prisma.profile.upsert({
            where: { id: user.id },
            create: { id: user.id, ...splitName(user.name, user.email) },
            update: {},
          });
        },
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 15,
      storeToken: "hashed",
      sendMagicLink: async ({ email, url, metadata }) => {
        // Même lien, autre message : la personne a demandé à définir un mot de passe depuis une session ancienne.
        const confirming = metadata?.purpose === PASSWORD_SETUP_PURPOSE;
        await sendAuthEmail(
          confirming
            ? {
                kind: "password_setup_confirm",
                to: email,
                subject: w.auth.emails.confirmSetup.subject,
                react: createElement(ConfirmPasswordSetupEmail, { url }),
              }
            : {
                kind: "magic_link",
                to: email,
                subject: m.email.subjects.magicLink,
                react: createElement(MagicLinkEmail, { url }),
              },
        );
      },
    }),
    passkey({ rpName: "Tartan", ...(e.PASSKEY_RP_ID ? { rpID: e.PASSKEY_RP_ID } : {}) }),
    expo(),
    nextCookies(),
  ],
});
