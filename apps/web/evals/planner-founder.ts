// Le corpus du fondateur (lot 6) : 40 consignes écrites et 30 dictées enregistrées par un coach, jamais vues par
// l'agent avant leur passage. Il vit hors du dépôt (`.local/planner-founder/`), est figé par empreinte avant toute
// mesure, puis noté par le même correcteur que le corpus de 80 cas (planner-independent.ts).
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { z } from "zod";
import { corpusSchemaFor, type IndependentCase, type PlannerCorpus } from "./planner-independent";

export const FOUNDER_COUNTS = { instructions: 40, dictations: 30 } as const;
export const FOUNDER_DIR = ".local/planner-founder";
export const INSTRUCTIONS_FILE = "consignes.json";
export const DICTATIONS_DIR = "dictees";
export const MANIFEST_FILE = "manifest.json";

// Une dictée : le fichier audio, ce que le coach a voulu dire (pour mesurer la transcription) et ce qu'on attend.
const dictation = z.object({
  id: z.string().regex(/^D\d{2}$/),
  mode: z.enum(["format", "propose"]),
  file: z.string().regex(/^[\w-]+\.(m4a|webm|wav)$/),
  spoken: z.string().min(10).max(2000),
  brief: corpusSchemaFor(1).shape.cases.element.shape.brief,
  expected: corpusSchemaFor(1).shape.cases.element.shape.expected,
  // Le cadre d'enregistrement, pour lire les écarts : calme, extérieur, vestiaire, voiture…
  setting: z.string().max(80).optional(),
});
export const dictationManifest = corpusSchemaFor(FOUNDER_COUNTS.dictations)
  .omit({ cases: true })
  .extend({ cases: z.array(dictation).length(FOUNDER_COUNTS.dictations) });
export type DictationManifest = z.infer<typeof dictationManifest>;
export type DictationCase = DictationManifest["cases"][number];

const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

// L'empreinte des dictées couvre le manifeste et chaque fichier audio, dans l'ordre des noms.
export const dictationsHash = (dir: string): string => {
  const audio = readdirSync(dir)
    .filter((name) => /\.(m4a|webm|wav)$/.test(name))
    .sort();
  return sha256(
    [sha256(readFileSync(join(dir, MANIFEST_FILE))), ...audio.map((name) => `${name}:${sha256(readFileSync(join(dir, name)))}`)].join("\n"),
  );
};

export type FounderCheck = {
  problems: string[];
  instructions: { cases: number; hash: string | null; frozen: boolean } | null;
  dictations: { cases: number; audioFiles: number; hash: string | null; frozen: boolean } | null;
  corpus: PlannerCorpus | null;
  manifest: DictationManifest | null;
};

const frozenHash = (file: string) => (existsSync(file) ? readFileSync(file, "utf8").trim().split(/\s/)[0] : null);

