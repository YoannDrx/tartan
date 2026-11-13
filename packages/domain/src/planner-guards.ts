import type { PlannerInterpretation } from "@tartan/contracts";
import { normalizeExerciseMention, normalizeExerciseTerm } from "./exercise-aliases";
import { addDays } from "./status";

// Contrôles déterministes appliqués à la réponse du modèle, côté serveur.
// Ils ne complètent jamais une séance : une sortie douteuse devient une question.
export type PlannerGuardIssue =
  "date" | "missing_date" | "exercise" | "target" | "rest" | "load" | "session_count" | "volume";
export type PlannerGuardExercise = { token: string; name: string; aliases: readonly string[] };
export type PlannerGuardContext = {
  period: { from: string; to: string };
  today: string;
  instructions: readonly string[];
  targets: readonly { token: string }[];
  exercises: readonly PlannerGuardExercise[];
};

const plain = (value: string) => normalizeExerciseTerm(value).replace(/'/g, " ");
const WORD_START = "(?<![\\p{L}\\p{N}_-])";
const WORD_END = "(?![\\p{L}\\p{N}_-])";

const UNITS: Record<string, number> = {
  zero: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
};
const isNumberWord = (token: string) =>
  token in UNITS || token === "cent" || token === "cents" || token === "mille" || token === "vingts";
function numberFromWords(words: readonly string[]): number {
  let total = 0,
    current = 0;
  for (const word of words) {
    if (word === "et") continue;
    if (word === "mille") {
      total += (current || 1) * 1000;
      current = 0;
    } else if (word === "cent" || word === "cents") current = (current % 100 || 1) * 100 + current - (current % 100);
    else if ((word === "vingt" || word === "vingts") && current % 100 === 4) current += 76;
    else if (word === "vingts") current += 20;
    else current += UNITS[word] ?? 0;
  }
  return total + current;
}

// Chaque nombre d'un texte, en chiffres ou en toutes lettres, avec ce qui le suit.
function numberMentions(text: string): { value: number; after: string }[] {
  const mentions: { value: number; after: string }[] = [];
  const normalized = plain(text);
  for (const match of normalized.matchAll(/\d+(?:[.,]\d+)?/g))
    mentions.push({
      value: Number(match[0].replace(",", ".")),
      after: normalized.slice(match.index + match[0].length, match.index + match[0].length + 16),
    });
  // Une ponctuation sépare toujours deux nombres : « cent vingt, soixante » n'en forme pas un seul.
  for (const segment of normalized.replace(/%/g, " pourcent ").split(/[,;:.!?()\n]+/)) {
    const tokens = segment.split(/[^a-z0-9]+/).filter(Boolean);
    for (let i = 0; i < tokens.length;) {
      if (!isNumberWord(tokens[i]!)) {
        i++;
        continue;
      }
      const words: string[] = [];
      while (
        i < tokens.length &&
        (isNumberWord(tokens[i]!) || (tokens[i] === "et" && words.length > 0 && isNumberWord(tokens[i + 1] ?? "")))
      )
        words.push(tokens[i++]!);
      const whole = numberFromWords(words);
      mentions.push({ value: whole, after: tokens.slice(i).join(" ") });
      if (tokens[i] === "virgule" && (isNumberWord(tokens[i + 1] ?? "") || /^\d+$/.test(tokens[i + 1] ?? ""))) {
        const decimal = tokens[i + 1]!;
        const digits = /^\d+$/.test(decimal) ? decimal : String(numberFromWords([decimal]));
        mentions.push({ value: Number(`${whole}.${digits}`), after: tokens.slice(i + 2).join(" ") });
      }
      if (tokens[i] === "et" && tokens[i + 1] === "demi")
        mentions.push({ value: whole + 0.5, after: tokens.slice(i + 2).join(" ") });
    }
  }
  return mentions;
}
export const plannerTextNumbers = (text: string) => new Set(numberMentions(text).map((mention) => mention.value));

const KG_UNIT = /^\s*(?:kg|kilos?|kilogrammes?)(?![a-z])/;
const PERCENT_UNIT = /^\s*(?:%|pour ?cent)/;
const hasUnit = (mentions: { value: number; after: string }[], value: number, unit: RegExp) =>
  mentions.some((mention) => mention.value === value && unit.test(mention.after));

const MONTHS = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
];
const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const DAY_WORDS = [
  "premier",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
  "dix sept",
  "dix huit",
  "dix neuf",
  "vingt",
  "vingt et un",
  "vingt deux",
  "vingt trois",
  "vingt quatre",
  "vingt cinq",
  "vingt six",
  "vingt sept",
  "vingt huit",
  "vingt neuf",
  "trente",
  "trente et un",
];
const dayPattern = `\\d{1,2}|1er|${[...DAY_WORDS].sort((a, b) => b.length - a.length).join("|")}`;
const monthPattern = MONTHS.join("|");
const weekdayPattern = WEEKDAYS.join("|");
const dayNumber = (raw: string) => {
  if (raw === "1er" || raw === "premier") return 1;
  if (/^\d+$/.test(raw)) return Number(raw);
  return numberFromWords(raw.split(" "));
};
const pad = (value: number) => String(value).padStart(2, "0");
const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const isRealDate = (iso: string) => {
  const parsed = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso;
};
function resolveDate(day: number, month: number, year: number | null, period: { from: string; to: string }) {
  const first = Number(period.from.slice(0, 4));
  const last = Number(period.to.slice(0, 4));
  const years = year !== null ? [year] : first === last ? [first] : [first, last];
  const candidates = years.map((y) => `${y}-${pad(month)}-${pad(day)}`).filter(isRealDate);
  return candidates.find((iso) => iso >= period.from && iso <= period.to) ?? candidates[0] ?? null;
}

