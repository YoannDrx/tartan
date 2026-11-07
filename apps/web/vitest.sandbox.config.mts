import { defineConfig } from "vitest/config";
import base from "./vitest.config.mts";

// Recette volontaire contre Stripe réel en sandbox ; jamais exécutée par pnpm test.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["tests-sandbox/**/*.test.ts"],
    globalSetup: ["tests-sandbox/global-setup.ts"],
    testTimeout: 180_000,
    hookTimeout: 120_000,
    env: {
      ...base.test?.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      NEXT_PUBLIC_APP_URL: "https://tartan-git-codex-v1-1-fiabilite-yoanndrxs-projects.vercel.app",
      RESEND_API_KEY: "",
      STRIPE_SECRET_KEY: "",
      MUX_TOKEN_ID: "",
      MUX_TOKEN_SECRET: "",
    },
  },
});
