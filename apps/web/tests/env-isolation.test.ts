import { describe, expect, it } from "vitest";
import { assertEnvIsolation } from "@/lib/env";
import { compareEnvironments, parseDotenv } from "../scripts/verify-env-isolation.mjs";

const PRODUCTION_HOST = "ep-late-hat-b91qqvrw.c-7.eu-central-1.aws.neon.tech";
const local = "postgresql://tartan@localhost:54329/tartan";

describe("garde d'environnement", () => {
  it("refuse une clé Stripe réelle hors production", () => {
    expect(() =>
      assertEnvIsolation({ VERCEL_ENV: "preview", DATABASE_URL: local, STRIPE_SECRET_KEY: "sk_live_abc" }),
    ).toThrow(/Stripe/);
    expect(() => assertEnvIsolation({ DATABASE_URL: local, STRIPE_SECRET_KEY: "rk_live_abc" })).toThrow(/Stripe/);
    expect(() => assertEnvIsolation({ DATABASE_URL: local, STRIPE_SECRET_KEY: "sk_test_abc" })).not.toThrow();
  });
  it("refuse la base de production hors production, avec ou sans pooler", () => {
    for (const host of [PRODUCTION_HOST, PRODUCTION_HOST.replace(".c-7", "-pooler.c-7")]) {
      const url = `postgresql://role:secret@${host}/tartan`;
      expect(() => assertEnvIsolation({ VERCEL_ENV: "preview", DATABASE_URL: url })).toThrow(/base de production/);
      expect(() => assertEnvIsolation({ DATABASE_URL_UNPOOLED: url })).toThrow(/base de production/);
    }
  });
  it("accepte tout cela en production, mais y interdit les réglages de test", () => {
    const url = `postgresql://role:secret@${PRODUCTION_HOST}/tartan`;
    const base = { VERCEL_ENV: "production", DATABASE_URL: url, STRIPE_SECRET_KEY: "sk_live_abc" };
    expect(() => assertEnvIsolation(base)).not.toThrow();
    expect(() => assertEnvIsolation({ ...base, E2E_DISABLE_RATE_LIMIT: "true" })).toThrow(/E2E_DISABLE_RATE_LIMIT/);
    expect(() => assertEnvIsolation({ ...base, VIDEO_DEV_MP4_URL: "https://x" })).toThrow(/VIDEO_DEV_MP4_URL/);
  });
  it("le message d'erreur ne contient jamais le secret", () => {
    const url = `postgresql://role:motdepasse@${PRODUCTION_HOST}/tartan`;
    expect(() => assertEnvIsolation({ DATABASE_URL: url })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("motdepasse") }),
    );
  });
  it("une adresse illisible ne fait pas planter la garde", () => {
    expect(() => assertEnvIsolation({ DATABASE_URL: "pas-une-url" })).not.toThrow();
  });
});

describe("comparaison des environnements", () => {
  it("dit identique, distinct ou illisible sans jamais renvoyer de valeur", () => {
    const results = compareEnvironments(
      {
        production: { A: "un", B: "un", C: "un" },
        preview: { A: "un", B: "deux" },
        development: { A: "autre" },
      },
      ["A", "B", "C", "D"],
    );
    expect(results).toEqual([
      {
        name: "A",
        others: [
          { environment: "preview", status: "identique" },
          { environment: "development", status: "distinct" },
        ],
      },
      {
        name: "B",
        others: [
          { environment: "preview", status: "distinct" },
          { environment: "development", status: "illisible ou absent" },
        ],
      },
      {
        name: "C",
        others: [
          { environment: "preview", status: "illisible ou absent" },
          { environment: "development", status: "illisible ou absent" },
        ],
      },
      {
        name: "D",
        others: [
          { environment: "preview", status: "illisible ou absent en production" },
          { environment: "development", status: "illisible ou absent en production" },
        ],
      },
    ]);
    expect(JSON.stringify(results)).not.toContain("deux");
  });
  it("lit un fichier d'environnement Vercel", () => {
    expect(parseDotenv('# commentaire\nA="un"\nB=deux\n')).toEqual({ A: "un", B: "deux" });
  });
});