export type PlannerDateReferences = {
  explicit: { iso: string; weekdayMismatch: boolean }[];
  ranges: { from: string; to: string }[];
  relative: string[];
  weekdayOnly: boolean;
};

export function plannerDateReferences(
  text: string,
  { today, period }: { today: string; period: { from: string; to: string } },
): PlannerDateReferences {
  let normalized = plain(text).replace(/-/g, " ");
  const ranges: PlannerDateReferences["ranges"] = [];
  const range = new RegExp(
    `${WORD_START}du\\s+(${dayPattern})(?:\\s+(${monthPattern}))?\\s+au\\s+(${dayPattern})\\s+(${monthPattern})(?:\\s+(\\d{4}))?${WORD_END}`,
    "gu",
  );
  normalized = normalized.replace(
    range,
    (_all, d1: string, m1: string | undefined, d2: string, m2: string, y?: string) => {
      const year = y ? Number(y) : null;
      const start = resolveDate(dayNumber(d1), MONTHS.indexOf(m1 ?? m2) + 1, year, period);
      const end = resolveDate(dayNumber(d2), MONTHS.indexOf(m2) + 1, year, period);
      if (start && end) ranges.push({ from: start, to: end });
      return " ";
    },
  );
  const explicit: PlannerDateReferences["explicit"] = [];
  const dated = new RegExp(
    `${WORD_START}(?:(${weekdayPattern})\\s+)?(?:le\\s+)?(${dayPattern})\\s+(${monthPattern})(?:\\s+(\\d{4}))?${WORD_END}`,
    "gu",
  );
  normalized = normalized.replace(dated, (_all, weekday: string | undefined, d: string, m: string, y?: string) => {
    const iso = resolveDate(dayNumber(d), MONTHS.indexOf(m) + 1, y ? Number(y) : null, period);
    if (iso)
      explicit.push({ iso, weekdayMismatch: weekday !== undefined && WEEKDAYS.indexOf(weekday) !== weekdayOf(iso) });
    return " ";
  });
  const relative: string[] = [];
  const offsets: [string, number][] = [
    ["avant hier", -2],
    ["apres demain", 2],
    ["aujourd hui", 0],
    ["ce matin", 0],
    ["ce midi", 0],
    ["ce soir", 0],
    ["demain", 1],
    ["hier", -1],
  ];
  for (const [term, offset] of offsets) {
    const pattern = new RegExp(`${WORD_START}${term}${WORD_END}`, "gu");
    normalized = normalized.replace(pattern, (match, index: number, whole: string) => {
      // « comme hier » ou « qu'hier » cite une séance passée, pas la date demandée.
      const before = whole.slice(0, index).trimEnd().split(/\s+/).at(-1) ?? "";
      if (["qu", "que", "comme", "de", "d", "depuis"].includes(before)) return match;
      relative.push(addDays(today, offset));
      return " ";
    });
  }
  return {
    explicit,
    ranges,
    relative,
    weekdayOnly: new RegExp(`${WORD_START}(?:${weekdayPattern})s?${WORD_END}`, "u").test(normalized),
  };
}

