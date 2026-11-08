import { z } from "zod";
import { trainingEquipment } from "./training-profile";

export const exerciseMovement = z.enum([
  "squat",
  "hinge",
  "lunge",
  "push",
  "pull",
  "carry",
  "trunk",
  "run",
  "jump",
  "throw",
  "mobility",
  "coordination",
  "other",
]);
export const exerciseEquipment = z.enum([
  ...trainingEquipment.exclude(["bodyweight"]).options,
  "pullup_bar",
  "jump_mat",
  "stick",
  "other",
]);
// Null means unknown; an empty equipment list explicitly means no equipment.
export const exerciseClassification = z.object({
  movement: exerciseMovement.nullable(),
  equipment: z
    .array(exerciseEquipment)
    .max(20)
    .refine((items) => new Set(items).size === items.length)
    .nullable(),
});
export type ExerciseClassification = z.infer<typeof exerciseClassification>;
