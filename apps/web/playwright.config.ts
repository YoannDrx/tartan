import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", locale: "fr-FR", timezoneId: "Europe/Paris" },
  // Les captures pour le site visent un serveur déjà lancé sur le jeu de données local.
  ...(process.env.CAPTURE_BASE_URL ? {} : { globalSetup: "./e2e/global-setup.ts" }),
  projects: [
    {
      name: "desktop",
      testIgnore: /terrain/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    { name: "mobile", testIgnore: /terrain/, use: { ...devices["Pixel 7"] } },
    // Au bord de la piste, sur téléphone : le coach aussi, et le moteur de l'iPhone.
    { name: "terrain", testMatch: /terrain/, use: { ...devices["Pixel 7"] } },
    { name: "terrain-webkit", testMatch: /terrain/, use: { ...devices["iPhone 13"] } },
  ],
  webServer: process.env.CAPTURE_BASE_URL
    ? undefined
    : {
        // E2E_PROD=1 : build de production, pour vérifier aussi la CSP et les en-têtes réels.
        command: process.env.E2E_PROD
          ? `corepack pnpm exec next build && corepack pnpm exec next start -p ${PORT}`
          : `corepack pnpm exec next dev --turbopack -p ${PORT}`,
        url: `http://localhost:${PORT}/connexion`,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
        env: {
          TARTAN_E2E_BUILD: process.env.E2E_PROD ? "true" : "false",
          E2E_DISABLE_RATE_LIMIT: "true",
          E2E_DISABLE_ADMIN_STEP_UP: "true",
          COACH_SIGNUP_MODE: "public",
          ADMIN_EMAILS:
            "support-desktop@e2e.tartan.test,support-mobile@e2e.tartan.test,console-desktop@e2e.tartan.test,console-mobile@e2e.tartan.test",
          DATABASE_URL,
          BETTER_AUTH_URL: `http://localhost:${PORT}`,
          NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
          BETTER_AUTH_SECRET: "secret-e2e-secret-e2e-secret-e2e-secret-e2e",
          CRON_SECRET: "e2e-cron",
          APPLE_TEAM_ID: "TESTTEAM00",
          ANDROID_SHA256_FINGERPRINTS: "AA:BB:CC",
          RESEND_API_KEY: "",
          MUX_TOKEN_ID: "",
          MUX_TOKEN_SECRET: "",
          // Les tests IA actifs simulent le prestataire, jamais les écritures finales.
          // Aucune clé du poste ne doit être utilisée par un parcours automatisé.
          AI_PLANNER_ENABLED: process.env.E2E_AI_PLANNER_ENABLED === "true" ? "true" : "false",
          OPENAI_API_KEY: "",
          OPEN_AI_API_KEY: "",
          VIDEO_DEV_MP4_URL: `http://localhost:${PORT}/dev-clip.webm`,
        },
      },
});
