import type { SessionType } from "@tartan/contracts";
import { STARTER_TEMPLATES, type StarterTemplate } from "./starter-templates";
import { addDays, startOfWeek } from "./status";

// L'espace de démonstration : un espace à part, ouvert par un coach neuf pour voir Tartan rempli avant d'inviter
// son groupe. Ses athlètes sont fictifs et n'ont aucun compte. Il est jetable : purgé au bout de 14 jours, ou plus
// tôt par le coach. Ce module porte les règles pures et le contenu fictif ; le service les écrit en base.

export const DEMO_SPACE_TTL_DAYS = 14;
const DAY_MS = 86_400_000;

export const demoSpaceExpiry = (openedAt: Date): Date => new Date(openedAt.getTime() + DEMO_SPACE_TTL_DAYS * DAY_MS);

export const isDemoSpaceExpired = (expiresAt: Date | null, now: Date): boolean =>
  expiresAt !== null && expiresAt.getTime() <= now.getTime();

// Ce qui ne marche pas dans un espace de démonstration : rien ne quitte l'espace, rien n'est facturé ni mesuré.
export const DEMO_SPACE_CUTS = [
  "planner",
  "video",
  "invitations",
  "emails",
  "push",
  "billing",
  "platformStats",
  "usageAnalytics",
] as const;
export type DemoSpaceCut = (typeof DEMO_SPACE_CUTS)[number];

// Les accords des fiches fictives portent cette version : une donnée de santé de démonstration se reconnaît.
export const DEMO_CONSENT_VERSION = "demonstration-fictive";

export const DEMO_SPACE_NAME = "Démonstration Tartan";

// Hasard reproductible : deux ouvertures le même jour donnent la même saison.
export const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
};

export type DemoAthlete = {
  firstName: string;
  lastName: string;
  group: 0 | 1;
  disciplines: string[];
  level: string;
  goal: string | null;
  // 1RM de squat arrière à ce jour, en kg.
  squat: number;
  // Part des séances faites en entier ; le reste se partage entre partielles et manquées.
  assiduity: number;
  // Accord santé fictif : sans lui, ni effort ressenti ni blessure.
  health: boolean;
};

export const DEMO_GROUPS = [
  { name: "Groupe prépa", goal: "Préparation hivernale : force et appuis" },
  { name: "Sprint", goal: "Vitesse pour la saison en salle" },
] as const;

export const DEMO_ATHLETES: DemoAthlete[] = [
  {
    firstName: "Léa",
    lastName: "Moreau",
    group: 0,
    disciplines: ["long_jump"],
    level: "Régional",
    goal: "6 m en salle",
    squat: 95,
    assiduity: 0.9,
    health: true,
  },
  {
    firstName: "Tom",
    lastName: "Girard",
    group: 0,
    disciplines: ["high_jump"],
    level: "National",
    goal: "Qualification nationale",
    squat: 140,
    assiduity: 0.85,
    health: true,
  },
  {
    firstName: "Camille",
    lastName: "Roux",
    group: 0,
    disciplines: ["long_jump"],
    level: "Régional",
    goal: null,
    squat: 90,
    assiduity: 0.75,
    health: true,
  },
  {
    firstName: "Yanis",
    lastName: "Haddad",
    group: 0,
    disciplines: ["high_jump"],
    level: "Régional",
    goal: "Régularité à l'entraînement",
    squat: 110,
    assiduity: 0.6,
    health: false,
  },
  {
    firstName: "Sacha",
    lastName: "Lambert",
    group: 0,
    disciplines: ["triple_jump"],
    level: "Départemental",
    goal: null,
    squat: 120,
    assiduity: 0.8,
    health: true,
  },
  {
    firstName: "Hugo",
    lastName: "Lefèvre",
    group: 1,
    disciplines: ["sprint"],
    level: "National",
    goal: "Moins de 7 s au 60 m",
    squat: 130,
    assiduity: 0.9,
    health: true,
  },
  {
    firstName: "Manon",
    lastName: "Dubois",
    group: 1,
    disciplines: ["sprint"],
    level: "Régional",
    goal: null,
    squat: 85,
    assiduity: 0.7,
    health: true,
  },
  {
    firstName: "Emma",
    lastName: "Faure",
    group: 1,
    disciplines: ["hurdles"],
    level: "Régional",
    goal: "Passer les haies à 4 appuis",
    squat: 88,
    assiduity: 0.8,
    health: true,
  },
];