// Deux charges pour une même prescription, sans correction ni progression : le coach tranche.
const LOAD_SEQUENCE = /\b(soit|au total|puis|jusqu|montee|progress)/;
function contradictoryLoads(text: string, exercises: readonly PlannerGuardExercise[]) {
  return plain(text)
    .split(/(?<!\d)[.;\n]+|[.;\n]+(?!\d)/)
    .some((sentence) => {
      if (CORRECTION.test(sentence) || LOAD_SEQUENCE.test(sentence)) return false;
      const values = new Set(
        numberMentions(sentence)
          .filter((mention) => KG_UNIT.test(mention.after))
          .map((mention) => mention.value),
      );
      return (
        values.size > 1 &&
        exercises.filter((exercise) => plannerExerciseIsNamed(sentence, exercise.token, exercises)).length <= 1
      );
    });
}

const CORRECTION = /\b(non pardon|enfin non|pardon|plutot|correction|je corrige|finalement)\b/;

function dateIssue(
  value: PlannerInterpretation,
  references: PlannerDateReferences,
  period: { from: string; to: string },
  corrected: boolean,
) {
  const { explicit, ranges, relative, weekdayOnly } = references;
  const dates = value.sessions.map((session) => session.date);
  if (explicit.some((date) => date.weekdayMismatch)) return "date" as const;
  if (ranges.some((range) => range.from < period.from || range.to > period.to)) return "date" as const;
  if (weekdayOnly || ranges.length) return null;
  if (relative.length && explicit.length) return null;
  const stated = relative.length ? relative : explicit.map((date) => date.iso);
  if (stated.length) {
    if (dates.some((date) => !stated.includes(date))) return "date" as const;
    // Une demande tronquée ne laisse jamais tomber un jour cité sans le dire ;
    // une correction orale (« le 4, non pardon le 5 ») remplace le jour précédent.
    return !corrected && stated.some((date) => date >= period.from && date <= period.to && !dates.includes(date))
      ? ("missing_date" as const)
      : null;
  }
  // Aucun jour dans la consigne : une seule date n'est déductible que d'une période d'un jour.
  return period.from !== period.to && dates.length === 1 ? ("date" as const) : null;
}

const HABIT = /habitu|comme d habitude|derniere fois|semaine derniere/;
const REST_TERM = /repos|recup/;
const LOAD_TERM = /charge|kilo|poids|\bkg\b/;
// Aucun historique n'est transmis au modèle : une référence à l'habitude ne se résout jamais seule.
function habitualIssues(text: string) {
  const issues = new Set<"rest" | "load">();
  for (const clause of plain(text).split(/[.;,:\n]+/)) {
    if (!HABIT.test(clause) || /\d/.test(clause)) continue;
    if (REST_TERM.test(clause)) issues.add("rest");
    if (LOAD_TERM.test(clause)) issues.add("load");
  }
  return issues;
}

const requestedSessions = (text: string) => {
  let highest = 0;
  const pattern = /([a-z0-9]+(?:[ -][a-z0-9]+){0,2})\s+seances?\b/g;
  for (const match of plain(text).matchAll(pattern)) {
    const tokens = match[1]!.split(/[ -]/);
    const last = tokens.at(-1)!;
    if (/^\d+$/.test(last)) {
      highest = Math.max(highest, Number(last));
      continue;
    }
    const words: string[] = [];
    for (let i = tokens.length - 1; i >= 0 && (isNumberWord(tokens[i]!) || tokens[i] === "et"); i--)
      words.unshift(tokens[i]!);
    if (words.length) highest = Math.max(highest, numberFromWords(words));
  }
  return highest;
};

const singular = (word: string) => (word.length > 3 ? word.replace(/[sx]$/, "") : word);
const significantWords = (label: string) =>
  plain(label)
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 5 && !["avant", "arriere", "barre", "lourd", "libre"].includes(word))
    .map(singular);
