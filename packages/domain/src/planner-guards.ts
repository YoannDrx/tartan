import type { PlannerInterpretation, PlannerRichInterpretation, PlannerWarning } from "@tartan/contracts";
import { normalizeExerciseMention, normalizeExerciseTerm } from "./exercise-aliases";
import { plannerItemLoads, plannerLoadsAllowed } from "./ai-planner";
import { addDays } from "./status";

// Contrôles déterministes appliqués à la réponse du modèle, côté serveur. Ils ne complètent jamais une séance.
// Deux familles : un défaut **bloquant** (date fausse, destinataire hors sélection, charge inventée, exercice
// inconnu) devient une question ; un **point à vérifier** laisse la proposition passer et s'affiche sur le champ.
export type PlannerGuardIssue = "date" | "missing_date" | "exercise" | "target" | "load" | "session_count";
export type PlannerGuardExercise = { token: string; name: string; aliases: readonly string[] };
export type PlannerGuardContext = {
  period: { from: string; to: string };
  today: string;
  instructions: readonly string[];
  targets: readonly { token: string }[];
  exercises: readonly PlannerGuardExercise[];
  // Ce que le contexte désigne déjà (séance précédente à ajuster, séances voisines) : ni inventé ni substitué.
  known?: { tokens: readonly string[]; loads: readonly number[] };
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
  for (const match of normalized.matchAll(/\d+(?:[.,]\d+)?/g)) {
    if (/\bvirgule\s*$/.test(normalized.slice(0, match.index))) continue;
    mentions.push({
      value: Number(match[0].replace(",", ".")),
      after: normalized.slice(match.index + match[0].length, match.index + match[0].length + 16),
    });
  }
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
        i += 2;
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

function hasDateReference(text: string, context: { today: string; period: { from: string; to: string } }) {
  const references = plannerDateReferences(text, context);
  return (
    references.explicit.length > 0 ||
    references.ranges.length > 0 ||
    references.relative.length > 0 ||
    Boolean(references.weekdayOnly)
  );
}

function dateIssue(
  value: PlannerInterpretation,
  references: PlannerDateReferences,
  period: { from: string; to: string },
  corrected: boolean,
  text: string,
) {
  const { explicit, ranges, relative, weekdayOnly } = references;
  const dates = value.sessions.map((session) => session.date);
  if (explicit.some((date) => date.weekdayMismatch)) return "date" as const;
  if (ranges.some((range) => range.from < period.from || range.to > period.to)) return "date" as const;
  if (weekdayOnly && !explicit.length && !relative.length && !ranges.length) {
    const days = WEEKDAYS.filter((day) => new RegExp(`\\b${day}s?\\b`).test(plain(text)));
    // A single stated weekday must not silently become the period's first day.
    if (days.length === 1 && dates.some((date) => WEEKDAYS[weekdayOf(date)] !== days[0])) return "date" as const;
  }
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

const namesOf = (exercise: PlannerGuardExercise) => [exercise.name, ...exercise.aliases];

// Un exercice ne peut être retenu que s'il est désigné par son nom complet ou un alias.
// Jamais par un mot isolé ni par proximité de mouvement : le doute devient une question.
export function plannerExerciseIsNamed(
  text: string,
  token: string,
  exercises: readonly PlannerGuardExercise[],
): boolean {
  const exercise = exercises.find((candidate) => candidate.token === token);
  if (!exercise) return false;
  const normalized = plain(text).replace(/-/g, " ");
  const inflectedText = normalizeExerciseMention(text);
  const matches = exercises.flatMap((candidate) =>
    namesOf(candidate).flatMap((label) => {
      const term = normalizeExerciseMention(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!term.length) return [];
      return [...inflectedText.matchAll(new RegExp(`(?<![\\p{L}\\p{N}_])${term}(?![\\p{L}\\p{N}_])`, "gu"))].map(
        (match) => ({ token: candidate.token, start: match.index, end: match.index + match[0].length }),
      );
    }),
  );
  const specific = matches.filter(
    (hit) =>
      !matches.some(
        (other) => other.start <= hit.start && other.end >= hit.end && other.end - other.start > hit.end - hit.start,
      ),
  );
  // Un alias court contenu dans un autre mouvement nommé (clean dans power clean) ne compte pas.
  if (specific.some((hit) => hit.token === token)) return true;
  // Mêmes mots dans un autre ordre (« squats goblet » pour « Goblet squat »), dans une même proposition de la
  // consigne, et sans autre fiche nommée exactement à cet endroit : c'est la même désignation.
  return clausesOf(inflectedText).some(
    ({ text: clause, start, end }) =>
      !specific.some((hit) => hit.start >= start && hit.end <= end) &&
      namesOf(exercise).some((label) => {
        const words = wordsOf(label);
        return words.length > 1 && words.every((word) => wordsOf(clause).includes(word));
      }),
  );
}

const wordsOf = (value: string) =>
  normalizeExerciseMention(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
function clausesOf(text: string) {
  const clauses: { text: string; start: number; end: number }[] = [];
  let start = 0;
  for (const match of text.matchAll(/[,;:.!?\n]|\s(?:puis|ensuite|et)\s/g)) {
    clauses.push({ text: text.slice(start, match.index), start, end: match.index });
    start = match.index + match[0].length;
  }
  clauses.push({ text: text.slice(start), start, end: text.length });
  return clauses;
}
// Mots qui ne désignent pas un mouvement à eux seuls.
const WEAK = new Set(["avec", "sans", "pour", "sur", "barre", "halteres", "haltere", "bras", "jambe", "assis", "debout"]);
/**
 * Une fiche choisie dont un mot principal figure dans la consigne (« fentes » pour « Fentes avant ») : la
 * désignation est proche, pas exacte. La proposition passe, avec un point « À vérifier » sur l'exercice.
 */
export function plannerExerciseIsApproximate(
  text: string,
  token: string,
  exercises: readonly PlannerGuardExercise[],
): boolean {
  const exercise = exercises.find((candidate) => candidate.token === token);
  if (!exercise) return false;
  const words = new Set(wordsOf(text));
  // Un mot qui appartient à une autre fiche nommée exactement n'est pas un indice (« clean » dans « power clean »).
  const taken = new Set(
    exercises
      .filter((other) => other.token !== token && plannerExerciseIsNamed(text, other.token, exercises))
      .flatMap((other) => namesOf(other).flatMap(wordsOf)),
  );
  return namesOf(exercise).some((label) =>
    wordsOf(label).some((word) => word.length > 3 && !WEAK.has(word) && words.has(word) && !taken.has(word)),
  );
}

// Une réponse du coach est enregistrée après les questions du modèle, une par ligne et terminées par
// « ? ». Les contrôles ne lisent que ce que le coach a écrit : une date, une unité ou un nom
// d'exercice proposés dans une question ne valent pas confirmation.
export const plannerCoachText = (instruction: string, index: number): string =>
  index === 0
    ? instruction
    : instruction
        .split("\n")
        .filter((line) => !line.trim().endsWith("?"))
        .join("\n");

type Item = PlannerRichInterpretation["sessions"][number]["blocks"][number]["items"][number];
const itemsOf = (value: PlannerInterpretation | PlannerRichInterpretation) =>
  value.sessions.flatMap((session) => session.blocks.flatMap((block) => block.items as Item[]));
const tokensOf = (item: Item) => [item.exerciseToken, ...(item.autonomous ? [item.autonomous.exerciseToken] : [])];

/** Défauts bloquants : la proposition devient une question, jamais une séance douteuse. */
export function plannerGuardIssues(
  value: PlannerInterpretation | PlannerRichInterpretation,
  context: PlannerGuardContext,
): PlannerGuardIssue[] {
  if (value.status !== "proposal") return [];
  const issues = new Set<PlannerGuardIssue>();
  const coach = context.instructions.map(plannerCoachText);
  const text = coach.join("\n");
  const items = itemsOf(value);
  const stated = new Set([...plannerTextNumbers(text), ...(context.known?.loads ?? [])]);
  const known = new Set(context.known?.tokens ?? []);
  for (const item of items) {
    for (const load of plannerItemLoads(item)) if (!stated.has(load.value)) issues.add("load");
    for (const token of tokensOf(item))
      if (
        !known.has(token) &&
        !plannerExerciseIsNamed(text, token, context.exercises) &&
        !plannerExerciseIsApproximate(text, token, context.exercises)
      )
        issues.add("exercise");
  }
  // Après une réponse du coach, la conversation peut corriger la consigne initiale (« hier » puis
  // « demain ») : la date se lit alors dans le dernier message qui en donne une. Unités, nombre
  // de séances et destinataires restent contrôlés sur toute la conversation.
  const datedInstruction = [...coach].reverse().find((instruction) => hasDateReference(instruction, context)) ?? coach[0] ?? "";
  const dated = dateIssue(
    value,
    plannerDateReferences(datedInstruction, context),
    context.period,
    CORRECTION.test(plain(datedInstruction)),
    datedInstruction,
  );
  if (dated) issues.add(dated);
  const mentions = numberMentions(text);
  const knownLoads = new Set(context.known?.loads ?? []);
  for (const item of items)
    for (const load of plannerItemLoads(item))
      // Une charge sans unité dictée (« à 70 ») reste une question : kilos ou pourcentage changent tout.
      if (!knownLoads.has(load.value) && !hasUnit(mentions, load.value, load.type === "kg" ? KG_UNIT : PERCENT_UNIT))
        issues.add("load");
  // Une correction de charge précisée dans une réponse lève ce contrôle.
  if (
    context.instructions.length === 1 &&
    items.some((item) => plannerItemLoads(item).length) &&
    contradictoryLoads(text, context.exercises)
  )
    issues.add("load");
  if (requestedSessions(text) > 14) issues.add("session_count");
  if (context.targets.length > 1) {
    const normalized = plain(text);
    const designated = context.targets.filter((target) => normalized.includes(target.token));
    const served = new Set(value.sessions.flatMap((session) => session.targetTokens));
    const everyone = value.sessions.every((session) => session.targetTokens.length === context.targets.length);
    // Un destinataire nommé n'est jamais oublié ; sans nom, seul « tout le monde » est sûr.
    if (designated.length ? designated.some((t) => !served.has(t.token)) : !everyone) issues.add("target");
  }
  return [...issues];
}

type Sequence = NonNullable<PlannerInterpretation["sessions"][number]["blocks"][number]["sequence"]>;
/**
 * Points « À vérifier » : la séance reste proposée, chaque point s'affiche sur le champ concerné. Ce sont des
 * écarts de forme ou des choix proches, jamais une date, un destinataire ou une charge inventés.
 */
export function plannerWarnings(
  value: PlannerRichInterpretation,
  context: Pick<PlannerGuardContext, "instructions" | "exercises" | "known">,
): PlannerWarning[][] {
  if (value.status !== "proposal") return value.sessions.map(() => []);
  const coach = context.instructions.map(plannerCoachText);
  const text = coach.join("\n");
  const stated = plannerTextNumbers(text);
  const known = new Set(context.known?.tokens ?? []);
  const nameOf = (token: string) => context.exercises.find((e) => e.token === token)?.name ?? null;
  const represented = new Set<number>();
  const perSession = value.sessions.map((session) => {
    const warnings: PlannerWarning[] = [];
    const add = (warning: Omit<PlannerWarning, "detail"> & { detail?: string | null }) => {
      if (!warnings.some((w) => w.code === warning.code && w.block === warning.block && w.item === warning.item))
        warnings.push({ detail: null, ...warning });
    };
    session.blocks.forEach((block, b) => {
      block.items.forEach((item, i) => {
        for (const token of tokensOf(item))
          if (!known.has(token) && !plannerExerciseIsNamed(text, token, context.exercises))
            add({ code: "approximate_exercise", field: "exercise", block: b, item: i, detail: nameOf(token) });
        // Une récupération après la dernière série n'existe pas à l'exécution : elle disparaîtrait.
        if (block.sequence && (item.prescription.sets ?? 1) === 1 && (item.prescription.restS ?? 0) > 0)
          add({ code: "rest_not_executed", field: "rest", block: b, item: i });
      });
      const rounds = (nodes: Sequence) => {
        for (const node of nodes)
          if (node.kind === "repeat") {
            represented.add(node.rounds);
            if (!stated.has(node.rounds))
              add({ code: "rounds_not_stated", field: "rounds", block: b, item: null, detail: String(node.rounds) });
            rounds(node.children as Sequence);
          }
      };
      if (block.sequence) rounds(block.sequence);
    });
    return warnings;
  });
  const first = perSession[0];
  if (first && !CORRECTION.test(plain(text)) && /\b(?:circuit|superset)\b/.test(plain(text)))
    for (const mention of numberMentions(text))
      if (mention.value > 1 && /^\s*tours?\b/.test(mention.after) && !represented.has(mention.value))
        first.push({ code: "rounds_missing", field: "rounds", block: null, item: null, detail: String(mention.value) });
  // Aucun historique ne permet de deviner une habitude : la valeur reste à confirmer par le coach.
  if (first && context.instructions.length === 1)
    for (const issue of habitualIssues(text))
      first.push({
        code: issue === "load" ? "habit_load" : "habit_rest",
        field: issue,
        block: null,
        item: null,
        detail: null,
      });
  return perSession;
}

// Mode « Proposer une séance » : la date, l'heure et les destinataires sont posés par le serveur depuis la
// demande. Reste à refuser une proposition vide ou multiple, et toute charge hors des pourcentages permis.
export function plannerProposalIssues(
  value: PlannerInterpretation | PlannerRichInterpretation,
  context: { brief?: { date: string; durationMin: number } | null; percentTokens?: ReadonlySet<string> },
): PlannerGuardIssue[] {
  if (value.status !== "proposal" || !context.brief) return [];
  const issues = new Set<PlannerGuardIssue>();
  if (value.sessions.length !== 1) issues.add("session_count");
  if (value.sessions.some((session) => session.date !== context.brief!.date)) issues.add("date");
  if (itemsOf(value).some((item) => !plannerLoadsAllowed(item, context.percentTokens))) issues.add("load");
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
export function groundPlannerCitations<T extends PlannerInterpretation | PlannerRichInterpretation>(
  value: T,
  context: { instructions: readonly string[]; exercises: readonly PlannerGuardExercise[] },
): { value: T; removed: number } {
  let removed = 0;
  const sessions = (value.sessions as PlannerRichInterpretation["sessions"])
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
        .filter((block) => block.items.length > 0 || Boolean(block.sequence?.length)),
    }))
    .filter((session) => session.blocks.length > 0);
  return { value: { ...value, sessions } as T, removed };
}

// Un pourcentage nul ne décrit aucune charge : c'est l'absence de charge, jamais une valeur dictée.
export function plannerDropEmptyPercentages<T extends PlannerInterpretation | PlannerRichInterpretation>(value: T): T {
  return {
    ...value,
    sessions: (value.sessions as PlannerRichInterpretation["sessions"]).map((session) => ({
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
  } as T;
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
