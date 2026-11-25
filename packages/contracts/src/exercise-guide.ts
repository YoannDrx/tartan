import { z } from "zod";

export const exerciseFamily = z.enum([
  "strength",
  "weightlifting",
  "mobility",
  "plyometrics",
  "running",
  "core",
  "coordination",
  "stairs",
  "warmup",
]);

export const catalogueKey = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const instruction = z.string().trim().min(1).max(600);

// La vidéo d'une fiche commune : sa vue, et ses adresses de lecture signées (absentes sans clé de signature).
export const catalogVideo = z.object({
  view: z.enum(["side", "front"]),
  streamUrl: z.string().url().nullable(),
  hlsUrl: z.string().url().nullable(),
  posterUrl: z.string().url().nullable(),
});
export type CatalogVideo = z.infer<typeof catalogVideo>;
// Une variante plus facile ou plus difficile : son libellé, et la fiche du catalogue qui la décrit quand elle existe.
export const exerciseGuideVariant = z.object({ text: instruction, catalogKey: catalogueKey.nullable() });

// La version concise d'un guide du catalogue : celle qui s'affiche. Le texte complet, déjà relu, reste sous
// « Détail » tant que le fondateur n'a pas validé la famille (`review`).
export const exerciseConciseGuide = z.object({
  objective: instruction,
  setup: instruction,
  steps: z.array(instruction).min(2).max(10),
  mistakes: z.array(instruction).min(1).max(6),
  easier: exerciseGuideVariant.nullable(),
  harder: exerciseGuideVariant.nullable(),
  review: z.enum(["review", "approved"]),
});

// Le guide qu'un coach écrit pour sa copie d'une fiche : mise en place, étapes, erreurs.
export const exerciseGuideEdit = z.object({
  objective: instruction,
  setup: instruction,
  steps: z.array(instruction).min(2).max(6),
  mistakes: z.array(instruction).min(1).max(6),
});

export const exerciseGuide = z.object({
  catalogKey: catalogueKey,
  version: z.number().int().positive(),
  family: exerciseFamily,
  level: z.enum(["beginner", "intermediate", "advanced"]),
  objective: instruction,
  setup: z.array(instruction).min(1).max(8),
  steps: z.array(instruction).min(2).max(10),
  breathing: instruction.nullable(),
  mistakes: z.array(instruction).min(1).max(6),
  easier: instruction.nullable(),
  progression: instruction.nullable(),
  counting: z.object({
    unit: z.enum(["repetitions", "seconds", "meters", "contacts", "steps"]),
    sides: z.enum(["total", "each_side", "alternating_total"]),
    explanation: instruction,
  }),
  loadExplanation: instruction,
  illustration: z.object({
    status: z.enum(["draft", "ready"]),
    path: z.string().regex(/^\/exercise-guides\/[a-z0-9-]+-v[1-9][0-9]*\.svg$/),
    alt: instruction,
    positions: z.array(instruction).min(2).max(6),
    source: z.literal("tartan-original"),
    rights: z.literal("Tartan"),
    // Posé à la lecture, jamais enregistré : le geste animé de la fiche existe, relu ou non par le fondateur.
    photo: z
      .object({ path: z.string().regex(/^\/exercise-photos\/[a-z0-9-]+-v[1-9][0-9]*\.webp$/), alt: instruction })
      .optional(),
    motion: z.enum(["review", "approved"]).optional(),
    // Posées à la lecture elles aussi : les vidéos de la fiche commune, déposées par le fondateur, une par vue.
    videos: z.array(catalogVideo).max(2).optional(),
  }),
  // Une fiche complète n'est pas une preuve de validation humaine du geste.
  technicalReview: z.enum(["pending", "approved"]),
  // Un coach a réécrit le guide de sa copie : ce n'est plus le texte relu par Tartan.
  author: z.enum(["tartan", "coach"]).optional(),
  // Posée à la lecture, jamais enregistrée : la version concise du guide du catalogue, quand le texte est le sien.
  concise: exerciseConciseGuide.optional(),
});

export type ExerciseGuide = z.infer<typeof exerciseGuide>;
export type ExerciseConciseGuide = z.infer<typeof exerciseConciseGuide>;
export type ExerciseGuideEdit = z.infer<typeof exerciseGuideEdit>;
export type ExerciseFamily = z.infer<typeof exerciseFamily>;
