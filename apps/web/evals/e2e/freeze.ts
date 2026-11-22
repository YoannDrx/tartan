// Gel du corpus et du jeu de paires : une empreinte sha256 écrite à côté du fichier, comme `independent/*.sha256`.
// Le lanceur refuse un fichier sans empreinte, ou dont l'empreinte ne correspond plus : un corpus ne se retouche
// pas après qu'une réponse a été vue.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { z } from "zod";
import { corpusProblems, e2eCorpus, type E2eCorpus } from "./format";
import { e2ePairs, pairProblems, type E2ePairs } from "./pairs/format";

export const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const hashPath = (file: string) => `${file}.sha256`;
/** L'empreinte gelée d'un fichier, ou `null` s'il n'a jamais été gelé. */
export const frozenHash = (file: string): string | null =>
  existsSync(hashPath(file)) ? (readFileSync(hashPath(file), "utf8").trim().split(/\s/)[0] ?? null) : null;

export class FreezeError extends Error {
  constructor(
    readonly code: "missing_file" | "not_frozen" | "frozen_corpus_changed" | "already_frozen" | "invalid",
    readonly file: string,
    detail?: string,
  ) {
    super(`${code}: ${file}${detail ? ` (${detail})` : ""}`);
    this.name = "FreezeError";
  }
}

/** Écrit l'empreinte. Refuse de regeler un fichier modifié : l'ancienne empreinte se retire à la main, en connaissance de cause. */
export function freezeFile(file: string): string {
  if (!existsSync(file)) throw new FreezeError("missing_file", file);
  const hash = sha256(readFileSync(file));
  const previous = frozenHash(file);
  if (previous && previous !== hash) throw new FreezeError("already_frozen", file);
  writeFileSync(hashPath(file), `${hash}  ${basename(file)}\n`);
  return hash;
}

/** Lit un fichier gelé : son contenu brut et son empreinte, après vérification. */
export function readFrozen(file: string): { raw: Buffer; hash: string } {
  if (!existsSync(file)) throw new FreezeError("missing_file", file);
  const raw = readFileSync(file);
  const hash = sha256(raw),
    frozen = frozenHash(file);
  if (!frozen) throw new FreezeError("not_frozen", file);
  if (frozen !== hash) throw new FreezeError("frozen_corpus_changed", file);
  return { raw, hash };
}

const parse = <T>(file: string, raw: Buffer, schema: z.ZodType<T>): T => {
  let json: unknown;
  try {
    json = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new FreezeError("invalid", file, "JSON illisible");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success)
    throw new FreezeError(
      "invalid",
      file,
      parsed.error.issues
        .slice(0, 8)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(" ; "),
    );
  return parsed.data;
};

/** Valide un corpus sans exiger son gel : ce que fait `--check` et `--freeze` avant d'écrire l'empreinte. */
export function validateCorpus(file: string): { corpus: E2eCorpus; hash: string; problems: string[] } {
  if (!existsSync(file)) throw new FreezeError("missing_file", file);
  const raw = readFileSync(file);
  const corpus = parse<E2eCorpus>(file, raw, e2eCorpus);
  return { corpus, hash: sha256(raw), problems: corpusProblems(corpus) };
}
export function validatePairs(file: string): { pairs: E2ePairs; hash: string; problems: string[] } {
  if (!existsSync(file)) throw new FreezeError("missing_file", file);
  const raw = readFileSync(file);
  const pairs = parse<E2ePairs>(file, raw, e2ePairs);
  return { pairs, hash: sha256(raw), problems: pairProblems(pairs) };
}

/** Ce que le lanceur charge : gelé, conforme au format, sans clé inconnue. */
export function loadFrozenCorpus(file: string): { corpus: E2eCorpus; hash: string } {
  const { raw, hash } = readFrozen(file);
  const corpus = parse<E2eCorpus>(file, raw, e2eCorpus);
  const problems = corpusProblems(corpus);
  if (problems.length) throw new FreezeError("invalid", file, problems.slice(0, 8).join(" ; "));
  return { corpus, hash };
}
export function loadFrozenPairs(file: string): { pairs: E2ePairs; hash: string } {
  const { raw, hash } = readFrozen(file);
  const pairs = parse<E2ePairs>(file, raw, e2ePairs);
  const problems = pairProblems(pairs);
  if (problems.length) throw new FreezeError("invalid", file, problems.slice(0, 8).join(" ; "));
  return { pairs, hash };
}
