import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SCREENS } from "../e2e/screens";

const ROOT = join(__dirname, "..");

// Toutes les pages de l'application, en chemin d'URL : les groupes de routes « (app) » ne comptent pas.
const pages = (dir: string, base = ""): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name.startsWith("_") || name === "api" || name === ".well-known") return [];
      return pages(path, /^\(.+\)$/.test(name) ? base : `${base}/${name}`);
    }
    return name === "page.tsx" ? [base || "/"] : [];
  });

const proofPath = (proof: string) => join(ROOT, proof.startsWith("tests/") ? proof : `e2e/${proof}`);

describe("matrice des écrans", () => {
  it("nomme chaque page de l'application, et rien d'autre", () => {
    const routes = pages(join(ROOT, "app")).sort();
    const listed = SCREENS.map((screen) => screen.path).sort();
    expect(listed.filter((path) => !routes.includes(path)), "écrans de la matrice sans page").toEqual([]);
    expect(routes.filter((path) => !listed.includes(path)), "pages absentes de la matrice").toEqual([]);
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("prouve chaque écran à paramètre par un parcours ou un test qui l'ouvre", () => {
    for (const screen of SCREENS) {
      const prefix = screen.path.split("[")[0]!.replace(/\/$/, "") || "/";
      for (const proof of screen.proof) expect(existsSync(proofPath(proof)), `${screen.path} : ${proof}`).toBe(true);
      if (!screen.path.includes("[")) continue;
      expect(screen.proof.length, `${screen.path} sans preuve`).toBeGreaterThan(0);
      const opened = screen.proof.some((proof) => readFileSync(proofPath(proof), "utf8").includes(prefix));
      expect(opened, `${screen.path} : aucune preuve n'ouvre ${prefix}`).toBe(true);
    }
  });
});
