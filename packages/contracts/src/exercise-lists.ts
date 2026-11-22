import { z } from "zod";
import { exerciseCategory } from "./enums";
import { exerciseFamily } from "./exercise-guide";
import { exerciseSummary } from "./responses";
import { uuid } from "./session";

// Les listes d'exercices du coach, communes au web et à l'app native.

export const exerciseListName = z.string().trim().min(1, "Donne un nom à la liste").max(60);

export const exerciseListInput = z.object({ name: exerciseListName });
export type ExerciseListInput = z.infer<typeof exerciseListInput>;

// Renommer, partager ou reprendre une liste : un seul champ suffit.
export const exerciseListUpdate = z
  .object({ name: exerciseListName.optional(), sharedWithCoaches: z.boolean().optional() })
  .refine((value) => value.name !== undefined || value.sharedWithCoaches !== undefined);
export type ExerciseListUpdate = z.infer<typeof exerciseListUpdate>;

// L'ordre complet des listes du coach, Favoris compris.
export const exerciseListOrder = z.object({ listIds: z.array(uuid).min(1).max(100) });

export const exerciseFavoriteInput = z.object({ favorite: z.boolean() });

export const exerciseList = z.object({
  id: uuid,
  name: z.string(),
  position: z.number().int(),
  isFavorites: z.boolean(),
  sharedWithCoaches: z.boolean(),
  // Liste du coach qui la lit ; sinon, liste partagée par un autre coach de l'espace, en lecture seule.
  mine: z.boolean(),
  ownerName: z.string().nullable(),
  // Les fiches de la liste, dans son ordre ; une fiche supprimée de la bibliothèque n'y figure plus.
  exerciseIds: z.array(uuid),
});
export type ExerciseList = z.infer<typeof exerciseList>;

// Un filtre unique : tout, une famille, les favoris, une liste, ou les fiches de l'espace.
export const exerciseFilter = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("favorites") }),
  z.object({ kind: z.literal("mine") }),
  z.object({ kind: z.literal("family"), family: exerciseFamily }),
  z.object({ kind: z.literal("list"), listId: uuid }),
]);
export type ExerciseFilter = z.infer<typeof exerciseFilter>;

export const exerciseSearchQuery = z.object({
  q: z.string().trim().max(120).default(""),
  filter: exerciseFilter.default({ kind: "all" }),
  offset: z.number().int().min(0).max(10_000).default(0),
  limit: z.number().int().min(1).max(100).default(40),
  // Sans recherche ni filtre : les favoris du coach, puis les fiches de ses listes, avant le reste.
  ownFirst: z.boolean().default(false),
});
export type ExerciseSearchQuery = z.input<typeof exerciseSearchQuery>;

// Création rapide : le nom suffit. Sans famille ni convention de charge, le service les propose lui-même.
export const exerciseLoadKind = z.enum(["external_total", "added_weight", "assistance", "bodyweight"]);
export type ExerciseLoadKind = z.infer<typeof exerciseLoadKind>;

export const quickExerciseInput = z.object({
  name: z.string().trim().min(1, "Donne un nom à l'exercice").max(120),
  // Ce que le coach cherchait : gardé comme autre nom de la fiche quand il diffère du nom retenu.
  searchTerm: z.string().trim().max(120).optional(),
  category: exerciseCategory.optional(),
  strengthLoadKind: exerciseLoadKind.nullable().optional(),
  // Création directe dans une liste du coach.
  listId: uuid.optional(),
});
export type QuickExerciseInput = z.input<typeof quickExerciseInput>;

// `created` est faux quand une fiche de ce nom existait déjà : c'est elle qui est rendue.
export const quickExerciseResult = z.object({ id: uuid, created: z.boolean(), exercise: exerciseSummary });
export type QuickExerciseResult = z.infer<typeof quickExerciseResult>;

// Ce que la création rapide préremplit pour un nom, et la fiche qui porte déjà ce nom s'il y en a une.
export const exerciseDefaultsResult = z.object({
  category: exerciseCategory,
  strengthLoadKind: exerciseLoadKind.nullable(),
  basis: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("exercise"), name: z.string() }),
    z.object({ kind: z.literal("keyword"), word: z.string() }),
    z.object({ kind: z.literal("default") }),
  ]),
  existing: exerciseSummary.nullable(),
});
export type ExerciseDefaultsResult = z.infer<typeof exerciseDefaultsResult>;

// Une page de résultats, sans les guides : la fiche se lit à part.
export const exerciseSearchResult = z.object({ items: z.array(exerciseSummary), total: z.number().int().min(0) });
export type ExerciseSearchResult = z.infer<typeof exerciseSearchResult>;

// La fiche complète, avec ce que le coach en a fait et ses variantes résolues dans l'espace.
export const exerciseVariantLink = z.object({ id: uuid, name: z.string() });
export const exerciseSheet = exerciseSummary.extend({
  favorite: z.boolean(),
  listIds: z.array(uuid),
  variants: z.object({ easier: exerciseVariantLink.nullable(), harder: exerciseVariantLink.nullable() }),
});
export type ExerciseSheet = z.infer<typeof exerciseSheet>;
