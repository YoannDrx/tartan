// Format de cas v2 de la mesure de bout en bout du planificateur.
// Un cas sépare ce que le coach donne (consigne, date du jour, destinataires, bibliothèque) de ce qu'on attend
// (`expect`). Seule la première partie atteint le planificateur : `caseInput` retire les attentes avant l'appel.
// Les attentes sont des propriétés à vérifier, pas une séance figée. Le mode d'emploi est dans `README.md`.
import { z } from "zod";
import {
  catalogueKey,
  exerciseCategory,
  exerciseEquipment,
  exerciseFamily,
  exerciseMovement,
  trainingEquipment,
  trainingObjective,
} from "@tartan/contracts";
import { EXERCISE_CATALOG } from "@tartan/domain/exercise-catalog";

const isoDate = z.iso.date();
const caseId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/);
const label = z.string().trim().min(1).max(120);

/** Compare deux noms sans tenir compte de la casse, des accents ni des espaces doublés. */
export const sameName = (a: string, b: string) => foldName(a) === foldName(b);
export const foldName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/\s+/g, " ")
    .trim();

// Une charge porte toujours son unité : des kilos, ou un pourcentage du maximum.
export const e2eLoad = z.object({ value: z.number().min(0).max(1000), unit: z.enum(["kg", "pct_1rm"]) }).strict();
export type E2eLoad = z.infer<typeof e2eLoad>;

// Fiche privée du cas : elle n'existe que dans l'espace créé pour lui.
export const e2ePrivateExercise = z
  .object({
    name: label,
    category: exerciseCategory,
    aliases: z.array(label).max(20).optional(),
    family: exerciseFamily.optional(),
    movement: exerciseMovement.optional(),
    // Liste vide : aucun matériel. Absente : matériel inconnu.
    equipment: z.array(exerciseEquipment).max(20).optional(),
    // Vrai : la fiche se charge avec une barre ou des haltères.
    loadable: z.boolean().optional(),
  })
  .strict();
export type E2ePrivateExercise = z.infer<typeof e2ePrivateExercise>;

// La bibliothèque visée : le catalogue commun de Tartan, plus les fiches privées du cas.
export const e2eLibrary = z
  .object({ catalog: z.literal("common"), private: z.array(e2ePrivateExercise).max(50).default([]) })
  .strict()
  .refine((library) => new Set(library.private.map((e) => foldName(e.name))).size === library.private.length);
export type E2eLibrary = z.infer<typeof e2eLibrary>;

export const e2eRecipients = z
  .object({ groups: z.array(label).max(20).default([]), athletes: z.array(label).max(50).default([]) })
  .strict();
export type E2eRecipients = z.infer<typeof e2eRecipients>;

// Profil de l'espace, facultatif. Un groupe ou un athlète cité dans `recipients` et absent d'ici est créé d'office.
export const e2eSpace = z
  .object({
    equipment: z.array(trainingEquipment).max(16).optional(),
    disciplines: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    objectives: z.array(trainingObjective).max(6).optional(),
    groups: z
      .array(z.object({ name: label, athletes: z.array(label).max(30).default([]) }).strict())
      .max(20)
      .optional(),
    athletes: z.array(label).max(50).optional(),
  })
  .strict();
export type E2eSpace = z.infer<typeof e2eSpace>;

const plannedSet = z.object({ reps: z.number().int().min(1).max(500).optional(), load: e2eLoad.nullable() }).strict();

