import type {
  PlannerIntent,
  PlannerUnderstanding,
  PlannerUnderstoodMovement,
  PlannerUnderstoodProposal,
} from "@tartan/contracts";
import { normalizeExerciseTerm } from "./exercise-aliases";
import { PLANNER_WEEKDAYS, plannerDateReferences, plannerWeekdayOf } from "./planner-guards";
import { addDays } from "./status";

// Étape « Comprendre », après le modèle : ce qu'il a lu est vérifié contre la demande, par règles. Une date n'est
// retenue que si la demande la donne ; un destinataire, que s'il est choisi ou cité ; un mouvement, que s'il n'est
// pas un jeton de destinataire. Ce qui manque devient une question nommée, et seulement dans trois cas : aucune
// date déductible, aucun destinataire, demande hors sujet.

export const PLANNER_MAX_SESSIONS = 14;

export type PlannerRequestHints = {
  // Les clients d'avant le champ unique envoient encore un mode et un brief : de simples indices.
  intent?: PlannerIntent | null;
  date?: string | null;
  startTime?: string | null;
  durationMin?: number | null;
  level?: PlannerUnderstoodProposal["level"];
  equipment?: readonly string[] | null;
};
export type PlannerUnderstandingContext = {
  // Le texte du coach : la consigne, puis ses réponses. Les noms connus y sont déjà remplacés par des jetons.
  text: string;
  today: string;
  period: { from: string; to: string };
  targets: readonly { token: string }[];
  // Vrai : destinataires choisis par le coach à l'écran. Faux : tous ceux qu'il peut viser, à citer dans la demande.
  targetsChosen: boolean;
  hints?: PlannerRequestHints;
  // Le matériel du profil de l'espace, quand la demande n'en dit rien.
  spaceEquipment?: readonly string[];
};
export type PlannerBlocker =
  | { kind: "off_topic" }
  | { kind: "empty" }
  | { kind: "too_many_sessions" }
  // `said` : les mots du coach pour cette date ; `outOfPeriod` : une date lue, hors de la période.
  | { kind: "no_date"; session: number; said: string | null; outOfPeriod: boolean }
  | { kind: "no_recipient"; session: number };
export type PlannerRequestMovement = PlannerUnderstoodMovement & { session: number };
export type PlannerRequestSession = {
  date: string | null;
  dateSaid: string | null;
  startTime: string | null;
  targetTokens: string[];
  movements: PlannerRequestMovement[];
  structure: string | null;
  proposal: (Omit<PlannerUnderstoodProposal, "equipment"> & { equipment: string[] }) | null;
};
export type PlannerRequest = {
  intent: PlannerIntent;
  summary: string;
  corrections: PlannerUnderstanding["corrections"];
  sessions: PlannerRequestSession[];
  blockers: PlannerBlocker[];
};

