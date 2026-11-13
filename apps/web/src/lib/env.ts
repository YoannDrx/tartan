import { createHash } from "node:crypto";
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
  ANDROID_SHA256_FINGERPRINTS: optional,
  RESEND_API_KEY: optional,
  RESEND_WEBHOOK_SECRET: optional,
  EMAIL_FROM: z.string().default("Tartan <tartan@mail.tartan.coach>"),
  EMAIL_CONTACT: z.string().default("hello@tartan.coach"),
  // Ouverture commerciale : « closed » réserve la création d'espace coach à la liste ci-dessous.
  COACH_SIGNUP_MODE: z.enum(["closed", "public"]).default("closed"),
  COACH_SIGNUP_EMAILS: z.string().default(""),
  // Accès à la console de l'éditeur.
  ADMIN_EMAILS: z.string().default(""),
  // Enrôlement de la première passkey du compte administrateur ; à retirer une fois la clé créée.
  ADMIN_BOOTSTRAP_TOKEN: optional,
  PASSKEY_RP_ID: optional,
  MUX_TOKEN_ID: optional,
  MUX_TOKEN_SECRET: optional,
  MUX_WEBHOOK_SECRET: optional,
  MUX_SIGNING_KEY_ID: optional,
  MUX_SIGNING_PRIVATE_KEY: optional,
  // Offre gratuite de Mux : nombre de vidéos stockées au plus. À retirer le jour où l'offre change.
  MUX_VIDEO_LIMIT: optional,
  VIDEO_DEV_MP4_URL: optional,
  STRIPE_SECRET_KEY: optional,
  BILLING_CHECKOUT_ENABLED: z.enum(["true", "false"]).default("true"),
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
  // Lecture de la disponibilité Google Play. Absent : la confirmation manuelle de la console reste le seul chemin.
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: optional,
  BLOB_READ_WRITE_TOKEN: optional,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: z.string().default("mailto:bonjour@tartan.coach"),
  EXPO_ACCESS_TOKEN: optional,
  OPENAI_API_KEY: optional,
  // Compatibilité avec le nom déjà utilisé par la configuration locale.
  OPEN_AI_API_KEY: optional,
  // Coupe-circuit : absent, le planificateur s'ouvre dès qu'une clé est configurée ; "false" le coupe.
  AI_PLANNER_ENABLED: z.enum(["true", "false"]).optional(),
  AI_PLANNER_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  AI_TRANSCRIPTION_MODEL: z.string().min(1).default("gpt-transcribe"),
  CRON_SECRET: optional,
  CRON_HEARTBEAT_URL: optional,
  CRON_HEARTBEAT_NOTIFICATIONS_URL: optional,
});

export type Env = z.infer<typeof schema>;

// Empreinte de l'hôte Neon de production : la comparaison n'expose rien dans le dépôt.
const PRODUCTION_DB_HOST_SHA256 = "57c83b8db9a6c548eee02df0a8fc4b30ea821e393f034442433cb85745b9c2a1";

const isProductionDatabase = (url: string | undefined): boolean => {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace("-pooler.", ".");
    return createHash("sha256").update(host).digest("hex") === PRODUCTION_DB_HOST_SHA256;
  } catch {
    return false;
  }
};

// Un essai destructif ne doit jamais atteindre la production, et un réglage de test ne doit jamais y arriver.
export const assertEnvIsolation = (vars: Record<string, string | undefined>): void => {
  if (vars.VERCEL_ENV === "production") {
    for (const name of ["E2E_DISABLE_RATE_LIMIT", "VIDEO_DEV_MP4_URL", "AI_PLANNER_FAKE_PROVIDER"]) {
      if (vars[name]) throw new Error(`${name} est interdit en production.`);
    }
    return;
  }
  if (/^(sk|rk)_live_/.test(vars.STRIPE_SECRET_KEY ?? "")) {
    throw new Error("Clé Stripe réelle refusée hors production.");
  }
  if (isProductionDatabase(vars.DATABASE_URL) || isProductionDatabase(vars.DATABASE_URL_UNPOOLED)) {
    throw new Error("La base de production est refusée hors production.");
  }
};

let cached: Env | undefined;

// En preview, l'adresse vient du déploiement Vercel.
const previewUrl =
  process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;

export const env = (): Env => {
  if (!cached) assertEnvIsolation(process.env);
  cached ??= schema.parse({
    ...process.env,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? previewUrl,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? previewUrl,
  });
  return cached;
};