export type DemoSessionKind = Extract<SessionType, "strength" | "plyo" | "running" | "cones">;

// La semaine type de chaque groupe, jour par jour (0 = lundi).
export const DEMO_WEEK: { group: 0 | 1; offset: number; kind: DemoSessionKind }[] = [
  { group: 0, offset: 0, kind: "strength" },
  { group: 1, offset: 1, kind: "running" },
  { group: 0, offset: 2, kind: "plyo" },
  { group: 1, offset: 3, kind: "strength" },
  { group: 0, offset: 4, kind: "cones" },
];

export const DEMO_WEEKS_BEFORE = 4;
export const DEMO_WEEKS_AFTER = 2;

// Les séances fictives reprennent les séances de départ de chaque espace : elles existent aussi dans le vrai.
export const demoTemplate = (kind: DemoSessionKind): StarterTemplate => {
  const template = STARTER_TEMPLATES.find((candidate) => candidate.type === kind);
  if (!template) throw new Error(`demo_template_missing:${kind}`);
  return template;
};

export const DEMO_SESSION_NOTES: Record<DemoSessionKind, string> = {
  strength: "Descente contrôlée, on pousse fort dans le sol.",
  plyo: "Qualité avant quantité : on s'arrête dès que les appuis ralentissent.",
  running: "Bassin haut, pied actif sous le corps.",
  cones: "Regarde le plot suivant, pas tes pieds.",
};

export type DemoSlot = { date: string; group: 0 | 1; kind: DemoSessionKind; past: boolean; today: boolean };

// Quatre semaines passées, la semaine en cours et deux à venir. Le premier groupe a toujours une séance aujourd'hui :
// le suivi du jour n'est jamais vide.
export const demoSchedule = (today: string): DemoSlot[] => {
  const monday = startOfWeek(today);
  const slots = new Map<string, DemoSlot>();
  for (let week = -DEMO_WEEKS_BEFORE; week <= DEMO_WEEKS_AFTER; week += 1) {
    for (const { group, offset, kind } of DEMO_WEEK) {
      const date = addDays(monday, week * 7 + offset);
      slots.set(`${date}:${group}`, { date, group, kind, past: date < today, today: date === today });
    }
  }
  if (![...slots.values()].some((slot) => slot.today && slot.group === 0)) {
    slots.set(`${today}:0`, { date: today, group: 0, kind: "strength", past: false, today: true });
  }
  return [...slots.values()].sort((a, b) => a.date.localeCompare(b.date) || a.group - b.group);
};

// Le jour même, un athlète sur deux du groupe a déjà validé, quel que soit le jour : le suivi du jour n'est jamais
// tout vide ni tout plein.
export const demoValidatedToday = (indexInGroup: number): boolean => indexInGroup % 2 === 0;

export type DemoComment = "good" | "heavy" | "short" | "tired";

export const DEMO_COMMENTS: Record<DemoComment, string> = {
  good: "Bonnes sensations, les appuis répondent bien.",
  heavy: "Grosse séance, les dernières séries ont piqué.",
  short: "J'ai raccourci la fin, pas assez de temps.",
  tired: "Fatigué après la semaine de cours, j'ai levé le pied.",
};

export type DemoOutcome = {
  status: "done" | "partial" | "missed";
  rpe: number | null;
  durationMin: number | null;
  variant: "club" | "autonomous" | null;
  comment: DemoComment | null;
};

