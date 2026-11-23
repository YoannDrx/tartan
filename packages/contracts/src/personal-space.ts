import { z } from "zod";
import { isoDate, uuid } from "./session";
import { trainingProfileSchema } from "./training-profile";

// L'athlète qui s'entraîne seul : son espace personnel, l'aiguillage des inscriptions et le partage de son
// historique avec un coach. Contrats ajoutés le 23 novembre 2026, lus par le web et, au lot AA3, par l'app native.

// Ce que l'aiguillage d'un compte sans espace peut proposer, lu sans session : aucune donnée de personne.
export const signupOptionsResponse = z.object({
  // L'inscription des coachs est ouverte à tous (hors liste du pilote, décidée au cas par cas).
  coach: z.boolean(),
  // L'athlète peut ouvrir seul son espace personnel.
  athlete: z.boolean(),
});
export type SignupOptions = z.infer<typeof signupOptionsResponse>;

export const createPersonalSpaceInput = z.object({
  firstName: z.string().trim().min(1, "Indique ton prénom").max(60),
  lastName: z.string().trim().min(1, "Indique ton nom").max(80),
  // Absente quand le compte connaît déjà sa date : elle ne se réécrit pas ici.
  birthDate: isoDate.optional(),
  disciplines: trainingProfileSchema.shape.disciplines.default([]),
  trainingObjectives: trainingProfileSchema.shape.trainingObjectives.default([]),
  termsAccepted: z.literal(true, "Accepte les conditions pour continuer."),
  // Deux accords facultatifs, comme à l'arrivée dans un groupe : santé (effort ressenti, douleurs) et vidéo.
  consents: z.object({ health: z.boolean(), video: z.boolean() }).default({ health: false, video: false }),
});
export type CreatePersonalSpaceInput = z.input<typeof createPersonalSpaceInput>;

export const personalSpaceResponse = z.object({ organizationId: uuid, athleteId: uuid });
export type PersonalSpaceResponse = z.infer<typeof personalSpaceResponse>;

// ── Partage de l'historique personnel avec un coach ──────────────────────────
// Par cases, révocable, en lecture seule. La santé n'en fait jamais partie.
export const historyShareScope = z.enum(["records", "strength", "sessions"]);
export type HistoryShareScope = z.infer<typeof historyShareScope>;

export const historyShareInput = z.object({
  // L'espace du coach que l'athlète vient de rejoindre.
  organizationId: uuid,
  scopes: z.array(historyShareScope).max(3),
});
export type HistoryShareInput = z.infer<typeof historyShareInput>;

export const historyShareSummary = z.object({
  organizationId: uuid,
  organizationName: z.string(),
  scopes: z.array(historyShareScope),
  grantedAt: z.string(),
});
export type HistoryShareSummary = z.infer<typeof historyShareSummary>;
