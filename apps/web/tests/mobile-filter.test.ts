import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Maestro (une heure) ne tourne que si l'app native peut avoir changé. Le filtre de `mobile-native.yml` liste donc
// ce qu'elle embarque, paquet par paquet : ces tests refusent qu'il oublie une dépendance, et qu'un texte réservé
// au web (`@tartan/i18n/web`, hors du filtre) entre dans l'app.
const root = path.join(import.meta.dirname, "../../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const filter = (() => {
  const block = read(".github/workflows/mobile-native.yml").split(/^\s+mobile:\n/m)[1] ?? "";
  const lines: string[] = [];
  for (const line of block.split("\n")) {
    const pattern = line.match(/^\s+- "([^"]+)"$/)?.[1];
    if (!pattern) break;
    lines.push(pattern);
  }
  return lines;
})();

// Les motifs du filtre : `**` traverse les dossiers, `*` reste dans le sien.
const matches = (pattern: string, file: string) =>
  new RegExp(
    `^${pattern
      .split("**")
      .map((part) => part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]*"))
      .join(".*")}$`,
  ).test(file);
const watched = (file: string) => filter.some((pattern) => matches(pattern, file));

const workspaceDeps = (dir: string): string[] => {
  const manifest = JSON.parse(read(`${dir}/package.json`)) as { dependencies?: Record<string, string> };
  return Object.keys(manifest.dependencies ?? {})
    .filter((name) => name.startsWith("@tartan/"))
    .map((name) => `packages/${name.slice("@tartan/".length)}`);
};
const embedded = (() => {
  const seen = new Set<string>();
  const visit = (dir: string) => {
    for (const dep of workspaceDeps(dir)) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      visit(dep);
    }
  };
  visit("apps/mobile");
  return [...seen].sort();
})();

const sources = (dir: string, deep = true): string[] =>
  readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory())
      return deep && !["node_modules", "ios", "android", ".expo", "dist"].includes(entry.name) ? sources(file) : [];
    return /\.(ts|tsx|mjs|js)$/.test(entry.name) ? [file] : [];
  });

describe("filtre de la CI mobile", () => {
  it("surveille chaque paquet que l'app native embarque", () => {
    expect(embedded).toContain("packages/i18n");
    for (const dir of embedded) {
      expect(watched(`${dir}/package.json`), dir).toBe(true);
      expect(watched(`${dir}/src/index.ts`), dir).toBe(true);
    }
    expect(watched("apps/mobile/app/_layout.tsx")).toBe(true);
    expect(watched("pnpm-lock.yaml")).toBe(true);
  });

  it("laisse passer les textes propres au web et ce que l'app n'embarque pas", () => {
    expect(watched("packages/i18n/src/fr.ts")).toBe(true);
    expect(watched("packages/i18n/src/web/index.ts")).toBe(false);
    expect(watched("packages/i18n/src/web/reglages.ts")).toBe(false);
    expect(watched("apps/web/app/page.tsx")).toBe(false);
    expect(watched("docs/ETAT.md")).toBe(false);
    for (const dir of readdirSync(path.join(root, "packages")).map((name) => `packages/${name}`))
      if (!embedded.includes(dir)) expect(watched(`${dir}/src/index.ts`), dir).toBe(false);
  });

  it("aucun texte réservé au web n'entre dans l'app native", () => {
    const files = [
      ...sources("apps/mobile"),
      ...embedded.filter((dir) => dir !== "packages/i18n").flatMap((dir) => sources(dir)),
      // Les textes partagés ne tirent pas ceux du web avec eux.
      ...sources("packages/i18n/src", false),
    ];
    expect(files.length).toBeGreaterThan(100);
    // Un import, pas une mention : la règle de lint du mobile nomme le module pour l'interdire.
    const leaking = files.filter((file) =>
      /(from|import\(|require\()\s*["'](@tartan\/i18n\/web|\.\/web)(\/[^"']*)?["']/.test(read(file)),
    );
    expect(leaking).toEqual([]);
  });
});
