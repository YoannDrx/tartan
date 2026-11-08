import { z } from "zod";

export const trainingObjective = z.enum(["strength", "speed", "power", "endurance", "mobility", "coordination"]);
export const trainingEquipment = z.enum([
  "bodyweight",
  "barbell",
  "dumbbells",
  "kettlebells",
  "bands",
  "medicine_ball",
  "boxes",
  "hurdles",
  "cones",
  "track",
  "hill",
  "steps",
  "bench",
  "rack",
  "machines",
  "timing",
]);
const unique = <T>(values: T[]) => Array.from(new Set(values));

export const trainingProfileSchema = z.object({
  // Les anciennes clés libres restent lisibles ; aucun rattachement ou remplacement par similarité.
  disciplines: z.array(z.string().trim().min(1).max(40)).max(20).transform(unique),
  trainingObjectives: z.array(trainingObjective).max(6).transform(unique),
  availableEquipment: z.array(trainingEquipment).max(16).transform(unique),
});
export type TrainingProfile = z.infer<typeof trainingProfileSchema>;

export const organizationUpdateInput = z.object({
  name: z.string().trim().min(1, "Donne un nom à ton espace").max(120),
  overdueReminders: z.boolean(),
  // Une ancienne application qui omet ces champs ne doit pas les effacer.
  ...trainingProfileSchema.partial().shape,
});
export type OrganizationUpdateInput = z.input<typeof organizationUpdateInput>;

export const organizationResponse = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["club", "independent"]),
  plan: z.string(),
  logoUrl: z.string().nullable(),
  overdueReminders: z.boolean(),
  disciplines: z.array(z.string()),
  trainingObjectives: z.array(trainingObjective).default([]),
  availableEquipment: z.array(trainingEquipment).default([]),
});
