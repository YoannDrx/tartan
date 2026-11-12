import { z } from "zod";
import { uuid } from "./session";

// Le jeu du site : l'essai, le score envoyé, le classement. Aucun compte, aucune adresse.
export const gameEventId = z.enum(["hurdles", "longJump", "tripleJump", "highJump", "poleVault", "discus"]);
export type GameEventId = z.infer<typeof gameEventId>;

// Identifiant d'appareil tiré au hasard dans le navigateur ; le serveur n'en garde qu'une empreinte.
export const gameDevice = z
  .string()
  .min(16)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/);

export const gameRunInput = z.object({ event: gameEventId, device: gameDevice });

// Pseudo : 3 à 16 caractères, lettres, chiffres, espace, point, tiret, tiret bas.
export const gamePseudo = z
  .string()
  .trim()
  .min(3)
  .max(16)
  .regex(/^[\p{L}\p{N} ._-]+$/u);

export const gameScoreInput = z.object({
  token: uuid,
  device: gameDevice,
  pseudo: gamePseudo,
  // Le journal des appuis : le serveur rejoue la partie et calcule lui-même le score.
  log: z.array(z.number().int().nonnegative()).max(2_000),
});
export type GameScoreInput = z.infer<typeof gameScoreInput>;

export const gameLeaderboardQuery = z.object({
  event: gameEventId,
  period: z.enum(["week", "all"]).default("week"),
});

export const gameEraseInput = z.object({ device: gameDevice });
