import { describe, expect, it } from "vitest";
import { assertEnvIsolation, parseEnv } from "@/lib/env";
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
    expect(() => assertEnvIsolation({ ...base, AI_PLANNER_FAKE_PROVIDER: "true" })).toThrow(/AI_PLANNER_FAKE_PROVIDER/);
    expect(() => assertEnvIsolation({ ...base, VIDEO_DEV_MP4_URL: "https://x" })).toThrow(/VIDEO_DEV_MP4_URL/);
    expect(() => assertEnvIsolation({ ...base, MUX_BASE_URL: "http://localhost:3103" })).toThrow(/MUX_BASE_URL/);
    // Le dossier où les parcours relisent les e-mails contient des liens de connexion : jamais en production.
    expect(() => assertEnvIsolation({ ...base, E2E_MAIL_DIR: "/tmp/e-mails" })).toThrow(/E2E_MAIL_DIR/);
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

describe("lecture de l'environnement", () => {
  it("traite une variable vide comme absente, pour que .env.example se copie tel quel", () => {
    const parsed = parseEnv({
      DATABASE_URL: local,
      BETTER_AUTH_SECRET: "x".repeat(32),
      BETTER_AUTH_URL: "",
      COACH_SIGNUP_MODE: "",
      EMAIL_FROM: "",
      MUX_TOKEN_ID: "",
      AI_PLANNER_ENABLED: "",
    });
    expect(parsed.BETTER_AUTH_URL).toBe("http://localhost:3000");
    expect(parsed.COACH_SIGNUP_MODE).toBe("closed");
    expect(parsed.EMAIL_FROM).toBe("Tartan <tartan@mail.tartan.coach>");
    expect(parsed.MUX_TOKEN_ID).toBeUndefined();
    expect(parsed.AI_PLANNER_ENABLED).toBeUndefined();
  });
  it("prend l'adresse du déploiement en preview quand aucune n'est posée", () => {
    const parsed = parseEnv({
      DATABASE_URL: local,
      BETTER_AUTH_SECRET: "x".repeat(32),
      BETTER_AUTH_URL: "",
      VERCEL_ENV: "preview",
      VERCEL_URL: "tartan-git-essai.vercel.app",
    });
    expect(parsed.BETTER_AUTH_URL).toBe("https://tartan-git-essai.vercel.app");
    expect(parsed.NEXT_PUBLIC_APP_URL).toBe("https://tartan-git-essai.vercel.app");
  });
});

describe("comparaison des environnements", () => {
  it("ne confond pas deux valeurs masquées par Vercel avec des secrets identiques", () => {
    const [result] = compareEnvironments({ production: { KEY: "[sensitive]" }, preview: { KEY: "[sensitive]" } }, [
      "KEY",
    ]);
    expect(result?.others[0]?.status).toBe("illisible ou absent en production");
  });
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
