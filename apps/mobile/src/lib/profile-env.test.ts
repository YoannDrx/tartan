import { describe, expect, it } from "vitest";
import { profileChannel, profileEnv } from "../../scripts/profile-env.mjs";
import { parseVariant, resolveApiUrl } from "./app-variant";

// Pas de types Node dans cette app : le module se charge sans eux, le temps du test.
const fsModule = "node:fs";
const { readFileSync } = (await import(fsModule)) as { readFileSync: (path: URL, encoding: "utf8") => string };
const eas = JSON.parse(readFileSync(new URL("../../eas.json", import.meta.url), "utf8"));

describe("mises à jour à distance", () => {
  it.each(["production", "beta"])("le profil %s porte la variante et l'API de production", (name) => {
    const env = profileEnv(eas, name);
    expect(parseVariant(env.APP_VARIANT)).toBe("production");
    expect(resolveApiUrl("production", env.EXPO_PUBLIC_API_URL)).toBe("https://app.tartan.coach");
  });

  it("garde un canal par profil : les bêtas ne reçoivent pas les mises à jour de production", () => {
    expect(profileChannel(eas, "production")).toBe("production");
    expect(profileChannel(eas, "beta")).toBe("beta");
    expect(profileChannel(eas, "preview")).toBe("preview");
  });

  it("le workflow de publication charge l'environnement du profil avant `eas update`", () => {
    const workflow = readFileSync(new URL("../../../../.github/workflows/release-mobile.yml", import.meta.url), "utf8");
    expect(workflow).toContain("scripts/profile-env.mjs");
    expect(workflow).not.toMatch(/eas update --channel production/);
  });
});
