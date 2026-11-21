// Ce que le planificateur a rendu, dans une forme qui ne dépend pas de son fonctionnement interne.
// Le pilote (`driver.ts`) traduit la réponse du service en cette forme ; la notation ne lit qu'elle. Quand le
// service change (quatre étapes, emplacements à compléter), seul le pilote s'adapte : la notation reste la même.
import { z } from "zod";
import { e2eLoad } from "./format";

export const observedRef = z.discriminatedUnion("kind", [
  // Fiche du catalogue commun, ou copie de l'espace qui la représente.
  z.object({ kind: z.literal("catalog"), key: z.string() }),
  // Fiche propre à l'espace, désignée par son nom.
  z.object({ kind: z.literal("private"), name: z.string() }),
  // Emplacement à compléter : aucune fiche, le nom dit par le coach.
  z.object({ kind: z.literal("placeholder"), name: z.string() }),
]);
export type ObservedRef = z.infer<typeof observedRef>;

const observedSet = z.object({ reps: z.number().nullable(), load: e2eLoad.nullable(), warmup: z.boolean() });
export const observedMovement = z.object({
  type: z.literal("movement"),
  ref: observedRef,
  // Le choix de la fiche est marqué « À vérifier » : un doute montré au coach, pas un remplacement silencieux.
  toVerify: z.boolean(),
  // Tous les points « À vérifier » posés sur cet exercice, par leur code.
  flags: z.array(z.string()),
  sets: z.number(),
  reps: z.number().nullable(),
  durationS: z.number().nullable(),
  distanceM: z.number().nullable(),
  restS: z.number().nullable(),
  load: e2eLoad.nullable(),
  setPlan: z.array(observedSet).nullable(),
  // Lus sur la fiche, pour les bornes d'un objectif. `null` : inconnu.
  family: z.string().nullable(),
  equipment: z.array(z.string()).nullable(),
});
export type ObservedMovement = z.infer<typeof observedMovement>;

const observedRecovery = z.object({ type: z.literal("recovery"), seconds: z.number() });
type ObservedGroup = {
  type: "group";
  rounds: number;
  restBetweenRoundsS: number;
  steps: ObservedStep[];
};
export type ObservedStep = ObservedMovement | z.infer<typeof observedRecovery> | ObservedGroup;
export const observedStep: z.ZodType<ObservedStep> = z.lazy(() =>
  z.union([
    observedMovement,
    observedRecovery,
    z.object({
      type: z.literal("group"),
      rounds: z.number(),
      restBetweenRoundsS: z.number(),
      steps: z.array(observedStep),
    }),
  ]),
);

export const observedSession = z.object({
  date: z.string(),
  durationMin: z.number().nullable(),
  recipients: z.object({ groups: z.array(z.string()), athletes: z.array(z.string()) }),
  // Points « À vérifier » qui portent sur la séance entière.
  flags: z.array(z.string()),
  steps: z.array(observedStep),
});
export type ObservedSession = z.infer<typeof observedSession>;

// Le motif d'une question, dans les mots de la mesure.
export const OBSERVED_REASONS = [
  "date",
  "recipient",
  "exercise",
  "unit",
  "rest",
  "load",
  "off_topic",
  "other",
] as const;
export const observedQuestion = z.object({
  reason: z.enum(OBSERVED_REASONS),
  exerciseName: z.string().nullable(),
  options: z.array(z.string()),
});
export type ObservedQuestion = z.infer<typeof observedQuestion>;

export const observed = z.object({
  // sessions : une ou plusieurs séances prêtes à relire ; question : le coach est arrêté ; error : une panne.
  status: z.enum(["sessions", "question", "error"]),
  // Vrai quand le coach ne peut pas avancer sans répondre.
  blocked: z.boolean(),
  questions: z.array(observedQuestion),
  sessions: z.array(observedSession),
  error: z.string().nullable(),
});
export type Observed = z.infer<typeof observed>;

export const observedError = (code: string): Observed => ({
  status: "error",
  blocked: false,
  questions: [],
  sessions: [],
  error: code,
});
