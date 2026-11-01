import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  APPLE_CLIENT_ID: optional,
  APPLE_TEAM_ID: optional,
  APPLE_KEY_ID: optional,
  APPLE_PRIVATE_KEY: optional,
  APPLE_APP_BUNDLE_IDENTIFIER: optional,
  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().default("Tartan <tartan@yodev.fr>"),
  EMAIL_CONTACT: z.string().default("hello@tartan.coach"),
  // Ouverture commerciale : « closed » réserve la création d'espace coach à la liste ci-dessous.
  COACH_SIGNUP_MODE: z.enum(["closed", "public"]).default("closed"),
  COACH_SIGNUP_EMAILS: z.string().default(""),
  MUX_TOKEN_ID: optional,
  MUX_TOKEN_SECRET: optional,
  MUX_WEBHOOK_SECRET: optional,
  MUX_SIGNING_KEY_ID: optional,
  MUX_SIGNING_PRIVATE_KEY: optional,
  VIDEO_DEV_MP4_URL: optional,
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  STRIPE_PRICE_COACH_MONTH: optional,
  STRIPE_PRICE_COACH_YEAR: optional,
  STRIPE_PRICE_CLUB_MONTH: optional,
  STRIPE_PRICE_CLUB_YEAR: optional,
  STRIPE_PORTAL_CONFIGURATION_ID: optional,
  STRIPE_TAX_ENABLED: z.enum(["true", "false"]).default("false"),
  REVENUECAT_WEBHOOK_AUTH: optional,
  REVENUECAT_PRODUCT_COACH: z.string().default("tartan_coach_monthly,tartan_coach_yearly"),
  REVENUECAT_PRODUCT_CLUB: z.string().default("tartan_club_monthly,tartan_club_yearly"),
  BLOB_READ_WRITE_TOKEN: optional,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: z.string().default("mailto:bonjour@tartan.coach"),
  EXPO_ACCESS_TOKEN: optional,
  CRON_SECRET: optional,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

// En preview, l'adresse vient du déploiement Vercel.
const previewUrl =
  process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;

export const env = (): Env => {
  cached ??= schema.parse({
    ...process.env,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? previewUrl,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? previewUrl,
  });
  return cached;
};