// Un mouvement attendu. Une seule identité : `key` (catalogue commun), `private` (fiche privée du cas) ou
// `absent` (aucune fiche n'existe : la séance doit garder un emplacement à compléter, sous le nom dit).
// Un champ de prescription absent n'est pas contrôlé ; `load` est obligatoire, `null` = aucune charge ne doit paraître.
export const e2eMovement = z
  .object({
    key: catalogueKey.optional(),
    // Autres fiches du catalogue acceptées à la place de `key`, quand deux fiches conviennent vraiment.
    accept: z.array(catalogueKey).min(1).max(5).optional(),
    private: label.optional(),
    absent: z.literal(true).optional(),
    said: label.optional(),
    sets: z.number().int().min(1).max(50).optional(),
    reps: z.number().int().min(1).max(500).optional(),
    durationS: z.number().int().min(1).max(14400).optional(),
    distanceM: z.number().min(1).max(20000).optional(),
    load: e2eLoad.nullable(),
    restS: z.number().int().min(0).max(3600).optional(),
    // Séries détaillées (pyramide, montée en charge), dans l'ordre.
    setPlan: z.array(plannedSet).min(1).max(30).optional(),
  })
  .strict()
  .refine(
    (m) =>
      [m.key, m.private, m.absent].filter((v) => v !== undefined).length === 1 &&
      Boolean(m.absent) === (m.said !== undefined) &&
      (!m.accept || m.key !== undefined),
    { error: "Un mouvement a une seule identité : key, private, ou absent avec said." },
  );
export type E2eMovement = z.infer<typeof e2eMovement>;

// Une pause explicite entre deux mouvements (pas le repos entre les séries, qui est `restS` du mouvement).
export const e2eRecovery = z.object({ recoveryS: z.number().int().min(1).max(3600) }).strict();
const groupFields = {
  rounds: z.number().int().min(2).max(50),
  restBetweenRoundsS: z.number().int().min(0).max(3600).optional(),
  // Pour la relecture seulement : un circuit et un superset se notent de la même façon.
  kind: z.enum(["circuit", "superset"]).optional(),
};
const innerGroup = z
  .object({
    ...groupFields,
    steps: z
      .array(z.union([e2eRecovery, e2eMovement]))
      .min(1)
      .max(60),
  })
  .strict();
// Des tours : circuit ou superset, deux niveaux au plus.
export const e2eGroup = z
  .object({
    ...groupFields,
    steps: z
      .array(z.union([innerGroup, e2eRecovery, e2eMovement]))
      .min(1)
      .max(60),
  })
  .strict();
export const e2eStep = z.union([e2eGroup, e2eRecovery, e2eMovement]);
export type E2eStep = z.infer<typeof e2eStep>;

// Bornes d'une séance que le coach laisse composer.
export const e2eBounds = z
  .object({
    durationMin: z
      .object({ min: z.number().int().min(1).max(600).optional(), max: z.number().int().min(1).max(600) })
      .strict()
      .optional(),
    // Matériel permis : toute fiche choisie n'utilise que celui-ci. Absent : non contrôlé.
    equipment: z
      .array(z.union([trainingEquipment, exerciseEquipment]))
      .max(20)
      .optional(),
    // Familles à couvrir : chacune par au moins un exercice.
    families: z.array(exerciseFamily).max(9).optional(),
    exercises: z
      .object({ min: z.number().int().min(1).max(60), max: z.number().int().min(1).max(60) })
      .strict()
      .refine((range) => range.min <= range.max),
    // Vrai : aucune charge en kilos, que le coach n'a pas donnée.
    noKg: z.boolean(),
  })
  .strict();
export type E2eBounds = z.infer<typeof e2eBounds>;

export const e2eExpectedSession = z
  .object({
    date: isoDate,
    // Destinataires de cette séance, s'ils diffèrent de ceux du cas.
    recipients: e2eRecipients.optional(),
    steps: z.array(e2eStep).min(1).max(60).optional(),
    bounds: e2eBounds.optional(),
  })
  .strict();
export type E2eExpectedSession = z.infer<typeof e2eExpectedSession>;

export const E2E_ASK_REASONS = ["no_date", "no_recipient", "off_topic"] as const;
export const E2E_FAULTS = ["wrong_date", "invented_load", "added_exercise", "wrong_exercise"] as const;
export type E2eFault = (typeof E2E_FAULTS)[number];