// Effort ressenti habituel de chaque séance, sur 10.
const BASE_RPE: Record<DemoSessionKind, number> = { strength: 7, plyo: 7, running: 6, cones: 5 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Une validation cohérente : une séance manquée ne porte rien ; une partielle est plus courte et ressentie plus dure ;
// l'effort ressenti n'existe qu'avec l'accord santé, et un commentaire suit ce qui s'est passé.
export const demoOutcome = (input: {
  kind: DemoSessionKind;
  durationMin: number;
  athlete: Pick<DemoAthlete, "assiduity" | "health">;
  random: () => number;
}): DemoOutcome => {
  const { kind, durationMin, athlete, random } = input;
  const roll = random();
  const status =
    roll < athlete.assiduity ? "done" : roll < athlete.assiduity + (1 - athlete.assiduity) / 2 ? "partial" : "missed";
  if (status === "missed") return { status, rpe: null, durationMin: null, variant: null, comment: null };
  const effort = clamp(BASE_RPE[kind] + (status === "partial" ? 1 : 0) + Math.floor(random() * 3) - 1, 1, 10);
  const duration =
    status === "done" ? durationMin - Math.floor(random() * 6) : Math.round(durationMin * (0.55 + random() * 0.2));
  const variant = random() < 0.8 ? "club" : "autonomous";
  const speaks = random();
  const comment: DemoComment | null =
    status === "partial"
      ? speaks < 0.6
        ? effort >= 8
          ? "tired"
          : "short"
        : null
      : speaks < 0.15
        ? effort >= 8
          ? "heavy"
          : "good"
        : null;
  return { status, rpe: athlete.health ? effort : null, durationMin: duration, variant, comment };
};

const roundToPlate = (kg: number) => Math.round(kg / 2.5) * 2.5;

// Charge de travail au squat arrière (4 × 5) : 80 % du maximum, qui monte un peu chaque semaine.
export const demoSquatLoad = (athlete: Pick<DemoAthlete, "squat">, weeksAgo: number): number =>
  roundToPlate(athlete.squat * 0.8 - weeksAgo * 1.25);

// Trois tests de force sur la saison, en progression : le dernier vaut le maximum d'aujourd'hui.
export const demoStrengthTests = (athlete: Pick<DemoAthlete, "squat">, today: string) => [
  { date: addDays(today, -45), value: roundToPlate(athlete.squat - 7.5) },
  { date: addDays(today, -24), value: roundToPlate(athlete.squat - 2.5) },
  { date: addDays(today, -5), value: athlete.squat },
];

// Deux phases du premier groupe : la reprise, finie, puis la charge en cours.
export const demoPhases = (today: string) => {
  const monday = startOfWeek(today);
  return [
    {
      name: "Reprise",
      kind: "general" as const,
      startDate: addDays(monday, -42),
      endDate: addDays(monday, -15),
      objective: "Retrouver le volume et les appuis",
    },
    {
      name: "Charge",
      kind: "development" as const,
      startDate: addDays(monday, -14),
      endDate: addDays(monday, 27),
      objective: "Monter en force avant la saison en salle",
    },
  ];
};

export const DEMO_ANNOUNCEMENTS: { group: 0 | 1; pinned: boolean; body: string }[] = [
  {
    group: 0,
    pinned: true,
    body: "Samedi, séance au stade à 10 h : prévoyez les pointes et une tenue de pluie.",
  },
  { group: 0, pinned: false, body: "Tests de détente la semaine prochaine : pensez à valider vos séances d'ici là." },
  { group: 1, pinned: false, body: "Chronos sur 30 m mardi prochain, échauffement complet avant." },
];

// Une blessure fictive suivie, et une note privée du coach : ce que l'espace réel montre aussi.
export const DEMO_INJURY = {
  athlete: 2,
  bodyArea: "knee",
  side: "right" as const,
  daysAgo: 4,
  status: "recovering" as const,
  restrictions: "Pas d'impulsions cette semaine",
};

export const DEMO_COACH_NOTE = { athlete: 1, body: "Progresse vite au squat. Surveiller le tendon avant le meeting." };
