import { createHash } from "node:crypto";
import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));
const plannerEffort = z.enum(["none", "low", "medium", "high"]);

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
  RESEND_PREVIOUS_SENDERS: optional,
  EMAIL_FROM: z.string().default("Tartan <tartan@mail.tartan.coach>"),
  EMAIL_CONTACT: z.string().default("hello@tartan.coach"),
  // Ouverture commerciale : « closed » réserve la création d'espace coach à la liste ci-dessous.
  COACH_SIGNUP_MODE: z.enum(["closed", "public"]).default("closed"),
  COACH_SIGNUP_EMAILS: z.string().default(""),
  // Athlètes autonomes (espace personnel) : fermé par défaut ; l'ouverture appartient au fondateur, depuis la console.
  ATHLETE_SIGNUP_MODE: z.enum(["closed", "public"]).default("closed"),
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
  // Plafond technique global facultatif, distinct des quotas commerciaux par espace.
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
  BETA_INVITES_ENABLED: z.enum(["true", "false"]).default("false"),
  BETA_APK_PATH: optional,
  BETA_APK_VERSION: optional,
  BETA_APK_READ_WRITE_TOKEN: optional,
  BETA_ASC_ISSUER: optional,
  BETA_ASC_KEY_ID: optional,
  BETA_ASC_PRIVATE_KEY: optional,
  BETA_ASC_GROUP_ID: optional,
  BETA_PLAY_URL: z.url().startsWith("https://play.google.com/").optional(),
  EXPO_ACCESS_TOKEN: optional,
  OPENAI_API_KEY: optional,
  // Compatibilité avec le nom déjà utilisé par la configuration locale.
  OPEN_AI_API_KEY: optional,
  // Coupe-circuit : absent, le planificateur s'ouvre dès qu'une clé est configurée ; "false" le coupe.
  AI_PLANNER_ENABLED: z.enum(["true", "false"]).optional(),
  // Planificateur en quatre étapes (docs/reference/planificateur-ia.md). Le modèle principal compose et répare ;
  // le modèle rapide comprend la demande et retrouve les fiches. gpt-4.1 et gpt-4.1-mini s'arrêtent le
  // 14 janvier 2027 : les défauts sont dans la gamme GPT-6, choisis à la mesure du 21 novembre 2026.
  AI_PLANNER_MODEL: z.string().min(1).default("gpt-6.2-sol"),
  AI_PLANNER_FAST_MODEL: z.string().min(1).default("gpt-6.1-terra"),
  // Modèle qui compose une demande seulement décrite (rien à proposer) : vide, le modèle rapide. Dès qu'une partie
  // est à proposer, ou pour un ajustement, c'est le modèle principal. Le poser à la valeur de AI_PLANNER_MODEL
  // rend la composition au modèle principal pour toute demande.
  AI_PLANNER_DESCRIBED_MODEL: optional,
  // Effort de raisonnement de chaque étape. `none` n'existe que sur Luna et Terra : ailleurs il devient `low`.
  AI_PLANNER_UNDERSTAND_EFFORT: plannerEffort.default("none"),
  AI_PLANNER_MATCH_EFFORT: plannerEffort.default("low"),
  // Composer : `none` sur le modèle rapide (mesuré le 22 novembre 2026), `low` sur Sol, qui refuse `none`.
  AI_PLANNER_COMPOSE_EFFORT: plannerEffort.default("none"),
  AI_PLANNER_REPAIR_EFFORT: plannerEffort.default("low"),
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
    for (const name of [
      "E2E_DISABLE_RATE_LIMIT",
      "E2E_MAIL_DIR",
      "VIDEO_DEV_MP4_URL",
      "AI_PLANNER_FAKE_PROVIDER",
      "MUX_BASE_URL",
    ]) {
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

// Une variable vide vaut une variable absente : `.env.example` se copie tel quel, chaque défaut s'applique.
export const parseEnv = (source: Record<string, string | undefined>): Env => {
  const vars = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
  // En preview, l'adresse vient du déploiement Vercel.
  const previewUrl = vars.VERCEL_ENV === "preview" && vars.VERCEL_URL ? `https://${vars.VERCEL_URL}` : undefined;
  return schema.parse({
    ...vars,
    BETTER_AUTH_URL: vars.BETTER_AUTH_URL ?? previewUrl,
    NEXT_PUBLIC_APP_URL: vars.NEXT_PUBLIC_APP_URL ?? previewUrl,
  });
};

export const env = (): Env => {
  if (!cached) assertEnvIsolation(process.env);
  cached ??= parseEnv(process.env);
  return cached;
};