const fold = (value: string) =>
  normalizeExerciseTerm(value)
    .replace(/['-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const TOKEN = /(?<![\p{L}\p{N}_])(?:group|athlete|exercise|slot)_[0-9]+(?![\p{L}\p{N}_])/gu;
const WEEKDAY = "(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)";
const EVERY_DAY = new RegExp(
  `(?<![a-z])(?:d[ue] ${WEEKDAY} (?:au|a|jusqu au|jusqu a) ${WEEKDAY}|tous les jours|chaque jour)(?![a-z])`,
);
const TEMPORAL =
  /(?<![a-z])(?:\d+|jours?|semaines?|week ?end|mois|prochaine?s?|demain|lendemain|matin|midi|soir|huit|quinze|fin|debut)(?![a-z])/;

/** L'extrait exact de la demande qui correspond à ce que le modèle a recopié, à la casse et aux accents près. */
function exactExtract(said: string, text: string): string {
  const wanted = fold(said);
  if (!wanted) return said;
  const chars: string[] = [];
  const origin: number[] = [];
  let index = 0;
  for (const char of text) {
    const plain = normalizeExerciseTerm(char);
    for (const unit of plain === "" || /^['\-\s]$/.test(plain) ? " " : plain) {
      if (unit === " " && (!chars.length || chars.at(-1) === " ")) continue;
      chars.push(unit);
      origin.push(index);
    }
    index += char.length;
  }
  origin.push(index);
  const start = chars.join("").indexOf(wanted);
  return start < 0 ? said : text.slice(origin[start]!, origin[start + wanted.length]!).trim() || said;
}

/** Un jeton de destinataire n'est jamais un mouvement : il est retiré du terme, et un terme vide disparaît. */
export function plannerMovementTerm(said: string): string | null {
  const term = said
    .replace(TOKEN, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:.–-]+|[\s,;:.–-]+$/g, "")
    .trim();
  return /\p{L}{2,}/u.test(term) ? term.slice(0, 120) : null;
}

function resolveDate(
  session: { date: string | null; dateSaid: string | null },
  context: PlannerUnderstandingContext,
  alone: boolean,
): { date: string | null; outOfPeriod: boolean } {
  const { period, today } = context;
  const inPeriod = (date: string) => date >= period.from && date <= period.to;
  const references = plannerDateReferences(context.text, { today, period });
  const stated = [...references.explicit.map((date) => date.iso), ...references.relative];
  const model = session.date && inPeriod(session.date) ? session.date : null;
  const days = PLANNER_WEEKDAYS.filter((day) => new RegExp(`(?<![a-z])${day}s?(?![a-z])`).test(fold(context.text)));
  if (alone && stated.length === 1 && !references.ranges.length) {
    // Une date écrite par le coach l'emporte toujours sur celle du modèle ; un jour de semaine contredit se demande.
    const date = stated[0]!;
    if (references.explicit.some((entry) => entry.weekdayMismatch)) return { date: null, outOfPeriod: false };
    if (inPeriod(date)) return { date, outOfPeriod: false };
    // Une date hors période peut désigner une séance passée (« comme le 12, refais-la jeudi ») : le jour nommé vaut.
    return model !== null && days.includes(PLANNER_WEEKDAYS[plannerWeekdayOf(model)]!)
      ? { date: model, outOfPeriod: false }
      : { date: null, outOfPeriod: true };
  }
  if (stated.length || references.ranges.length) {
    const covered =
      model !== null &&
      (stated.includes(model) || references.ranges.some((range) => model >= range.from && model <= range.to));
    if (covered) return { date: model, outOfPeriod: false };
    // Plusieurs jours cités et un jour de semaine seul parmi eux (« mardi 24 et jeudi ») : le jour doit concorder.
    if (model !== null && days.includes(PLANNER_WEEKDAYS[plannerWeekdayOf(model)]!))
      return { date: model, outOfPeriod: false };
    return { date: null, outOfPeriod: stated.length > 0 && stated.every((date) => !inPeriod(date)) };
  }
  if (days.length) {
    if (model !== null && days.includes(PLANNER_WEEKDAYS[plannerWeekdayOf(model)]!))
      return { date: model, outOfPeriod: false };
    // Une suite de jours (« du lundi au vendredi », « tous les jours ») : chaque jour entre les deux est cité.
    if (model !== null && !alone && EVERY_DAY.test(fold(context.text))) return { date: model, outOfPeriod: false };
    if (alone && days.length === 1) {
      // Un seul jour de semaine nommé : sa première occurrence à partir d'aujourd'hui, dans la période.
      for (let date = today > period.from ? today : period.from; date <= period.to; date = addDays(date, 1))
        if (PLANNER_WEEKDAYS[plannerWeekdayOf(date)] === days[0]) return { date, outOfPeriod: false };
      return { date: null, outOfPeriod: true };
    }
    return { date: null, outOfPeriod: false };
  }
  // Aucune date reconnue par règle : celle du modèle vaut si elle s'appuie sur des mots de la demande
  // (« dans trois jours », « ce week-end »). Sinon, seule une période d'un jour, ou la date choisie à l'écran.
  if (
    model !== null &&
    session.dateSaid &&
    // Les mots doivent situer un jour : une condition (« quand la météo le permettra ») n'en donne aucun.
    TEMPORAL.test(fold(session.dateSaid)) &&
    fold(context.text).includes(fold(session.dateSaid))
  )
    return { date: model, outOfPeriod: false };
  if (period.from === period.to) return { date: period.from, outOfPeriod: false };
  if (alone && context.hints?.date && inPeriod(context.hints.date))
    return { date: context.hints.date, outOfPeriod: false };
  return { date: null, outOfPeriod: false };
}

export function plannerNormalizeUnderstanding(
  raw: PlannerUnderstanding,
  context: PlannerUnderstandingContext,
): PlannerRequest {
  const blockers: PlannerBlocker[] = [];
  const hints = context.hints ?? {};
  const known = new Set(context.targets.map((target) => target.token));
  const text = fold(context.text);
  const designated = context.targets
    .map((target) => target.token)
    .filter((token) => new RegExp(`(?<![a-z0-9_])${token}(?![a-z0-9_])`).test(text));
  const alone = raw.sessions.length === 1;
  let next = 0;
  const sessions: PlannerRequestSession[] = raw.sessions.slice(0, PLANNER_MAX_SESSIONS).map((session, index) => {
    // Les mouvements : jamais un jeton de destinataire, toujours le terme tel que le coach l'a dit.
    const renamed = new Map<string, string>();
    const kept = session.movements.flatMap((movement) => {
      const term = plannerMovementTerm(movement.said);
      if (!term) return [];
      const id = `m${++next}`;
      renamed.set(movement.id, id);
      return [{ ...movement, id, said: exactExtract(term, context.text), session: index }];
    });
    const movements = kept.map((movement) => ({
      ...movement,
      prescription: movement.prescription?.trim() ? movement.prescription.trim().slice(0, 300) : null,
      replaces: movement.replaces ? (renamed.get(movement.replaces) ?? null) : null,
    }));
    const resolved = resolveDate(session, context, alone);
    if (!resolved.date)
      blockers.push({ kind: "no_date", session: index, said: session.dateSaid, outOfPeriod: resolved.outOfPeriod });
    // Les destinataires : choisis à l'écran, ils valent tous sauf désignation ; sinon ils doivent être cités.
    const cited = [...new Set(session.targetTokens.filter((token) => known.has(token)))];
    const targetTokens = context.targetsChosen
      ? alone
        ? designated.length
          ? designated
          : [...known]
        : cited.length
          ? cited
          : [...known]
      : alone
        ? designated
        : cited.filter((token) => designated.includes(token));
    if (!targetTokens.length) blockers.push({ kind: "no_recipient", session: index });
    // La partie à composer : celle que le modèle a lue, sinon tout ce qui n'est pas décrit.
    const wantsProposal = session.proposal !== null || !movements.length || hints.intent === "objective";
    const proposal = wantsProposal
      ? {
          objective: (session.proposal?.objective ?? context.text).trim().slice(0, 500) || context.text.slice(0, 500),
          durationMin: session.proposal?.durationMin ?? hints.durationMin ?? null,
          level: session.proposal?.level ?? hints.level ?? null,
          equipment: [...(session.proposal?.equipment ?? hints.equipment ?? context.spaceEquipment ?? [])],
          families: [...new Set(session.proposal?.families ?? [])],
        }
      : null;
    return {
      date: resolved.date,
      dateSaid: session.dateSaid,
      startTime: session.startTime ?? (alone ? (hints.startTime ?? null) : null),
      targetTokens,
      movements,
      structure: session.structure?.trim() || null,
      proposal,
    };
  });
  if (raw.offTopic) blockers.unshift({ kind: "off_topic" });
  else if (raw.sessions.length > PLANNER_MAX_SESSIONS) blockers.unshift({ kind: "too_many_sessions" });
  else if (!sessions.length) blockers.unshift({ kind: "empty" });
  const described = sessions.some((session) => session.movements.length > 0);
  const proposed = sessions.some((session) => session.proposal !== null);
  return {
    intent: described && proposed ? "mixed" : described ? "described" : "objective",
    summary: raw.summary.trim(),
    corrections: raw.corrections,
    sessions,
    // Hors sujet, vide ou trop long : rien d'autre n'est demandé au coach.
    blockers: blockers.some((b) => b.kind === "off_topic" || b.kind === "empty" || b.kind === "too_many_sessions")
      ? blockers.slice(0, 1)
      : blockers,
  };
}
