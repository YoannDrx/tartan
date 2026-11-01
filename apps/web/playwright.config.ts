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
  globalSetup: "./e2e/global-setup.ts",
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // E2E_PROD=1 : build de production, pour vérifier aussi la CSP et les en-têtes réels.
    command: process.env.E2E_PROD
      ? `pnpm exec next build && pnpm exec next start -p ${PORT}`
      : `pnpm exec next dev --turbopack -p ${PORT}`,
    url: `http://localhost:${PORT}/connexion`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      E2E_DISABLE_RATE_LIMIT: "true",
      COACH_SIGNUP_MODE: "public",
      DATABASE_URL,
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
      BETTER_AUTH_SECRET: "secret-e2e-secret-e2e-secret-e2e-secret-e2e",
      CRON_SECRET: "e2e-cron",
      RESEND_API_KEY: "",
      MUX_TOKEN_ID: "",
      MUX_TOKEN_SECRET: "",
      VIDEO_DEV_MP4_URL: `http://localhost:${PORT}/dev-clip.webm`,
    },
  },
});