export const e2eExpectation = z
  .object({
    // Aucune question ne doit bloquer : la séance arrive, avec ses doutes marqués « À vérifier » au besoin.
    mustNotAsk: z.literal(true).optional(),
    // Une question est la seule bonne réponse, pour un de ces trois motifs seulement.
    mustAsk: z
      .object({ reason: z.enum(E2E_ASK_REASONS) })
      .strict()
      .optional(),
    sessions: z.array(e2eExpectedSession).max(14).default([]),
    // Les fautes qui seraient graves pour ce cas. Une faute absente de la liste reste un écart, sans être grave.
    critical: z.array(z.enum(E2E_FAULTS)).max(E2E_FAULTS.length),
  })
  .strict();

export const e2eCase = z
  .object({
    id: caseId,
    // described : le coach décrit sa séance ; objective : il donne un objectif ; mixed : les deux.
    kind: z.enum(["described", "objective", "mixed"]),
    text: z.string().trim().min(1).max(12000),
    // Vrai : la consigne a le style d'une dictée (sans ponctuation, nombres en lettres, reprises).
    spoken: z.boolean(),
    // La date du jour simulée : « demain » et « lundi » se lisent depuis elle.
    today: isoDate,
    recipients: e2eRecipients,
    space: e2eSpace.optional(),
    library: e2eLibrary,
    expect: e2eExpectation,
  })
  .strict()
  .superRefine((test, ctx) => {
    const { expect, kind } = test;
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if (Boolean(expect.mustNotAsk) === Boolean(expect.mustAsk)) issue("Exactement un de mustNotAsk ou mustAsk.");
    if (expect.mustAsk && expect.sessions.length) issue("Un cas mustAsk n'attend aucune séance.");
    if (expect.mustNotAsk && !expect.sessions.length) issue("Un cas mustNotAsk attend au moins une séance.");
    for (const session of expect.sessions) {
      if ((kind === "objective") === Boolean(session.steps)) issue(`steps : exigé sauf pour objective (${kind}).`);
      if ((kind === "described") === Boolean(session.bounds)) issue(`bounds : exigé sauf pour described (${kind}).`);
    }
    const names = new Set(test.library.private.map((e) => foldName(e.name)));
    for (const movement of expect.sessions.flatMap((s) => movementsOf(s.steps ?? [])))
      if (movement.private && !names.has(foldName(movement.private)))
        issue(`Fiche privée absente de library.private : ${movement.private}`);
  });
export type E2eCase = z.infer<typeof e2eCase>;
/** Ce que le planificateur reçoit d'un cas : tout, sauf les attentes. */
export type E2eCaseInput = Omit<E2eCase, "expect">;
export const caseInput = ({ expect: _expect, ...input }: E2eCase): E2eCaseInput => input;

export const e2eCorpus = z
  .object({ version: z.literal(2), cases: z.array(e2eCase).min(1).max(2000) })
  .strict()
  .refine((corpus) => new Set(corpus.cases.map((c) => c.id)).size === corpus.cases.length, {
    error: "Deux cas portent le même identifiant.",
  });
export type E2eCorpus = z.infer<typeof e2eCorpus>;

/** Les mouvements d'une liste d'étapes, dans l'ordre d'écriture, tours déroulés une seule fois. */
export function movementsOf(steps: readonly E2eStep[]): E2eMovement[] {
  return steps.flatMap((step) =>
    "rounds" in step ? movementsOf(step.steps as E2eStep[]) : "recoveryS" in step ? [] : [step],
  );
}

const CATALOG_KEYS = new Set(EXERCISE_CATALOG.map((entry) => entry.catalogKey));
export const isCatalogKey = (key: string) => CATALOG_KEYS.has(key);

/** Problèmes qu'un schéma ne voit pas : une clé qui n'est pas dans le catalogue commun. Nommés par identifiant. */
export function corpusProblems(corpus: E2eCorpus): string[] {
  const problems: string[] = [];
  for (const test of corpus.cases)
    for (const movement of test.expect.sessions.flatMap((s) => movementsOf(s.steps ?? [])))
      for (const key of [movement.key, ...(movement.accept ?? [])])
        if (key && !isCatalogKey(key)) problems.push(`${test.id}: clé inconnue du catalogue « ${key} »`);
  return problems;
}
