import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import {
  checkFounderCorpus,
  dictationAsCase,
  FOUNDER_COUNTS,
  freezeFounderCorpus,
  wordErrorRate,
} from "../evals/planner-founder";
import { independentContext } from "../evals/planner-independent";
import { plannerProviderContext } from "@/server/ai/provider";

const model = join(import.meta.dirname, "../evals/founder/modele");
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

// Un corpus complet fabriqué à partir du modèle : 40 consignes, 30 dictées et leurs fichiers audio.
const fullCorpus = () => {
  const dir = mkdtempSync(join(tmpdir(), "planner-founder-"));
  dirs.push(dir);
  cpSync(model, dir, { recursive: true });
  const instructions = JSON.parse(readFileSync(join(dir, "consignes.json"), "utf8"));
  instructions.cases = Array.from({ length: FOUNDER_COUNTS.instructions }, (_, i) => ({
    ...instructions.cases[i % 2],
    id: `C${String(i + 1).padStart(2, "0")}`,
  }));
  writeFileSync(join(dir, "consignes.json"), JSON.stringify(instructions));
  const manifest = JSON.parse(readFileSync(join(dir, "dictees/manifest.json"), "utf8"));
  manifest.cases = Array.from({ length: FOUNDER_COUNTS.dictations }, (_, i) => {
    const id = `D${String(i + 1).padStart(2, "0")}`;
    writeFileSync(join(dir, "dictees", `${id}.m4a`), `audio ${id}`);
    return { ...manifest.cases[0], id, file: `${id}.m4a` };
  });
  writeFileSync(join(dir, "dictees/manifest.json"), JSON.stringify(manifest));
  return dir;
};

it("le modèle versionné a le bon format, mais pas le bon nombre de cas", () => {
  const check = checkFounderCorpus(model);
  expect(check.problems.some((problem) => problem.startsWith("consignes.json : cases"))).toBe(true);
  expect(check.problems.some((problem) => problem.startsWith("manifest.json : cases"))).toBe(true);
  // Sinon, seuls les comptes et les identifiants sortent : le modèle n'est qu'un exemple de format.
  expect(check.instructions?.cases).toBe(0);
});

it("accepte un corpus complet et le fige une seule fois", () => {
  const dir = fullCorpus();
  const check = checkFounderCorpus(dir);
  expect(check.problems).toEqual([]);
  expect(check.instructions).toMatchObject({ cases: 40, frozen: false });
  expect(check.dictations).toMatchObject({ cases: 30, audioFiles: 30, frozen: false });
  freezeFounderCorpus(dir, check);
  expect(checkFounderCorpus(dir).instructions?.frozen).toBe(true);
  expect(checkFounderCorpus(dir).dictations?.frozen).toBe(true);
  expect(() => freezeFounderCorpus(dir, checkFounderCorpus(dir))).toThrow(/already_frozen/);
});

it("refuse un corpus modifié après le gel, audio compris", () => {
  const dir = fullCorpus();
  freezeFounderCorpus(dir, checkFounderCorpus(dir));
  writeFileSync(join(dir, "dictees", "D07.m4a"), "autre audio");
  expect(checkFounderCorpus(dir).problems).toContain("dictees : modifié après le gel");
});

it("ne renvoie jamais le texte d'une consigne dans le contrôle", () => {
  const dir = fullCorpus();
  const check = checkFounderCorpus(dir);
  const printed = JSON.stringify({ instructions: check.instructions, dictations: check.dictations, problems: check.problems });
  expect(printed).not.toContain("squat");
  expect(printed).not.toContain("Mardi");
});

it("une dictée est envoyée par sa transcription, notée sur ce que le coach a voulu dire", () => {
  const dir = fullCorpus();
  const { manifest } = checkFounderCorpus(dir);
  const test = dictationAsCase(manifest!.cases[0]!);
  const context = plannerProviderContext.parse(independentContext({ ...test, text: "transcription" }, { ...manifest!, cases: [] }));
  expect(context.instructions).toEqual(["transcription"]);
  expect(context).not.toHaveProperty("expected");
});

it("mesure l'écart de transcription mot à mot, sans accents ni ponctuation", () => {
  expect(wordErrorRate("Trois séries de huit.", "trois series de huit")).toBe(0);
  expect(wordErrorRate("trois séries de huit", "trois séries de six")).toBe(0.25);
  expect(wordErrorRate("", "")).toBe(0);
});