// Vérifie le corpus sans jamais renvoyer une consigne : seulement des comptes, des empreintes et des problèmes
// nommés par identifiant, pour que l'agent puisse aider sans lire le contenu.
export const checkFounderCorpus = (root: string): FounderCheck => {
  const problems: string[] = [];
  const out: FounderCheck = { problems, instructions: null, dictations: null, corpus: null, manifest: null };
  const instructionsPath = join(root, INSTRUCTIONS_FILE);
  if (!existsSync(instructionsPath)) problems.push(`absent : ${INSTRUCTIONS_FILE}`);
  else {
    const raw = readFileSync(instructionsPath);
    const parsed = corpusSchemaFor(FOUNDER_COUNTS.instructions).safeParse(JSON.parse(raw.toString()));
    const hash = sha256(raw);
    const frozen = frozenHash(`${instructionsPath}.sha256`);
    if (!parsed.success)
      problems.push(...parsed.error.issues.map((issue) => `${INSTRUCTIONS_FILE} : ${issue.path.join(".")} ${issue.code}`));
    else {
      out.corpus = parsed.data;
      if (new Set(parsed.data.cases.map((c) => c.id)).size !== parsed.data.cases.length)
        problems.push(`${INSTRUCTIONS_FILE} : identifiants en double`);
    }
    if (frozen && frozen !== hash) problems.push(`${INSTRUCTIONS_FILE} : modifié après le gel`);
    out.instructions = {
      cases: parsed.success ? parsed.data.cases.length : 0,
      hash,
      frozen: frozen === hash,
    };
  }
  const dir = join(root, DICTATIONS_DIR);
  const manifestPath = join(dir, MANIFEST_FILE);
  if (!existsSync(manifestPath)) problems.push(`absent : ${DICTATIONS_DIR}/${MANIFEST_FILE}`);
  else {
    const parsed = dictationManifest.safeParse(JSON.parse(readFileSync(manifestPath, "utf8")));
    const audioFiles = readdirSync(dir).filter((name) => /\.(m4a|webm|wav)$/.test(name));
    if (!parsed.success)
      problems.push(...parsed.error.issues.map((issue) => `${MANIFEST_FILE} : ${issue.path.join(".")} ${issue.code}`));
    else {
      out.manifest = parsed.data;
      for (const entry of parsed.data.cases)
        if (!audioFiles.includes(entry.file)) problems.push(`${entry.id} : fichier audio absent`);
      if (new Set(parsed.data.cases.map((c) => c.id)).size !== parsed.data.cases.length)
        problems.push(`${MANIFEST_FILE} : identifiants en double`);
    }
    const hash = dictationsHash(dir);
    const frozen = frozenHash(join(dir, `${MANIFEST_FILE}.sha256`));
    if (frozen && frozen !== hash) problems.push(`${DICTATIONS_DIR} : modifié après le gel`);
    out.dictations = { cases: parsed.success ? parsed.data.cases.length : 0, audioFiles: audioFiles.length, hash, frozen: frozen === hash };
  }
  return out;
};

// Gèle le corpus : une seule fois, avant toute mesure. Un nouveau gel exige de retirer l'empreinte à la main.
export const freezeFounderCorpus = (root: string, check: FounderCheck) => {
  if (check.problems.length) throw new Error("corpus_invalid");
  for (const [file, hash] of [
    [join(root, `${INSTRUCTIONS_FILE}.sha256`), check.instructions?.hash],
    [join(root, DICTATIONS_DIR, `${MANIFEST_FILE}.sha256`), check.dictations?.hash],
  ] as const) {
    if (existsSync(file)) throw new Error(`already_frozen:${basename(file)}`);
    writeFileSync(file, `${hash}  ${basename(file).replace(/\.sha256$/, "")}\n`, { mode: 0o600 });
  }
};

// Une dictée se note comme une consigne écrite : le texte voulu sert à repérer les jours, la transcription
// est seule envoyée au modèle.
export const dictationAsCase = (entry: DictationCase): IndependentCase => ({
  id: entry.id,
  mode: entry.mode,
  text: entry.spoken,
  ...(entry.brief ? { brief: entry.brief } : {}),
  expected: entry.expected,
});

const words = (text: string) =>
  text
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9,]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

// Taux d'erreur par mot entre ce que le coach a voulu dire et la transcription (distance d'édition sur les mots).
export const wordErrorRate = (reference: string, hypothesis: string): number => {
  const ref = words(reference);
  const hyp = words(hypothesis);
  if (!ref.length) return hyp.length ? 1 : 0;
  let previous = Array.from({ length: hyp.length + 1 }, (_, j) => j);
  for (let i = 1; i <= ref.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= hyp.length; j += 1)
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[hyp.length]! / ref.length;
};

// Les seuils de qualification, écrits avant de voir une réponse (docs/reference/planificateur-ia.md).
export const FOUNDER_THRESHOLDS = {
  instructionsPassedPerRun: 38,
  runs: 3,
  dictationsPassed: 27,
  medianWordErrorRate: 0.1,
  criticalAllowed: 0,
} as const;
