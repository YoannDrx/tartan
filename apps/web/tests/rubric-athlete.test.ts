import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { m } from "@tartan/i18n";
import { ATHLETE_IDS } from "@tartan/mascot/athletes";
import { describe, expect, it } from "vitest";
import { RUBRIC_ATHLETE } from "@/lib/rubric-athlete";

const root = join(import.meta.dirname, "..");
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : /\.tsx$/.test(name) ? [path] : [];
  });

describe("l'athlète de chaque rubrique", () => {
  it("suit la table de DESIGN.md : un athlète par épreuve et par rubrique", () => {
    expect(RUBRIC_ATHLETE).toMatchObject({
      calendrier: "hurdles",
      progres: "poleVault",
      seances: "tripleJump",
      exercices: "discus",
      suivi: "longJump",
      videos: "highJump",
    });
    // Chacun des six accompagne au moins une rubrique.
    expect(new Set(Object.values(RUBRIC_ATHLETE))).toEqual(new Set(ATHLETE_IDS));
    // La planche de contrôle annonce les mêmes rubriques.
    expect(m.group.rubrics.hurdles).toBe(m.nav.calendrier);
    expect(m.group.rubrics.longJump).toBe(m.nav.suivi);
    expect(m.group.rubrics.highJump).toBe(m.nav.videos);
  });

  it("accompagne chaque état vide de l'application", () => {
    const uses = [...sources(join(root, "app")), ...sources(join(root, "src"))].flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/<EmptyState\b([^>]*)/g)].map((match) => ({ file, props: match[1]! })),
    );
    expect(uses.length).toBeGreaterThan(10);
    for (const use of uses) {
      const rubric = /rubric="([a-z]+)"/.exec(use.props)?.[1];
      expect(rubric, use.file).toBeDefined();
      expect(Object.keys(RUBRIC_ATHLETE), use.file).toContain(rubric);
    }
    // L'ancienne mascotte ne revient pas dans un état vide ni sur la page d'erreur.
    const states = readFileSync(join(root, "src/components/states.tsx"), "utf8");
    const error = readFileSync(join(root, "app/(app)/error.tsx"), "utf8");
    expect(states).not.toContain("Jumper");
    expect(error).not.toContain("Jumper");
  });
});
