import { defineConfig, devices } from "@playwright/test";
import ordinary from "./playwright.config";

// Explicit paid recipe. Never enable real credentials in the ordinary browser suite.
if (process.env.RUN_PLANNER_LIVE !== "1" || process.env.CI)
  throw new Error("Use RUN_PLANNER_LIVE=1 outside CI for the real-provider recipe.");
const key = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
if (!key) throw new Error("OpenAI credential required in the local environment.");
const database = "postgresql://tartan@localhost:54329/tartan_e2e";
if (process.env.E2E_DATABASE_URL && process.env.E2E_DATABASE_URL !== database)
  throw new Error("This recipe only resets the disposable local tartan_e2e database.");
process.env.E2E_DATABASE_URL = database;
const baseURL = "http://localhost:3104";
const servers = Array.isArray(ordinary.webServer) ? ordinary.webServer : [];
const server = servers.at(-1);
if (!server) throw new Error("CAPTURE_BASE_URL is incompatible with this isolated recipe.");

export default defineConfig({
  ...ordinary,
  testDir: "e2e-live",
  testMatch: "planner.spec.ts",
  retries: 0,
  timeout: 300_000,
  outputDir: "test-results/planner-live",
  use: { ...ordinary.use, baseURL },
  projects: [{ name: "real-provider", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    ...server,
    command: "corepack pnpm exec next build && corepack pnpm exec next start -p 3104",
    url: `${baseURL}/connexion`,
    reuseExistingServer: false,
    env: {
      ...server.env,
      TARTAN_E2E_BUILD: "true",
      DATABASE_URL: database,
      DATABASE_URL_UNPOOLED: database,
      BETTER_AUTH_URL: baseURL,
      NEXT_PUBLIC_APP_URL: baseURL,
      AI_PLANNER_ENABLED: "true",
      AI_PLANNER_FAKE_PROVIDER: "false",
      OPENAI_API_KEY: key,
      OPEN_AI_API_KEY: "",
      AI_PLANNER_MODEL: process.env.AI_PLANNER_MODEL || "gpt-4.1-mini",
    },
  },
});