const namesOf = (exercise: PlannerGuardExercise) => [exercise.name, ...exercise.aliases];

// Un exercice ne peut être retenu que s'il est désigné : nom complet, alias, ou mot
// distinctif porté par cette seule fiche. Jamais par proximité de mouvement.
export function plannerExerciseIsNamed(
  text: string,
  token: string,
  exercises: readonly PlannerGuardExercise[],
): boolean {
  const exercise = exercises.find((candidate) => candidate.token === token);
  if (!exercise) return false;
  const normalized = plain(text).replace(/-/g, " ");
  const inflectedText = normalizeExerciseMention(text);
  const named = namesOf(exercise).some((label) => {
    const term = normalizeExerciseMention(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return term.length > 0 && new RegExp(`(?<![\\p{L}\\p{N}_])${term}(?![\\p{L}\\p{N}_])`, "u").test(inflectedText);
  });
  if (named) return true;
  const textWords = new Set(normalized.split(/[^a-z0-9]+/).map(singular));
  return namesOf(exercise)
    .flatMap(significantWords)
    .some(
      (word) =>
        textWords.has(word) &&
        !exercises.some((other) => other.token !== token && namesOf(other).flatMap(significantWords).includes(word)),
    );
}

export function plannerGuardIssues(value: PlannerInterpretation, context: PlannerGuardContext): PlannerGuardIssue[] {
  if (value.status !== "proposal") return [];
  const issues = new Set<PlannerGuardIssue>();
  const text = context.instructions.join("\n");
  const items = value.sessions.flatMap((session) => session.blocks.flatMap((block) => block.items));
  const stated = plannerTextNumbers(text);
  const checkRounds = (nodes: NonNullable<PlannerInterpretation["sessions"][number]["blocks"][number]["sequence"]>) => {
    for (const node of nodes)
      if (node.kind === "repeat") {
        if (!stated.has(node.rounds)) issues.add("volume");
        checkRounds(node.children);
      }
  };
  for (const session of value.sessions)
    for (const block of session.blocks) if (block.sequence) checkRounds(block.sequence);

  for (const item of items) {
    if (item.prescription.load && !stated.has(item.prescription.load.value)) issues.add("load");
    if (!plannerExerciseIsNamed(text, item.exerciseToken, context.exercises)) issues.add("exercise");
  }
  // Après une réponse du coach, la conversation peut corriger la consigne initiale
  // (« hier » puis « demain ») : seules les vérifications ci-dessus restent valables.
  if (context.instructions.length === 1) {
    const mentions = numberMentions(text);
    for (const { prescription } of items) {
      const load = prescription.load;
      // Une charge sans unité dictée (« à 70 ») reste une question : kilos ou pourcentage changent tout.
      if (load && !hasUnit(mentions, load.value, load.type === "kg" ? KG_UNIT : PERCENT_UNIT)) issues.add("load");
    }
    if (items.some((item) => item.prescription.load) && contradictoryLoads(text, context.exercises)) issues.add("load");
    const dated = dateIssue(value, plannerDateReferences(text, context), context.period, CORRECTION.test(plain(text)));
    if (dated) issues.add(dated);
    if (requestedSessions(text) > 14) issues.add("session_count");
    for (const issue of habitualIssues(text)) issues.add(issue);
    if (context.targets.length > 1) {
      const normalized = plain(text);
      const designated = context.targets.filter((target) => normalized.includes(target.token));
      const served = new Set(value.sessions.flatMap((session) => session.targetTokens));
      const everyone = value.sessions.every((session) => session.targetTokens.length === context.targets.length);
      // Un destinataire nommé n'est jamais oublié ; sans nom, seul « tout le monde » est sûr.
      if (designated.length ? designated.some((t) => !served.has(t.token)) : !everyone) issues.add("target");
    }
  }
  return [...issues];
}

// La date de chaque jour, pour que le modèle ne calcule ni jour de semaine ni relatif.
export function plannerDateHints(today: string, period: { from: string; to: string }) {
  const days: { date: string; weekday: string }[] = [];
  for (let date = period.from; date <= period.to; date = addDays(date, 1))
    days.push({ date, weekday: WEEKDAYS[weekdayOf(date)]! });
  return {
    todayWeekday: WEEKDAYS[weekdayOf(today)]!,
    days,
    relative: {
      avantHier: addDays(today, -2),
      hier: addDays(today, -1),
      aujourdHui: today,
      demain: addDays(today, 1),
      apresDemain: addDays(today, 2),
    },
  };
}

function normalizedIndex(text: string) {
  const chars: string[] = [];
  const origin: number[] = [];
  let index = 0;
  for (const char of text) {
    const folded = char
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("fr")
      .replace(/[’‘]/g, "'")
      .replace(/[«»“”"]/g, "");
    const isSpace = /\s/.test(folded);
    if (isSpace) {
      if (chars.length && chars.at(-1) !== " ") {
        chars.push(" ");
        origin.push(index);
      }
    } else
      for (const unit of folded) {
        chars.push(unit);
        origin.push(index);
      }
    index += char.length;
  }
  origin.push(index);
  return { folded: chars.join(""), origin };
}
const foldedCitation = (value: string) =>
  normalizedIndex(value)
    .folded.trim()
    .replace(/[.,;:!?]+$/, "");

function restoreCitation(citation: string, instructions: readonly string[]) {
  const wanted = foldedCitation(citation);
  if (!wanted) return null;
  for (const text of instructions) {
    const { folded, origin } = normalizedIndex(text);
    const start = folded.indexOf(wanted);
    if (start < 0) continue;
    return text.slice(origin[start]!, origin[start + wanted.length]!).trim();
  }
  return null;
}
function clauseNaming(exercise: PlannerGuardExercise | undefined, instructions: readonly string[]) {
  if (!exercise) return null;
  const labels = namesOf(exercise).map(foldedCitation).filter(Boolean);
  for (const text of instructions)
    for (const clause of text.split(/(?<=[.;\n])/)) {
      const folded = normalizedIndex(clause).folded;
      if (labels.some((label) => folded.includes(label))) {
        const cited = clause.trim().slice(0, 2000);
        if (cited && text.includes(cited)) return cited;
      }
    }
  return null;
}

// La citation doit rester un extrait exact : une variation de casse ou d'espaces est
// restaurée depuis la consigne. Un exercice qui n'a aucune attache dans la consigne
// est retiré au lieu d'être conservé en silence.
export function groundPlannerCitations(
  value: PlannerInterpretation,
  context: { instructions: readonly string[]; exercises: readonly PlannerGuardExercise[] },
): { value: PlannerInterpretation; removed: number } {
  let removed = 0;
  const sessions = value.sessions
    .map((session) => ({
      ...session,
      blocks: session.blocks
        .map((block) => ({
          ...block,
          items: block.items.flatMap((item) => {
            if (context.instructions.some((text) => text.includes(item.instruction))) return [item];
            const exercise = context.exercises.find((candidate) => candidate.token === item.exerciseToken);
            const citation =
              restoreCitation(item.instruction, context.instructions) ?? clauseNaming(exercise, context.instructions);
            if (citation) return [{ ...item, instruction: citation }];
            removed++;
            return [];
          }),
        }))
        .filter((block) => block.items.length > 0),
    }))
    .filter((session) => session.blocks.length > 0);
  return { value: { ...value, sessions }, removed };
}

// Un pourcentage nul ne décrit aucune charge : c'est l'absence de charge, jamais une valeur dictée.
export function plannerDropEmptyPercentages(value: PlannerInterpretation): PlannerInterpretation {
  return {
    ...value,
    sessions: value.sessions.map((session) => ({
      ...session,
      blocks: session.blocks.map((block) => ({
        ...block,
        items: block.items.map((item) =>
          item.prescription.load?.type === "pct_1rm" && item.prescription.load.value === 0
            ? { ...item, prescription: { ...item.prescription, load: null } }
            : item,
        ),
      })),
    })),
  };
}

// Une question par information : le modèle répète parfois la même demande reformulée.
export function plannerDistinctQuestions<T extends { field: string; question: string }>(questions: readonly T[]): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const question of questions) {
    if (seen.has(question.field) && question.field !== "exercise") continue;
    seen.add(question.field);
    kept.push(question);
    if (kept.length === 3) break;
  }
  return kept;
}
