import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { MagicLinkEmail, ResetPasswordEmail } from "@email/auth";
import { appleClientSecret } from "./apple";
import { env } from "./env";
import { sendEmail } from "./mail";
import { prisma } from "./prisma";

const e = env();

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

const splitName = (name: string | null | undefined): { firstName: string | null; lastName: string | null } => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? null, lastName: parts.slice(1).join(" ") || null };
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
    // Session longue durée sur mobile (§ 6.2).
    expiresIn: 60 * 60 * 24 * 90,
    updateAge: 60 * 60 * 24,
  },
  account: {
    // Un même e-mail = un seul compte, quelles que soient les méthodes (§ 7.1).
    accountLinking: { enabled: true, trustedProviders: ["google", "apple", "email-password"] },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Réinitialise ton mot de passe Tartan",
        react: createElement(ResetPasswordEmail, { url }),
      });
    },
  },
  socialProviders,
  rateLimit: {
    enabled: process.env.NODE_ENV === "production" && process.env.E2E_DISABLE_RATE_LIMIT !== "true",
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/*": { window: 60, max: 10 },
      "/sign-up/*": { window: 60, max: 5 },
      "/magic-link/*": { window: 60, max: 5 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await prisma.profile.upsert({
            where: { id: user.id },
            create: { id: user.id, ...splitName(user.name) },
            update: {},
          });
        },
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 15,
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: "Ton lien de connexion Tartan",
          react: createElement(MagicLinkEmail, { url }),
        });
      },
    }),
    passkey({ rpName: "Tartan" }),
    expo(),
    nextCookies(),
  ],
});
