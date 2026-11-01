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
  EMAIL_FROM: z.string().default("Tartan <bonjour@tartan.coach>"),
  MUX_TOKEN_ID: optional,
  MUX_TOKEN_SECRET: optional,
  MUX_WEBHOOK_SECRET: optional,
  MUX_SIGNING_KEY_ID: optional,
  MUX_SIGNING_PRIVATE_KEY: optional,
  VIDEO_DEV_MP4_URL: optional,
  BLOB_READ_WRITE_TOKEN: optional,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: z.string().default("mailto:bonjour@tartan.coach"),
  EXPO_ACCESS_TOKEN: optional,
  CRON_SECRET: optional,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export const env = (): Env => {
  cached ??= schema.parse(process.env);
  return cached;
};
